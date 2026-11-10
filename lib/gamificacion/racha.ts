// Racha de cada persona (2026-11-04; SRS v1.3: RF-GAM-25, 27, 31, 85, 86), sin protectores. actualizarRacha() recalcula
// desde los días con aportes y guarda racha_dias, racha_eventos y usuario_progreso, así que repetirla no cambia nada
// (RF-GAM-08). La llama el envío de un aporte: la revisión ya no afecta a la racha. revisarRachas() corre en
// instrumentation-node.ts para lo que pasa solo con el tiempo: los días sin aportes.
//
// Los aportes anónimos no tienen user_id: no cuentan (RN-GAM-26). Tampoco los anteriores al arranque de la gamificación
// para la persona, usuario_progreso.creado_en: sin racha retroactiva (RF-GAM-66).
//
// Fénix (2026-11-09, decisión del responsable): cuando la racha se pierde y un aporte la reaviva, se registra un evento
// racha_recuperada, uno por cada interrupción (su clave lleva el día de la interrupción). Si la racha cambió, al final
// se evalúan rango y medallas (RF-GAM-18, 47; lib/gamificacion/evaluacion.ts).

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS, ahoraEnZona, hoyEnTepic } from "@/lib/fecha-de-tepic";
import { SQL_SANCION_BLOQUEANTE } from "@/lib/sanciones";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { evaluarProgresoDe } from "./evaluacion";
import { RACHA_PERDIDA_MINIMA_PARA_FENIX } from "./medallas";
import { calcularRacha, diaDeRuptura, sumarDias } from "./racha-reglas";

const USUARIOS_POR_REVISION = 500;

function registrarInterrupcion(client: Pick<PoolClient, "query">, usuarioId: number | string, dia: string, dias: number) {
  return client.query(
    `INSERT INTO racha_eventos (usuario_id, tipo, dia, detalle, clave_idempotencia)
      VALUES ($1, 'racha_interrumpida', $2::date, $3::jsonb, $4)
      ON CONFLICT (clave_idempotencia) DO NOTHING`,
    [usuarioId, dia, JSON.stringify({ dias }), `racha:interrumpida:${usuarioId}:${dia}`],
  );
}

/**
 * Si la racha actual empezó después de la última interrupción, un aporte la reavivó: se registra una vez por
 * interrupción. Devuelve true si se registró ahora. Las interrupciones de antes del 2026-11-09 no guardan cuántos días
 * se perdieron: cuentan como si alcanzaran el mínimo.
 */
async function registrarRecuperacion(
  client: Pick<PoolClient, "query">,
  usuarioId: number | string,
  inicioDeLaRacha: string,
): Promise<boolean> {
  const { rows } = await client.query<{ dia: string; dias: number }>(
    `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, COALESCE((detalle->>'dias')::int, $3) AS dias
      FROM racha_eventos
      WHERE usuario_id = $1 AND tipo = 'racha_interrumpida' AND dia < $2::date
      ORDER BY dia DESC
      LIMIT 1`,
    [usuarioId, inicioDeLaRacha, RACHA_PERDIDA_MINIMA_PARA_FENIX],
  );
  const interrupcion = rows[0];
  if (!interrupcion || interrupcion.dias < RACHA_PERDIDA_MINIMA_PARA_FENIX) return false;
  const nuevo = await client.query(
    `INSERT INTO racha_eventos (usuario_id, tipo, dia, detalle, clave_idempotencia)
      VALUES ($1, 'racha_recuperada', $2::date, $3::jsonb, $4)
      ON CONFLICT (clave_idempotencia) DO NOTHING
      RETURNING id`,
    [
      usuarioId,
      inicioDeLaRacha,
      JSON.stringify({ interrupcion: interrupcion.dia, diasPerdidos: interrupcion.dias }),
      `racha:recuperada:${usuarioId}:${interrupcion.dia}`,
    ],
  );
  return nuevo.rows.length > 0;
}

/** Nunca lanza: un fallo aquí no debe tumbar el envío del aporte; revisarRachas() lo corrige en su siguiente pasada. */
export async function actualizarRacha(usuarioId: number | string): Promise<void> {
  let diasPerdidos = 0;
  let cambio = false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // El candado ordena dos actualizaciones simultáneas de la misma persona.
    const { rows } = await client.query<{ racha_actual: number; racha_maxima: number; ultimo: string | null; desde: string }>(
      `SELECT racha_actual, racha_maxima, to_char(ultimo_dia_activo, 'YYYY-MM-DD') AS ultimo,
              to_char(creado_en AT TIME ZONE $2, 'YYYY-MM-DD') AS desde
        FROM usuario_progreso WHERE usuario_id = $1 FOR UPDATE`,
      [usuarioId, ZONA_DE_CAMPANAS],
    );
    const progreso = rows[0];
    if (!progreso) {
      await client.query("ROLLBACK");
      return;
    }

    const aportesR = await client.query<{ dia: string }>(
      `SELECT DISTINCT to_char(submitted_at AT TIME ZONE $2, 'YYYY-MM-DD') AS dia
        FROM aportes
        WHERE user_id = $1 AND (submitted_at AT TIME ZONE $2)::date >= $3::date`,
      [usuarioId, ZONA_DE_CAMPANAS, progreso.desde],
    );
    const diasR = await client.query<{ dia: string; estado: string }>(
      `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, estado FROM racha_dias
        WHERE usuario_id = $1 AND estado IN ('confirmado', 'provisional')`,
      [usuarioId],
    );

    const hoy = hoyEnTepic();
    const racha = calcularRacha({
      diasConAporte: aportesR.rows.map((a) => a.dia),
      diasGuardados: diasR.rows.map((d) => d.dia),
      hoy,
    });
    const confirmados = new Set(diasR.rows.filter((d) => d.estado === "confirmado").map((d) => d.dia));
    for (const dia of racha.dias) {
      if (confirmados.has(dia)) continue;
      await client.query(
        `INSERT INTO racha_dias (usuario_id, dia, estado) VALUES ($1, $2::date, 'confirmado')
          ON CONFLICT (usuario_id, dia) DO UPDATE SET estado = 'confirmado', actualizado_en = NOW()`,
        [usuarioId, dia],
      );
    }

    const ruptura = diaDeRuptura({ rachaAnterior: progreso.racha_actual, ultimoDiaAnterior: progreso.ultimo, dias: racha.dias, hoy });
    if (ruptura) {
      diasPerdidos = progreso.racha_actual;
      await registrarInterrupcion(client, usuarioId, ruptura, progreso.racha_actual);
    }

    // Primer día de la racha actual: termina hoy o, si hoy aún no tiene aportes, ayer.
    if (racha.actual > 0) {
      const ultimoDeLaRacha = racha.dias.has(hoy) ? hoy : sumarDias(hoy, -1);
      if (await registrarRecuperacion(client, usuarioId, sumarDias(ultimoDeLaRacha, 1 - racha.actual))) cambio = true;
    }

    const maxima = Math.max(progreso.racha_maxima, racha.mayor);
    if (racha.actual !== progreso.racha_actual || maxima !== progreso.racha_maxima || racha.ultimoDia !== progreso.ultimo) {
      cambio = true;
      await client.query(
        `UPDATE usuario_progreso
          SET racha_actual = $2, racha_maxima = $3, ultimo_dia_activo = $4::date, actualizado_en = NOW()
          WHERE usuario_id = $1`,
        [usuarioId, racha.actual, maxima, racha.ultimoDia],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`Error actualizando la racha del usuario ${usuarioId}`, error);
    return;
  } finally {
    client.release();
  }

  // La racha actual es requisito de rango y la máxima y las recuperaciones miden medallas (RF-GAM-18, 47).
  if (cambio) await evaluarProgresoDe(usuarioId);

  // Aviso de RF-GAM-61, ya confirmado el cambio. Reconoce lo logrado: no presiona (RF-GAM-62).
  if (diasPerdidos > 0) {
    await notificar({
      usuarioId: Number(usuarioId),
      tipo: "racha_interrumpida",
      titulo: "Tu racha se interrumpió",
      mensaje: `Tu racha de ${diasPerdidos} ${diasPerdidos === 1 ? "día" : "días"} terminó. Tu rango y tus medallas no cambian.`,
      enlace: "/progreso",
    });
  }
}

/**
 * Personas cuya racha hay que recalcular sin que hayan enviado nada: pasó un día sin aportes, o quedó algo por corregir
 * (un envío cuya actualización falló, o un día provisional de la versión anterior). Corre en instrumentation-node.ts.
 */
export const HORA_DE_AVISOS_DE_RACHA = 1;
export const RACHA_MINIMA_PARA_AVISO = 2;
const DIAS_DE_ACCESO_PARA_INVITAR = 14

export async function avisarRachas(momento?: { hoy: string; hora: number }): Promise<void> {
  try {
    const hoy = momento?.hoy ?? hoyEnTepic();
    const hora = momento?.hora ?? ahoraEnZona().hour;
    if (hora < HORA_DE_AVISOS_DE_RACHA) return;
    const { rows } = await pool.query<{ usuario_id: number; racha_actual: number }>(
      `UPDATE usuario_progreso p SET aviso_racha_dia = $1::date
        WHERE p.usuario_id IN (
          SELECT p2.usuario_id
            FROM usuario_progreso p2
            JOIN usuarios u ON u.id = p2.usuario_id
            WHERE p2.aviso_racha_dia IS DISTINCT FROM $1::date
              AND p2.ultimo_dia_activo IS DISTINCT FROM $1::date
              AND u.baja_solicitada_en IS NULL AND u.eliminada_en IS NULL
              AND u.primer_inicio_sesion_en IS NOT NULL
              AND NOT ${SQL_SANCION_BLOQUEANTE}
              AND ((p2.racha_actual >= $3 AND p2.ultimo_dia_activo = $2::date)
                OR (p2.racha_actual = 0 AND EXISTS (
                      SELECT 1 FROM sessions s
                        WHERE s.usuario_id = u.id AND s.created_at >= NOW() - make_interval(days => $4))))
            LIMIT ${USUARIOS_POR_REVISION})
          AND p.aviso_racha_dia IS DISTINCT FROM $1::date
        RETURNING p.usuario_id, p.racha_actual`,
      [hoy, sumarDias(hoy, -1), RACHA_MINIMA_PARA_AVISO, DIAS_DE_ACCESO_PARA_INVITAR],
    );
    // Reconocen lo logrado, sin presionar (RF-GAM-62).
    for (const { usuario_id, racha_actual } of rows) {
      await notificar(
        racha_actual > 0
          ? {
              usuarioId: usuario_id,
              tipo: "racha_en_riesgo",
              titulo: "Tu racha sigue viva",
              mensaje: `Llevas ${racha_actual} días seguidos aportando. Un aporte hoy la mantiene.`,
              enlace: "/campanas",
              metadata: { racha: racha_actual },
            }
          : {
              usuarioId: usuario_id,
              tipo: "racha_por_empezar",
              titulo: "Empieza una racha",
              mensaje: "Un aporte hoy es tu primer día de racha. Cada día seguido suma.",
              enlace: "/campanas",
            },
      );
    }
  } catch (error) {
    console.error("Error mandando los avisos de racha", error);
  }
}

export async function revisarRachas(): Promise<void> {
  try {
    const hoy = hoyEnTepic();
    const { rows } = await pool.query<{ usuario_id: number }>(
      `SELECT usuario_id FROM usuario_progreso
        WHERE racha_actual > 0 AND (ultimo_dia_activo IS NULL OR ultimo_dia_activo < $1::date)
        UNION
        SELECT usuario_id FROM racha_dias WHERE estado = 'provisional'
        UNION
        SELECT a.user_id FROM aportes a
        JOIN usuario_progreso p ON p.usuario_id = a.user_id
        LEFT JOIN racha_dias d ON d.usuario_id = a.user_id AND d.dia = (a.submitted_at AT TIME ZONE $2)::date
        WHERE a.submitted_at >= NOW() - INTERVAL '2 days'
          AND (a.submitted_at AT TIME ZONE $2)::date >= (p.creado_en AT TIME ZONE $2)::date
          AND (d.estado IS NULL OR d.estado <> 'confirmado')
        LIMIT ${USUARIOS_POR_REVISION}`,
      [sumarDias(hoy, -1), ZONA_DE_CAMPANAS],
    );
    for (const { usuario_id } of rows) await actualizarRacha(usuario_id);
  } catch (error) {
    console.error("Error revisando las rachas", error);
  }
}
