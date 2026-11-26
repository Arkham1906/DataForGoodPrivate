// Inventario de protectores y potenciadores (2026-11-19; SRS v1.4: RF-GAM-30, 32 a 36, 44, 50, 75, con las decisiones
// del responsable del 19 nov). Documento: claude/inventario-5a-implementacion.md.
//
// Los objetos llegan de las misiones difíciles: mision_instancias.recompensa guarda el que salió en el sorteo y, al
// completarse la misión, queda pendiente (recompensa_entregada_en NULL). entregarObjetosDeMisiones() los mete al
// inventario si caben:
//   - Protector: usuario_progreso.protectores, máximo 3 (RF-GAM-30).
//   - Potenciador: tabla potenciadores, máximo 1 activo y 3 en espera (RF-GAM-35). Si la persona lo ganó con algo que
//     hizo ella (enviar, guardar, inscribirse: `presente`), se activa al momento o entra a la cola; si llegó porque
//     aceptaron su aporte, se guarda («guardado») y se activa la próxima vez que abra la app (RF-GAM-33).
// Si no cabe, se queda pendiente y la persona decide en la ventana «ya tienes el máximo», que entra en la cola de las
// celebraciones: cambiarlo por el otro objeto o dejarlo pasar (decidirObjeto). Cerrar la ventana no decide nada: vuelve
// en la siguiente visita. Si al mostrarla ya hay lugar, se entrega sin preguntar (decisión del 19 nov).
//
// La cola de potenciadores se mantiene al leer (mantenerPotenciadores): vence el activo y, uno tras otro, activa los que
// esperan, con sus 15 minutos completos y sin solaparse (RF-GAM-34). Los tiempos se encadenan: el siguiente empieza
// cuando terminó el anterior aunque nadie estuviera mirando, para que la EXP de un aporte enviado en ese rato use el
// potenciador correcto (RF-GAM-36).

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { MAXIMO_DE_POTENCIADORES_EN_ESPERA, MAXIMO_DE_PROTECTORES, type ResumenDePotenciadores } from "./progreso-tipos";
import { DIFICILES_DEL_CATALOGO } from "./catalogos";
import { OBJETOS_DE_MISION, recompensaDesde, semillaDelObjeto, sortearObjeto, type ObjetoDeMision } from "./misiones-reglas";
import type { ObjetoPorDecidir } from "./celebraciones-tipos";
import { TEXTOS } from "./textos";

type Consulta = Pick<PoolClient, "query">;

/** Activo, en espera y guardados: todos ocupan lugar (1 activo y 3 en espera). */
const MAXIMO_DE_POTENCIADORES = 1 + MAXIMO_DE_POTENCIADORES_EN_ESPERA;

export type Inventario = { protectores: number; potenciadorActivo: boolean; potenciadoresEnEspera: number };

const otro = (objeto: ObjetoDeMision): ObjetoDeMision => (objeto === "protector" ? "potenciador" : "protector");

/**
 * Vence el potenciador activo y, solo con la persona en la app (`presente`), activa el siguiente: los guardados pasan
 * a la cola y el primero de la cola empieza en ese momento, con su duración completa. Sin la persona, el activo sigue
 * corriendo hasta vencer, pero nada más se activa: lo que espera, espera a que vuelva (decisión del responsable).
 * Debe correr dentro de una transacción con la fila de usuario_progreso bloqueada.
 */
export async function mantenerPotenciadores(client: Consulta, usuarioId: number | string, presente: boolean): Promise<void> {
  await client.query(`UPDATE potenciadores SET estado = 'expirado' WHERE usuario_id = $1 AND estado = 'activo' AND vence_en <= NOW()`, [
    usuarioId,
  ]);
  if (!presente) return;
  await client.query(`UPDATE potenciadores SET estado = 'espera', obtenido_en = NOW() WHERE usuario_id = $1 AND estado = 'guardado'`, [
    usuarioId,
  ]);
  await client.query(
    `UPDATE potenciadores p
        SET estado = 'activo', activado_en = NOW(), vence_en = NOW() + make_interval(mins => p.duracion_minutos)
      WHERE p.id = (
          SELECT id FROM potenciadores
            WHERE usuario_id = $1 AND estado = 'espera'
            ORDER BY obtenido_en, id
            LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM potenciadores WHERE usuario_id = $1 AND estado = 'activo')`,
    [usuarioId],
  );
}

/** ¿Hay algo que mantener con la persona presente? Lectura sin bloqueo, para no abrir una transacción en cada página. */
async function hayQueMantener(usuarioId: number | string): Promise<boolean> {
  const { rows } = await pool.query<{ hay: boolean }>(
    `SELECT EXISTS (
        SELECT 1 FROM potenciadores
          WHERE usuario_id = $1
            AND (estado = 'guardado'
              OR (estado = 'activo' AND vence_en <= NOW())
              OR (estado = 'espera' AND NOT EXISTS (
                    SELECT 1 FROM potenciadores a WHERE a.usuario_id = $1 AND a.estado = 'activo' AND a.vence_en > NOW())))
      ) AS hay`,
    [usuarioId],
  );
  return rows[0]?.hay === true;
}

/** El activo (con los segundos del reloj de la base, RNF-GAM-12) y cuántos esperan. Lo usan el progreso y el menú. */
export async function leerPotenciadores(client: Consulta, usuarioId: number | string): Promise<ResumenDePotenciadores> {
  const { rows } = await client.query<{ estado: string; bonificacion: number; duracion_minutos: number; segundos: number | null }>(
    `SELECT estado, bonificacion::float8 AS bonificacion, duracion_minutos,
            CASE WHEN estado = 'activo' THEN GREATEST(0, EXTRACT(EPOCH FROM (vence_en - NOW())))::int END AS segundos
     FROM potenciadores
     WHERE usuario_id = $1 AND estado IN ('activo', 'espera', 'guardado')`,
    [usuarioId],
  );
  const activo = rows.find((f) => f.estado === "activo" && (f.segundos ?? 0) > 0);
  return {
    activo: activo
      ? { bonificacion: activo.bonificacion, duracionMinutos: activo.duracion_minutos, segundosRestantes: activo.segundos ?? 0 }
      : null,
    enEspera: rows.filter((f) => f.estado === "espera" || f.estado === "guardado").length,
  };
}

/**
 * Potenciadores para el menú lateral (2026-11-23): mantiene la cola como presente (la persona tiene la app abierta) y
 * los lee. null si no tiene progreso o algo falla: el menú simplemente no los muestra.
 */
export async function obtenerPotenciadores(usuarioId: number | string): Promise<ResumenDePotenciadores | null> {
  try {
    // Casi siempre no hay nada que cambiar: se lee directo, sin transacción.
    if (!(await hayQueMantener(usuarioId))) return await leerPotenciadores(pool, usuarioId);
  } catch (error) {
    console.error(`Error leyendo los potenciadores del usuario ${usuarioId}`, error);
    return null;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bloqueo = await client.query(`SELECT 1 FROM usuario_progreso WHERE usuario_id = $1 FOR UPDATE`, [usuarioId]);
    if (bloqueo.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    await mantenerPotenciadores(client, usuarioId, true);
    const potenciadores = await leerPotenciadores(client, usuarioId);
    await client.query("COMMIT");
    return potenciadores;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`Error leyendo los potenciadores del usuario ${usuarioId}`, error);
    return null;
  } finally {
    client.release();
  }
}

async function leerInventario(client: Consulta, usuarioId: number | string): Promise<Inventario> {
  const { rows } = await client.query<{ protectores: number; activo: boolean; espera: number }>(
    `SELECT p.protectores,
            EXISTS (SELECT 1 FROM potenciadores WHERE usuario_id = $1 AND estado = 'activo') AS activo,
            (SELECT COUNT(*)::int FROM potenciadores WHERE usuario_id = $1 AND estado IN ('espera', 'guardado')) AS espera
      FROM usuario_progreso p WHERE p.usuario_id = $1`,
    [usuarioId],
  );
  const fila = rows[0];
  return { protectores: fila?.protectores ?? 0, potenciadorActivo: !!fila?.activo, potenciadoresEnEspera: fila?.espera ?? 0 };
}

function cabe(objeto: ObjetoDeMision, inventario: Inventario): boolean {
  if (objeto === "protector") return inventario.protectores < MAXIMO_DE_PROTECTORES;
  return Number(inventario.potenciadorActivo) + inventario.potenciadoresEnEspera < MAXIMO_DE_POTENCIADORES;
}

/** Mete el objeto al inventario. Supone que cabe (cabe()). La clave de idempotencia evita un segundo potenciador. */
async function guardarObjeto(
  client: Consulta,
  usuarioId: number | string,
  objeto: ObjetoDeMision,
  instanciaId: string,
  presente: boolean,
): Promise<void> {
  if (objeto === "protector") {
    await client.query(`UPDATE usuario_progreso SET protectores = protectores + 1, actualizado_en = NOW() WHERE usuario_id = $1`, [usuarioId]);
    return;
  }
  // Sin la persona en la app se guarda; con ella entra a la cola y, si no hay otro activo, se activa al momento con su
  // duración de la tabla (RF-GAM-33, 34).
  await client.query(
    `INSERT INTO potenciadores (usuario_id, estado, origen, obtenido_en, clave_idempotencia)
      VALUES ($1, $2::varchar, 'mision', NOW(), $3)
      ON CONFLICT (clave_idempotencia) DO NOTHING`,
    [usuarioId, presente ? "espera" : "guardado", `mision:${instanciaId}`],
  );
  if (presente) await mantenerPotenciadores(client, usuarioId, true);
}

type Pendiente = { id: string; mision: string; objeto: ObjetoDeMision };

/**
 * Difíciles asignadas antes del 19 nov y completadas sin objeto guardado: se sortea con la misma semilla que al asignar
 * y se guarda, para que se entreguen como las demás (corrección del 2026-11-20).
 */
async function repararObjetosSinSortear(client: Consulta, usuarioId: number | string): Promise<void> {
  const { rows } = await client.query<{ id: string; clave: string; inicio: number }>(
    `SELECT i.id::text AS id, m.clave, (EXTRACT(EPOCH FROM i.periodo_inicio) * 1000)::float8 AS inicio
      FROM mision_instancias i JOIN misiones m ON m.id = i.mision_id
      WHERE i.usuario_id = $1 AND i.completada_en IS NOT NULL AND i.recompensa IS NULL
        AND i.recompensa_entregada_en IS NULL AND i.recompensa_resultado IS NULL AND m.recompensa->>'tipo' = 'sorteo'`,
    [usuarioId],
  );
  for (const fila of rows) {
    const objeto = sortearObjeto(semillaDelObjeto(usuarioId, fila.clave, fila.inicio), DIFICILES_DEL_CATALOGO.pesosDelSorteo);
    await client.query(`UPDATE mision_instancias SET recompensa = $2::jsonb WHERE id = $1 AND recompensa IS NULL`, [
      fila.id,
      JSON.stringify({ tipo: objeto }),
    ]);
  }
}

/** Misiones completadas cuyo objeto aún no se entrega ni se decidió. */
async function objetosPendientes(client: Consulta, usuarioId: number | string): Promise<Pendiente[]> {
  await repararObjetosSinSortear(client, usuarioId);
  const { rows } = await client.query<{ id: string; mision: string; recompensa: unknown }>(
    `SELECT i.id::text AS id, m.nombre AS mision, i.recompensa
      FROM mision_instancias i JOIN misiones m ON m.id = i.mision_id
      WHERE i.usuario_id = $1 AND i.completada_en IS NOT NULL AND i.recompensa_entregada_en IS NULL
        AND i.recompensa_resultado IS NULL AND i.recompensa->>'tipo' = ANY($2::text[])
      ORDER BY i.completada_en, i.id`,
    [usuarioId, [...OBJETOS_DE_MISION]],
  );
  return rows.flatMap((r) => {
    const recompensa = recompensaDesde(r.recompensa);
    return recompensa?.tipo === "potenciador" || recompensa?.tipo === "protector" ? [{ id: r.id, mision: r.mision, objeto: recompensa.tipo }] : [];
  });
}

function marcar(client: Consulta, instanciaId: string, resultado: "entregada" | "cambiada" | "perdida") {
  return client.query(
    `UPDATE mision_instancias
        SET recompensa_resultado = $2::varchar, recompensa_entregada_en = CASE WHEN $2::varchar = 'perdida' THEN NULL ELSE NOW() END
      WHERE id = $1`,
    [instanciaId, resultado],
  );
}

/**
 * Entrega los objetos pendientes que caben y mantiene la cola de potenciadores. Devuelve los que no caben: esos se
 * deciden en la ventana. Nunca lanza.
 */
export async function entregarObjetosDeMisiones(usuarioId: number | string, opciones: { presente: boolean }): Promise<ObjetoPorDecidir[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bloqueo = await client.query(`SELECT 1 FROM usuario_progreso WHERE usuario_id = $1 FOR UPDATE`, [usuarioId]);
    if (bloqueo.rows.length === 0) {
      await client.query("ROLLBACK");
      return [];
    }
    await mantenerPotenciadores(client, usuarioId, opciones.presente);
    const porDecidir: ObjetoPorDecidir[] = [];
    for (const pendiente of await objetosPendientes(client, usuarioId)) {
      const inventario = await leerInventario(client, usuarioId);
      if (cabe(pendiente.objeto, inventario)) {
        await guardarObjeto(client, usuarioId, pendiente.objeto, pendiente.id, opciones.presente);
        await marcar(client, pendiente.id, "entregada");
        continue;
      }
      const alternativa = otro(pendiente.objeto);
      porDecidir.push({
        instanciaId: pendiente.id,
        mision: pendiente.mision,
        objeto: pendiente.objeto,
        alternativa: cabe(alternativa, inventario) ? alternativa : null,
        protectores: inventario.protectores,
        potenciadorActivo: inventario.potenciadorActivo,
        potenciadoresEnEspera: inventario.potenciadoresEnEspera,
      });
    }
    await client.query("COMMIT");
    return porDecidir;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`Error entregando los objetos del usuario ${usuarioId}`, error);
    return [];
  } finally {
    client.release();
  }
}

export type AccionSobreObjeto = "cambiar" | "rechazar";
export type ResultadoDeObjeto = "entregada" | "cambiada" | "perdida";

/**
 * La respuesta de la ventana. Se vuelve a mirar el inventario: si el objeto ya cabe, se entrega tal cual; si se pidió el
 * cambio y el otro cabe, se entrega el otro; si no, se pierde. null si no hay nada pendiente con ese id (ya se decidió).
 */
export async function decidirObjeto(
  usuarioId: number | string,
  instanciaId: string,
  accion: AccionSobreObjeto,
): Promise<ResultadoDeObjeto | null> {
  let resultado: ResultadoDeObjeto | null = null;
  let objetoPerdido: ObjetoDeMision | null = null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT 1 FROM usuario_progreso WHERE usuario_id = $1 FOR UPDATE`, [usuarioId]);
    await mantenerPotenciadores(client, usuarioId, true);
    const pendiente = (await objetosPendientes(client, usuarioId)).find((p) => p.id === instanciaId);
    if (!pendiente) {
      await client.query("ROLLBACK");
      return null;
    }
    const inventario = await leerInventario(client, usuarioId);
    if (cabe(pendiente.objeto, inventario)) {
      await guardarObjeto(client, usuarioId, pendiente.objeto, pendiente.id, true);
      resultado = "entregada";
    } else if (accion === "cambiar" && cabe(otro(pendiente.objeto), inventario)) {
      await guardarObjeto(client, usuarioId, otro(pendiente.objeto), pendiente.id, true);
      resultado = "cambiada";
    } else {
      resultado = "perdida";
      objetoPerdido = pendiente.objeto;
    }
    await marcar(client, pendiente.id, resultado);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`Error decidiendo el objeto ${instanciaId} del usuario ${usuarioId}`, error);
    return null;
  } finally {
    client.release();
  }
  // Aviso de RF-GAM-61 (protector o potenciador perdido).
  if (objetoPerdido) {
    await notificar({
      usuarioId: Number(usuarioId),
      tipo: "objeto_perdido",
      titulo: TEXTOS.inventario.perdidoTitulo(objetoPerdido),
      mensaje: TEXTOS.inventario.perdidoMensaje(objetoPerdido),
      enlace: "/progreso/misiones",
    });
  }
  return resultado;
}
