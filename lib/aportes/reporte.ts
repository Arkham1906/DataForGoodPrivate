// "Reportar aporte" (2026-11-07, a pedido del usuario: une "Reportar a supervisión" y "Reportar a quien
// aportó", que hacían lo mismo). El revisor o el creador reportan a quien envió un aporte. No avisa al
// creador de la campaña (2026-10-15): el reporte entra a la bandeja de Reportes de la supervisión (tabla
// `reportes`, tipo `aporte`, `origen = 'supervision'`, contra quien lo envió) y les llega a los supervisores
// como `reporte_nuevo`. Ahí se da el aviso o se descarta.
// Solo aportes con cuenta (los anónimos se marcan como inapropiados). **Uno por aporte**, sea quien sea quien
// lo reporte (decisión del usuario); se puede antes o después de decidirlo. Reportar también rechaza el
// aporte (rechazarPorReporte, 2026-10-19). Lo usa POST /api/aportes/[id]/reportar.

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisarReporteASupervisores } from "@/lib/notificaciones/avisos-a-supervisores";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { MAXIMO_DESCRIPCION_DE_REPORTE, MOTIVOS_DE_REPORTE_DE_APORTE } from "@/lib/reportes/motivos";
import { recalcularContadores } from "@/lib/aportes/comun";

/**
 * Reportar un aporte lo rechaza (2026-10-19, a pedido del usuario): "Reportar aporte"
 * (reportarASupervision), del revisor o del creador. Va dentro de la
 * transacción del reporte. Pendiente o aceptado pasa a rechazado (excepción a "la decisión no se cambia",
 * decidida por el usuario): deja de contar en la campaña y no sale en datos abiertos. Si la campaña ya
 * finalizó, sus datos ya se publicaron: solo queda el reporte. Uno ya rechazado no cambia.
 * Devuelve lo necesario para avisar a quien aportó después del COMMIT (avisarRechazoPorReporte).
 */
export async function rechazarPorReporte(
  client: Pick<PoolClient, "query">,
  entrada: { aporteId: number; motivo: string; actor: { id: number; nombre: string; esRevisor: boolean } },
): Promise<{ rechazado: boolean; usuarioId: number | null; campanaId: number; campanaNombre: string; motivo: string }> {
  const { rows } = await client.query<{ campaign_id: number; user_id: number | null; status: string; campana_status: string; campana_nombre: string }>(
    `SELECT a.campaign_id, a.user_id, a.status, c.status AS campana_status, c.name AS campana_nombre
     FROM aportes a JOIN campanas c ON c.id = a.campaign_id WHERE a.id = $1`,
    [entrada.aporteId],
  );
  const fila = rows[0];
  const motivo = `Reportado: ${entrada.motivo}`.slice(0, 500);
  const base = {
    rechazado: false,
    usuarioId: fila?.user_id == null ? null : Number(fila.user_id),
    campanaId: Number(fila?.campaign_id),
    campanaNombre: String(fila?.campana_nombre ?? ""),
    motivo,
  };
  if (!fila || fila.status === "rechazado" || fila.campana_status === "finalizada") return base;

  // Mismo candado que una decisión normal: el cambio y el recálculo de contadores van juntos.
  await client.query(`SELECT 1 FROM campanas WHERE id = $1 FOR NO KEY UPDATE`, [fila.campaign_id]);
  const cambio = await client.query(
    `UPDATE aportes SET status = 'rechazado', rejection_reason = $2,
            first_pass_by = CASE WHEN $4 THEN $3 ELSE first_pass_by END,
            first_pass_by_user_id = CASE WHEN $4 THEN $5::int ELSE first_pass_by_user_id END,
            reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status <> 'rechazado'`,
    [entrada.aporteId, motivo, entrada.actor.nombre, entrada.actor.esRevisor, entrada.actor.id],
  );
  if ((cambio.rowCount ?? 0) === 0) return base;
  await recalcularContadores(fila.campaign_id, client);
  return { ...base, rechazado: true };
}

/** Después del COMMIT: avisa a quien aportó que su aporte se rechazó (como un rechazo normal). */
export async function avisarRechazoPorReporte(r: Awaited<ReturnType<typeof rechazarPorReporte>>, aporteId: number): Promise<void> {
  if (!r.rechazado || r.usuarioId === null) return;
  await notificar({
    usuarioId: r.usuarioId,
    tipo: "aporte_rechazado",
    titulo: "Aporte rechazado",
    mensaje: `Tu aporte en "${r.campanaNombre}" fue rechazado. Motivo: ${r.motivo}`,
    campanaId: r.campanaId,
    enlace: `/mis-aportes/${r.campanaId}`,
    metadata: { aporteId: String(aporteId), motivo: r.motivo },
  });
}

export type ResultadoDeReporte =
  | { ok: true; rechazado: boolean }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

/**
 * Motivo de MOTIVOS_DE_REPORTE_DE_APORTE y/o descripción; al menos uno. Un `motivo` que no está en la
 * lista se toma como descripción (así llegaba antes, redactado o "lista — detalle").
 */
function motivoYDescripcion(motivoCrudo: unknown, descripcionCruda: unknown): { motivo: string; descripcion: string } | { error: string } {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  let motivo = texto(motivoCrudo);
  let descripcion = texto(descripcionCruda);
  if (motivo && !MOTIVOS_DE_REPORTE_DE_APORTE.includes(motivo)) {
    descripcion = [motivo, descripcion].filter(Boolean).join(" — ");
    motivo = "";
  }
  if (!motivo && !descripcion) return { error: "Elige un motivo o describe por qué reportas este aporte" };
  if (descripcion.length > MAXIMO_DESCRIPCION_DE_REPORTE) {
    return { error: `La descripción no puede pasar de ${MAXIMO_DESCRIPCION_DE_REPORTE} caracteres` };
  }
  return { motivo, descripcion };
}

export async function reportarASupervision(entrada: {
  aporteId: number;
  revisor: { id: number; nombre: string };
  motivo: unknown;
  descripcion?: unknown;
}): Promise<ResultadoDeReporte> {
  const validado = motivoYDescripcion(entrada.motivo, entrada.descripcion);
  if ("error" in validado) return { ok: false, status: 400, error: validado.error };
  const { motivo: motivoDeLista, descripcion } = validado;
  // Lo que ve quien aportó como motivo del rechazo y los supervisores en el aviso.
  const motivo = [motivoDeLista, descripcion].filter(Boolean).join(" — ");

  const { rows } = await pool.query<{
    campaign_id: number;
    creator_id: number;
    user_id: number | null;
    supervisor_id: number | null;
    es_revisor: boolean;
  }>(
    `SELECT a.campaign_id, a.user_id, c.creator_id, c.supervisor_id,
            EXISTS (SELECT 1 FROM campana_revisores r
                    WHERE r.campana_id = a.campaign_id AND r.usuario_id = $2 AND r.estado = 'aceptado') AS es_revisor
     FROM aportes a JOIN campanas c ON c.id = a.campaign_id
     WHERE a.id = $1`,
    [entrada.aporteId, entrada.revisor.id]
  );
  const fila = rows[0];
  if (!fila) return { ok: false, status: 404, error: "Aporte no encontrado" };
  // Desde el 2026-10-19 también el creador (él también revisa aportes).
  const esCreador = Number(fila.creator_id) === entrada.revisor.id;
  if (!fila.es_revisor && !esCreador) {
    return { ok: false, status: 403, error: "Solo quien creó la campaña o un revisor puede reportar un aporte a supervisión" };
  }
  if (fila.user_id == null) {
    return { ok: false, status: 400, error: "Un aporte sin cuenta no se reporta: márcalo como inapropiado" };
  }
  if (Number(fila.user_id) === entrada.revisor.id) {
    return { ok: false, status: 403, error: "No puedes reportar tu propio aporte" };
  }

  const client = await pool.connect();
  let rechazo: Awaited<ReturnType<typeof rechazarPorReporte>>;
  try {
    await client.query("BEGIN");
    // Uno por aporte (2026-11-07, decisión del usuario), también contra los reportes de antes que hizo
    // "Reportar a quien aportó" (origen 'usuario', uno por persona). Si dos personas reportan a la vez, lo
    // cuida el índice único reportes_aporte_uno_a_supervision (23505).
    const previo = await client.query(`SELECT 1 FROM reportes WHERE tipo = 'aporte' AND aporte_id = $1 LIMIT 1`, [
      entrada.aporteId,
    ]);
    let guardado = { rowCount: 0 as number | null };
    if (!previo.rowCount) {
      try {
        guardado = await client.query(
          `INSERT INTO reportes (tipo, campana_id, aporte_id, reportado_id, reportado_por, motivo, descripcion, origen)
           VALUES ('aporte', $1, $2, $3, $4, $5, $6, 'supervision')`,
          [fila.campaign_id, entrada.aporteId, fila.user_id, entrada.revisor.id, motivoDeLista || null, descripcion || null]
        );
      } catch (error) {
        if ((error as { code?: string }).code !== "23505") throw error;
      }
    }
    if (!guardado.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, status: 409, error: "Este aporte ya se reportó" };
    }
    rechazo = await rechazarPorReporte(client, {
      aporteId: entrada.aporteId,
      motivo,
      actor: { id: entrada.revisor.id, nombre: entrada.revisor.nombre, esRevisor: !esCreador },
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  await registrarAuditoria({
    actor: { tipo: "usuario", id: entrada.revisor.id },
    accion: "aporte.reportar",
    objetivo: { tipo: "aporte", id: entrada.aporteId },
    detalle: { campanaId: fila.campaign_id, motivo, rechazado: rechazo.rechazado },
  });
  await avisarRechazoPorReporte(rechazo, entrada.aporteId);
  avisarReporteASupervisores({
    tipo: "aporte",
    campanaId: Number(fila.campaign_id),
    aporteId: entrada.aporteId,
    reportadoId: Number(fila.user_id),
    reportadoPor: entrada.revisor.id,
    motivo,
    supervisorId: fila.supervisor_id === null ? null : Number(fila.supervisor_id),
    excluir: [Number(fila.creator_id)],
  });
  return { ok: true, rechazado: rechazo.rechazado };
}
