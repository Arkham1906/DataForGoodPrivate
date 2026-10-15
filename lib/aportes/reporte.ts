// "Reportar a supervisión" (antes "Reportar al creador"): el revisor de aportes reporta a quien envió un
// aporte. Desde el 2026-10-15 (a pedido del usuario) ya no avisa al creador de la campaña: el reporte entra
// a la bandeja de Reportes de la supervisión (tabla `reportes`, tipo `aporte`, contra quien lo envió) y
// les llega a los supervisores como `reporte_nuevo`. Ahí se da el aviso o se descarta.
// Solo aportes con cuenta (los anónimos se marcan como inapropiados). Uno por aporte; se puede antes o
// después de decidirlo. El motivo también queda en el aporte (`aportes.reporte_*`). Lo usa
// POST /api/aportes/[id]/reportar.

import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisarReporteASupervisores } from "@/lib/notificaciones/avisos-a-supervisores";
import { MAXIMO_MOTIVO_DE_REPORTE } from "@/lib/aportes/motivos-de-rechazo";

export type ResultadoDeReporte =
  | { ok: true }
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
  // El creador no lo usa: él banea directamente.
  if (!fila.es_revisor || Number(fila.creator_id) === entrada.revisor.id) {
    return { ok: false, status: 403, error: "Solo un revisor de la campaña puede reportar un aporte a supervisión" };
  }
  if (fila.user_id == null) {
    return { ok: false, status: 400, error: "Un aporte sin cuenta no se reporta: márcalo como inapropiado" };
  }
  if (Number(fila.user_id) === entrada.revisor.id) {
    return { ok: false, status: 403, error: "No puedes reportar tu propio aporte" };
  }

  const client = await pool.connect();
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
    detalle: { campanaId: fila.campaign_id, motivo },
  });
  avisarReporteASupervisores({
    tipo: "aporte",
    campanaId: Number(fila.campaign_id),
    aporteId: entrada.aporteId,
    reportadoId: Number(fila.user_id),
    reportadoPor: entrada.revisor.id,
    motivo,
    excluir: [Number(fila.creator_id)],
  });
  return { ok: true };
}
