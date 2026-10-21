// "Reportar a supervisión" (antes "Reportar al creador"): el revisor o el creador (2026-10-19) reportan a quien envió un
// aporte. Desde el 2026-10-15 (a pedido del usuario) ya no avisa al creador de la campaña: el reporte entra
// a la bandeja de Reportes de la supervisión (tabla `reportes`, tipo `aporte`, contra quien lo envió) y
// les llega a los supervisores como `reporte_nuevo`. Ahí se da el aviso o se descarta.
// Solo aportes con cuenta (los anónimos se marcan como inapropiados). Uno por aporte; se puede antes o
// después de decidirlo. El motivo también queda en el aporte (`aportes.reporte_*`). Desde el 2026-10-19
// reportar también rechaza el aporte (rechazarPorReporte). Lo usa POST /api/aportes/[id]/reportar.

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisarReporteASupervisores } from "@/lib/notificaciones/avisos-a-supervisores";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { MAXIMO_MOTIVO_DE_REPORTE } from "@/lib/aportes/motivos-de-rechazo";
import { recalcularContadores } from "@/lib/aportes/comun";

/**
 * Reportar un aporte lo rechaza (2026-10-19, a pedido del usuario): "Reportar a supervisión" y
 * "Reportar a quien aportó" (lib/reportes/reportes.ts), del revisor o del creador. Va dentro de la
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

export async function reportarASupervision(entrada: {
  aporteId: number;
  revisor: { id: number; nombre: string };
  motivo: unknown;
}): Promise<ResultadoDeReporte> {
  const motivo = typeof entrada.motivo === "string" ? entrada.motivo.trim() : "";
  if (!motivo) return { ok: false, status: 400, error: "Indica por qué reportas este aporte" };
  if (motivo.length > MAXIMO_MOTIVO_DE_REPORTE) {
    return { ok: false, status: 400, error: `El motivo no puede pasar de ${MAXIMO_MOTIVO_DE_REPORTE} caracteres` };
  }

  const { rows } = await pool.query<{ campaign_id: number; creator_id: number; user_id: number | null; es_revisor: boolean }>(
    `SELECT a.campaign_id, a.user_id, c.creator_id,
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
    // reporte_en IS NULL en el WHERE: uno por aporte, aunque dos revisores reporten a la vez.
    const guardado = await client.query(
      `UPDATE aportes SET reporte_motivo = $2, reporte_por = $3, reporte_en = NOW(), updated_at = NOW()
       WHERE id = $1 AND reporte_en IS NULL`,
      [entrada.aporteId, motivo, entrada.revisor.id]
    );
    if (guardado.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, status: 409, error: "Este aporte ya se reportó a supervisión" };
    }
    // A la bandeja. Si este revisor ya había usado "Reportar a quien aportó", ese reporte ya está ahí.
    await client.query(
      `INSERT INTO reportes (tipo, campana_id, aporte_id, reportado_id, reportado_por, descripcion)
       VALUES ('aporte', $1, $2, $3, $4, $5)
       ON CONFLICT (aporte_id, reportado_por) WHERE tipo = 'aporte' DO NOTHING`,
      [fila.campaign_id, entrada.aporteId, fila.user_id, entrada.revisor.id, motivo]
    );
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
    excluir: [Number(fila.creator_id)],
  });
  return { ok: true, rechazado: rechazo.rechazado };
}
