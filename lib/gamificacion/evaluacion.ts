// Evaluación del progreso (2026-11-09; SRS v1.3: RF-GAM-18 a 21, 46 a 49, 61, 62, 81, 83, 84). Tras cualquier
// cambio relevante (aporte aceptado, misión completada, cambio de racha) comprueba si la persona sube de rango y si
// alguna medalla sube de nivel, y lo registra. Es idempotente: repetirla con el mismo estado no cambia nada, así que
// se puede llamar de más sin riesgo (RF-GAM-08). Rangos y niveles alcanzados no se retiran (RF-GAM-21, 47).

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { notificar, type NuevaNotificacion } from "@/lib/notificaciones/notificaciones";
import { leerParametros } from "./parametros";
import { mayorSecuenciaSinRechazo, nivelPorValor, type MedidaDeMedalla, type NivelDeMedalla } from "./medallas";
import { rutaDePantalla } from "./pantallas-de-progreso";

type Consultor = Pick<PoolClient, "query">;

/** Lo que mide cada medalla (columna `medallas.mide`) → su valor actual para la persona. */
export type ValoresDeMedallas = Record<string, number>;

export async function valoresDeMedallas(client: Consultor, usuarioId: number | string): Promise<ValoresDeMedallas> {
  const progresoR = await client.query<{
    exp_total: number;
    aportes_aceptados: number;
    aportes_excepcionales: number;
    racha_maxima: number;
    campanas_completadas: number;
  }>(
    `SELECT exp_total, aportes_aceptados, aportes_excepcionales, racha_maxima, campanas_completadas
      FROM usuario_progreso WHERE usuario_id = $1`,
    [usuarioId],
  );
  const contadoresR = await client.query<{ dimension: string; cuantos: number }>(
    `SELECT dimension, COUNT(*)::int AS cuantos FROM usuario_contadores
      WHERE usuario_id = $1 AND valor > 0 GROUP BY dimension`,
    [usuarioId],
  );
  const recuperadasR = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM racha_eventos WHERE usuario_id = $1 AND tipo = 'racha_recuperada'`,
    [usuarioId],
  );
  // Carga Máxima: los aportes aceptados (con EXP) enviados dentro de la vigencia de un mismo potenciador; el mayor.
  const potenciadorR = await client.query<{ n: number }>(
    `SELECT COALESCE(MAX(n), 0)::int AS n FROM (
        SELECT p.id, COUNT(a.id) AS n
        FROM potenciadores p
        JOIN aportes a ON a.user_id = p.usuario_id AND a.status = 'aceptado' AND a.exp_otorgada > 0
                      AND a.submitted_at >= p.activado_en AND a.submitted_at < p.vence_en
        WHERE p.usuario_id = $1 AND p.activado_en IS NOT NULL
        GROUP BY p.id
      ) por_potenciador`,
    [usuarioId],
  );
  // Pulso Firme: decisiones tomadas desde el lanzamiento (RF-GAM-67), en orden de envío.
  const parametros = await leerParametros(client);
  const decisionesR = parametros?.lanzamiento
    ? await client.query<{ status: "aceptado" | "rechazado" }>(
        `SELECT status FROM aportes
          WHERE user_id = $1 AND status IN ('aceptado', 'rechazado') AND reviewed_at >= $2
          ORDER BY submitted_at, id`,
        [usuarioId, parametros.lanzamiento.toISOString()],
      )
    : { rows: [] };

  const p = progresoR.rows[0];
  const contador = (dimension: string) => contadoresR.rows.find((c) => c.dimension === dimension)?.cuantos ?? 0;
  return {
    aportes_aceptados: p?.aportes_aceptados ?? 0,
    aportes_excepcionales: p?.aportes_excepcionales ?? 0,
    racha_maxima: p?.racha_maxima ?? 0,
    campanas_completadas: p?.campanas_completadas ?? 0,
    exp_total: p?.exp_total ?? 0,
    campanas_distintas: contador("campana"),
    tipos_distintos: contador("tipo"),
    tematicas_distintas: contador("tematica"),
    rachas_recuperadas: recuperadasR.rows[0]?.n ?? 0,
    aportes_en_potenciador: potenciadorR.rows[0]?.n ?? 0,
    aceptados_consecutivos: mayorSecuenciaSinRechazo(decisionesR.rows.map((d) => d.status)),
    // Si se agrega una medida a MEDIDAS_DE_MEDALLA sin su cálculo, esto no compila.
  } satisfies Record<MedidaDeMedalla, number>;
}

type FilaDeRango = {
  numero: number;
  nombre: string;
  etapa_avatar: number | null;
  req_exp: number;
  req_aportes: number;
  req_excelentes: number;
  req_excepcionales: number;
  req_racha: number;
  req_misiones: number;
};

/** Sube los rangos que ya se cumplen, uno tras otro (RF-GAM-18 a 20). Avisa del último. */
async function evaluarRango(client: Consultor, usuarioId: number | string): Promise<NuevaNotificacion[]> {
  const { rows } = await client.query<{
    rango_actual: number;
    exp_total: number;
    aportes_aceptados: number;
    aportes_excelentes: number;
    aportes_excepcionales: number;
    racha_actual: number;
    misiones_completadas: number;
  }>(
    `SELECT rango_actual, exp_total, aportes_aceptados, aportes_excelentes, aportes_excepcionales, racha_actual,
            misiones_completadas
      FROM usuario_progreso WHERE usuario_id = $1`,
    [usuarioId],
  );
  const p = rows[0];
  if (!p) return [];
  const { rows: rangos } = await client.query<FilaDeRango>(
    `SELECT numero, nombre, etapa_avatar, req_exp, req_aportes, req_excelentes, req_excepcionales, req_racha, req_misiones
      FROM rangos WHERE numero > $1 ORDER BY numero`,
    [p.rango_actual],
  );

  // Todos los requisitos a la vez; la racha es la actual en este momento (RF-GAM-18, 19; RN-GAM-07).
  const cumple = (r: FilaDeRango) =>
    p.exp_total >= r.req_exp &&
    p.aportes_aceptados >= r.req_aportes &&
    p.aportes_excelentes >= r.req_excelentes &&
    p.aportes_excepcionales >= r.req_excepcionales &&
    p.racha_actual >= r.req_racha &&
    p.misiones_completadas >= r.req_misiones;

  const alcanzados: FilaDeRango[] = [];
  for (const r of rangos) {
    if (r.numero !== p.rango_actual + alcanzados.length + 1 || !cumple(r)) break;
    alcanzados.push(r);
  }
  if (alcanzados.length === 0) return [];

  for (const r of alcanzados) {
    // Lo que se pidió queda guardado: cambiar el catálogo después no altera este ascenso (RF-GAM-64, 83).
    const requisitos = {
      exp: r.req_exp,
      aportes: r.req_aportes,
      excelentes: r.req_excelentes,
      excepcionales: r.req_excepcionales,
      racha: r.req_racha,
      misiones: r.req_misiones,
    };
    const recompensas: Record<string, unknown>[] = [
      { tipo: "etapa_avatar", etapa: r.etapa_avatar ?? r.numero },
      { tipo: "insignia", rango: r.numero },
    ];
    const objeto = await client.query<{ id: number; nombre: string }>(
      `SELECT id, nombre FROM objetos WHERE rango_exclusivo = $1 AND activo`,
      [r.numero],
    );
    if (objeto.rows[0]) recompensas.push({ tipo: "coleccionable", objetoId: objeto.rows[0].id, nombre: objeto.rows[0].nombre });
    await client.query(
      `INSERT INTO rango_ascensos (usuario_id, rango, requisitos, recompensas)
        VALUES ($1, $2, $3::jsonb, $4::jsonb)
        ON CONFLICT (usuario_id, rango) DO NOTHING`,
      [usuarioId, r.numero, JSON.stringify(requisitos), JSON.stringify(recompensas)],
    );
  }
  const final = alcanzados[alcanzados.length - 1];
  await client.query(
    `UPDATE usuario_progreso SET rango_actual = GREATEST(rango_actual, $2), actualizado_en = NOW() WHERE usuario_id = $1`,
    [usuarioId, final.numero],
  );

  // Reconoce el esfuerzo, sin presionar (RF-GAM-62).
  const mensaje =
    alcanzados.length === 1
      ? `Alcanzaste el rango ${final.numero}, ${final.nombre}. Es tuyo para siempre.`
      : `Subiste ${alcanzados.length} rangos de una vez y llegaste al ${final.numero}, ${final.nombre}. Son tuyos para siempre.`;
  return [
    {
      usuarioId,
      tipo: "rango_ascenso",
      titulo: "Subiste de rango",
      mensaje,
      enlace: rutaDePantalla("trayectoria") ?? "/progreso",
      metadata: { rango: final.numero, rangos: alcanzados.map((r) => r.numero) },
    },
  ];
}

/** Registra los niveles de medalla nuevos (RF-GAM-46, 47) y guarda el valor de las que ya tienen nivel. */
async function evaluarMedallas(client: Consultor, usuarioId: number | string): Promise<NuevaNotificacion[]> {
  const { rows: medallas } = await client.query<{
    id: number;
    clave: string;
    nombre: string;
    mide: string;
    nivel: number;
    valor_guardado: number | null;
  }>(
    `SELECT m.id, m.clave, m.nombre, m.mide, COALESCE(mu.nivel_actual, 0)::int AS nivel, mu.valor_actual AS valor_guardado
      FROM medallas m
      LEFT JOIN medallas_usuario mu ON mu.medalla_id = m.id AND mu.usuario_id = $1
      WHERE m.activa AND m.clave IS NOT NULL AND m.mide IS NOT NULL
      ORDER BY m.id`,
    [usuarioId],
  );
  if (medallas.length === 0) return [];
  const { rows: niveles } = await client.query<NivelDeMedalla & { medalla_id: number }>(
    `SELECT medalla_id, nivel, nombre, umbral FROM medalla_niveles ORDER BY medalla_id, nivel`,
  );
  const valores = await valoresDeMedallas(client, usuarioId);

  const avisos: NuevaNotificacion[] = [];
  for (const m of medallas) {
    const valor = valores[m.mide] ?? 0;
    const suyos = niveles.filter((n) => n.medalla_id === m.id);
    const alcanzado = nivelPorValor(valor, suyos);
    if (alcanzado > m.nivel) {
      await client.query(
        `INSERT INTO medallas_usuario (usuario_id, medalla_id, nivel_actual, valor_actual, actualizado_en)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (usuario_id, medalla_id) DO UPDATE
            SET nivel_actual = GREATEST(medallas_usuario.nivel_actual, EXCLUDED.nivel_actual),
                valor_actual = EXCLUDED.valor_actual, actualizado_en = NOW()`,
        [usuarioId, m.id, alcanzado, valor],
      );
      // Uno por nivel, también los intermedios: cada uno tiene su fecha y su celebración (RF-GAM-84).
      for (let nivel = m.nivel + 1; nivel <= alcanzado; nivel++) {
        await client.query(
          `INSERT INTO medalla_ascensos (usuario_id, medalla_id, nivel) VALUES ($1, $2, $3)
            ON CONFLICT (usuario_id, medalla_id, nivel) DO NOTHING`,
          [usuarioId, m.id, nivel],
        );
      }
      const nombreDelNivel = suyos.find((n) => n.nivel === alcanzado)?.nombre ?? `Nivel ${alcanzado}`;
      avisos.push({
        usuarioId,
        tipo: "medalla_nivel",
        titulo: `Medalla ${m.nombre}`,
        mensaje: `Llegaste a ${nombreDelNivel}. Este nivel es tuyo para siempre.`,
        enlace: rutaDePantalla("medallas") ?? "/progreso",
        metadata: { medalla: m.clave, nivel: alcanzado },
      });
    } else if (m.valor_guardado !== null && m.valor_guardado !== valor) {
      await client.query(
        `UPDATE medallas_usuario SET valor_actual = $3, actualizado_en = NOW() WHERE usuario_id = $1 AND medalla_id = $2`,
        [usuarioId, m.id, valor],
      );
    }
  }
  return avisos;
}

/**
 * Rango primero y medallas después: un ascenso no cambia lo que miden las medallas, pero así el orden de los avisos
 * es el mismo siempre. El llamador ya bloqueó usuario_progreso de la persona (FOR UPDATE).
 */
export async function evaluarProgreso(client: Consultor, usuarioId: number | string): Promise<NuevaNotificacion[]> {
  const avisosDeRango = await evaluarRango(client, usuarioId);
  const avisosDeMedallas = await evaluarMedallas(client, usuarioId);
  return [...avisosDeRango, ...avisosDeMedallas];
}

/** Después del COMMIT. notificar() nunca lanza. */
export async function enviarAvisos(avisos: readonly NuevaNotificacion[]): Promise<void> {
  for (const aviso of avisos) await notificar(aviso);
}

/** Con su propia transacción. Nunca lanza: un fallo aquí no debe tumbar lo que la llamó; la siguiente actividad lo repite. */
export async function evaluarProgresoDe(usuarioId: number | string): Promise<void> {
  let avisos: NuevaNotificacion[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bloqueo = await client.query(`SELECT 1 FROM usuario_progreso WHERE usuario_id = $1 FOR UPDATE`, [usuarioId]);
    if (bloqueo.rows.length === 0) {
      await client.query("ROLLBACK");
      return;
    }
    avisos = await evaluarProgreso(client, usuarioId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`Error evaluando el progreso del usuario ${usuarioId}`, error);
    return;
  } finally {
    client.release();
  }
  await enviarAvisos(avisos);
}
