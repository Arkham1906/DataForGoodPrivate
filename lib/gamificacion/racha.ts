// Racha de cada persona (2026-11-04; SRS v1.3: RF-GAM-25, 27, 31, 85, 86), sin protectores. actualizarRacha() recalcula
// desde los días con aportes y guarda racha_dias, racha_eventos y usuario_progreso, así que repetirla no cambia nada
// (RF-GAM-08). La llama el envío de un aporte: la revisión ya no afecta a la racha. revisarRachas() corre en
// instrumentation-node.ts para lo que pasa solo con el tiempo: los días sin aportes.
//
// Los aportes anónimos no tienen user_id: no cuentan (RN-GAM-26). Tampoco los anteriores al arranque de la gamificación
// para la persona, usuario_progreso.creado_en: sin racha retroactiva (RF-GAM-66).
// Pendiente: un cambio de racha debe evaluar el ascenso de rango (RF-GAM-18), y ese proceso aún no existe.

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS, hoyEnTepic } from "@/lib/fecha-de-tepic";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { calcularRacha, diaDeRuptura, sumarDias } from "./racha-reglas";

const USUARIOS_POR_REVISION = 500;

function registrarInterrupcion(client: Pick<PoolClient, "query">, usuarioId: number | string, dia: string) {
  return client.query(
    `INSERT INTO racha_eventos (usuario_id, tipo, dia, clave_idempotencia)
     VALUES ($1, 'racha_interrumpida', $2::date, $3)
     ON CONFLICT (clave_idempotencia) DO NOTHING`,
    [usuarioId, dia, `racha:interrumpida:${usuarioId}:${dia}`],
  );
}

/** Nunca lanza: un fallo aquí no debe tumbar el envío del aporte; revisarRachas() lo corrige en su siguiente pasada. */
export async function actualizarRacha(usuarioId: number | string): Promise<void> {
  let diasPerdidos = 0;
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
      await registrarInterrupcion(client, usuarioId, ruptura);
    }

    const maxima = Math.max(progreso.racha_maxima, racha.mayor);
    if (racha.actual !== progreso.racha_actual || maxima !== progreso.racha_maxima || racha.ultimoDia !== progreso.ultimo) {
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
