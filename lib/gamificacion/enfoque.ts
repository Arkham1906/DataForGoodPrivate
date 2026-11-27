// Enfoque de la persona (RF-GAM-115, 116): leerlo y elegirlo. Tablas en lib/db-schema.ts (ensureEnfoquesTables).
// La espera para volver a cambiarlo se cuenta desde la última elección, con la hora de la base; el cliente solo la
// muestra. Mientras la persona no tiene enfoque no hay espera: la primera elección siempre se acepta.

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { ENFOQUES_DEL_CATALOGO } from "./catalogos";
import { medallaVisible } from "./medallas";
import { rutaDePantalla } from "./pantallas-de-progreso";
import { TEXTOS } from "./textos";
import type { EstadoDelEnfoque, OpcionDeEnfoque, ResultadoDeElegirEnfoque } from "./enfoque-tipos";

type Consulta = Pick<PoolClient, "query">;

const espera = ENFOQUES_DEL_CATALOGO.esperaParaCambiarDias;
/** Si enfoques.json no es válido, la tabla se queda como estaba (sincronizarEnfoques) y la espera vuelve a la del SRS. */
export const ESPERA_PARA_CAMBIAR_ENFOQUE_DIAS = Number.isInteger(espera) && espera >= 0 ? espera : 7;

type FilaDeEnfoque = OpcionDeEnfoque & { activo: boolean };

async function leerEstado(client: Consulta, usuarioId: number): Promise<EstadoDelEnfoque | null> {
  const usuario = await client.query<{ enfoque: string | null; elegido_en: Date | null; puede_desde: Date | null }>(
    `SELECT u.enfoque, c.elegido_en,
            CASE WHEN u.enfoque IS NOT NULL AND c.elegido_en + make_interval(days => $2::int) > NOW()
                 THEN c.elegido_en + make_interval(days => $2::int) END AS puede_desde
       FROM usuarios u
       LEFT JOIN LATERAL (
         SELECT elegido_en FROM enfoque_cambios WHERE usuario_id = u.id ORDER BY elegido_en DESC, id DESC LIMIT 1
       ) c ON true
      WHERE u.id = $1`,
    [usuarioId, ESPERA_PARA_CAMBIAR_ENFOQUE_DIAS],
  );
  const fila = usuario.rows[0];
  if (!fila) return null;
  const enfoques = await client.query<FilaDeEnfoque>(
    `SELECT clave, nombre, subtitulo, descripcion, activo FROM enfoques ORDER BY orden, clave`,
  );
  const opcion = ({ clave, nombre, subtitulo, descripcion }: FilaDeEnfoque): OpcionDeEnfoque => ({ clave, nombre, subtitulo, descripcion });
  const actual = enfoques.rows.find((e) => e.clave === fila.enfoque);
  return {
    actual: actual ? opcion(actual) : null,
    elegidoEn: actual && fila.elegido_en ? fila.elegido_en.toISOString() : null,
    puedeCambiarDesde: fila.puede_desde ? fila.puede_desde.toISOString() : null,
    esperaParaCambiarDias: ESPERA_PARA_CAMBIAR_ENFOQUE_DIAS,
    opciones: enfoques.rows.filter((e) => e.activo).map(opcion),
  };
}

export async function obtenerEstadoDelEnfoque(usuarioId: number): Promise<EstadoDelEnfoque | null> {
  return leerEstado(pool, usuarioId);
}

/**
 * Guarda el enfoque elegido. Elegir el mismo que ya se tiene no cuenta como cambio ni reinicia la espera.
 * La fila del usuario se bloquea para que dos envíos a la vez no se salten la espera.
 */
export async function elegirEnfoque(usuarioId: number, clave: string): Promise<ResultadoDeElegirEnfoque> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bloqueo = await client.query<{ enfoque: string | null }>(`SELECT enfoque FROM usuarios WHERE id = $1 FOR UPDATE`, [usuarioId]);
    const anterior = bloqueo.rows[0];
    if (!anterior) {
      await client.query("ROLLBACK");
      return { ok: false, motivo: "sin_cuenta" };
    }
    if (anterior.enfoque === clave) {
      const estado = await leerEstado(client, usuarioId);
      await client.query("COMMIT");
      return estado ? { ok: true, cambio: false, estado } : { ok: false, motivo: "sin_cuenta" };
    }
    const disponible = await client.query(`SELECT 1 FROM enfoques WHERE clave = $1 AND activo`, [clave]);
    if (disponible.rows.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, motivo: "no_disponible" };
    }
    const antes = await leerEstado(client, usuarioId);
    if (antes?.puedeCambiarDesde) {
      await client.query("ROLLBACK");
      return { ok: false, motivo: "en_espera", puedeCambiarDesde: antes.puedeCambiarDesde };
    }
    const elegidosAntes = await enfoquesElegidos(client, usuarioId);
    await client.query(`UPDATE usuarios SET enfoque = $2 WHERE id = $1`, [usuarioId, clave]);
    await client.query(`INSERT INTO enfoque_cambios (usuario_id, enfoque, anterior) VALUES ($1, $2, $3)`, [
      usuarioId,
      clave,
      anterior.enfoque,
    ]);
    const estado = await leerEstado(client, usuarioId);
    await client.query("COMMIT");
    if (!elegidosAntes.has(clave)) await avisarLogrosDesbloqueados(usuarioId, elegidosAntes, new Set([...elegidosAntes, clave]));
    return estado ? { ok: true, cambio: true, estado } : { ok: false, motivo: "sin_cuenta" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Opciones para la ventana de ShellDeUsuario, solo si la persona aún no tiene enfoque; null si ya lo tiene (o si falla
 * la lectura: la ventana no debe impedir usar la app). Casi siempre es una sola consulta corta.
 */
export async function opcionesSiFaltaEnfoque(usuarioId: number): Promise<OpcionDeEnfoque[] | null> {
  try {
    const { rows } = await pool.query<{ falta: boolean }>(`SELECT enfoque IS NULL AS falta FROM usuarios WHERE id = $1`, [usuarioId]);
    if (!rows[0]?.falta) return null;
    const estado = await leerEstado(pool, usuarioId);
    return estado && estado.opciones.length > 0 ? estado.opciones : null;
  } catch (error) {
    console.error(`Error revisando el enfoque del usuario ${usuarioId}`, error);
    return null;
  }
}

/** Enfoques que la persona ha tenido alguna vez: deciden qué logros de enfoque ve (medallaVisible en medallas.ts). */
export async function enfoquesElegidos(client: Consulta, usuarioId: number | string): Promise<Set<string>> {
  const { rows } = await client.query<{ enfoque: string }>(`SELECT DISTINCT enfoque FROM enfoque_cambios WHERE usuario_id = $1`, [usuarioId]);
  return new Set(rows.map((r) => r.enfoque));
}

/**
 * Aviso de los logros que aparecen con un enfoque nuevo (el de ese enfoque y, al tener todos, Tres Caminos). Va después
 * del COMMIT; notificar() no lanza y un fallo aquí no deshace la elección.
 */
async function avisarLogrosDesbloqueados(usuarioId: number, antes: ReadonlySet<string>, despues: ReadonlySet<string>): Promise<void> {
  try {
    const { rows } = await pool.query<{ clave: string; nombre: string; grupo: string | null; enfoque: string | null; mide: string | null; umbral: number | null }>(
      `SELECT m.clave, m.nombre, m.grupo, m.criterio->>'enfoque' AS enfoque, m.mide,
              (SELECT umbral FROM medalla_niveles n WHERE n.medalla_id = m.id AND n.nivel = 1) AS umbral
         FROM medallas m WHERE m.activa AND m.grupo = 'enfoque' ORDER BY m.orden NULLS LAST, m.id`,
    );
    const conLogro = new Set(rows.flatMap((m) => (m.enfoque ? [m.enfoque] : [])));
    const nuevos = rows.filter((m) => medallaVisible(m, despues, conLogro) && !medallaVisible(m, antes, conLogro));
    for (const m of nuevos) {
      const umbral = Number(m.umbral ?? 0);
      const meta = TEXTOS.medallas.meta(m.mide, umbral, TEXTOS.medallas.unidad(m.mide, umbral));
      await notificar({
        usuarioId,
        tipo: "medalla_nivel",
        titulo: TEXTOS.avisos.logroDesbloqueadoTitulo,
        mensaje: TEXTOS.avisos.logroDesbloqueado(m.nombre, meta),
        enlace: rutaDePantalla("medallas") ?? "/progreso",
        metadata: { medalla: m.clave, nivel: 0, desbloqueado: true },
      });
    }
  } catch (error) {
    console.error(`Error avisando los logros desbloqueados del usuario ${usuarioId}`, error);
  }
}
