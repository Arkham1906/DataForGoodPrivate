// "Reportar al creador": el revisor de aportes avisa a quien creó la campaña que un aporte (o quien
// lo envió) merece una sanción. El revisor no banea ni bloquea: esa decisión es del creador.
// Uno por aporte; se puede antes o después de decidirlo. Lo usa POST /api/aportes/[id]/reportar.

import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { MAXIMO_MOTIVO_DE_REPORTE } from "@/lib/aportes/motivos-de-rechazo";

export type ResultadoDeReporte =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

export async function reportarAlCreador(entrada: {
  aporteId: number;
  revisor: { id: number; nombre: string };
  motivo: unknown;
}): Promise<ResultadoDeReporte> {
  const motivo = typeof entrada.motivo === "string" ? entrada.motivo.trim() : "";
  if (!motivo) return { ok: false, status: 400, error: "Indica por qué reportas este aporte" };
  if (motivo.length > MAXIMO_MOTIVO_DE_REPORTE) {
    return { ok: false, status: 400, error: `El motivo no puede pasar de ${MAXIMO_MOTIVO_DE_REPORTE} caracteres` };
  }

  const { rows } = await pool.query<{ campaign_id: number; creator_id: number; name: string; es_revisor: boolean }>(
    `SELECT a.campaign_id, c.creator_id, c.name,
            EXISTS (SELECT 1 FROM campana_revisores r
                    WHERE r.campana_id = a.campaign_id AND r.usuario_id = $2 AND r.estado = 'aceptado') AS es_revisor
     FROM aportes a JOIN campanas c ON c.id = a.campaign_id
     WHERE a.id = $1`,
    [entrada.aporteId, entrada.revisor.id]
  );
  const fila = rows[0];
  if (!fila) return { ok: false, status: 404, error: "Aporte no encontrado" };
  // El creador no se reporta a sí mismo: él banea directamente.
  if (!fila.es_revisor || Number(fila.creator_id) === entrada.revisor.id) {
    return { ok: false, status: 403, error: "Solo un revisor de la campaña puede reportar un aporte al creador" };
  }

  // reporte_en IS NULL en el WHERE: uno por aporte, aunque dos revisores reporten a la vez.
  const guardado = await pool.query(
    `UPDATE aportes SET reporte_motivo = $2, reporte_por = $3, reporte_en = NOW(), updated_at = NOW()
     WHERE id = $1 AND reporte_en IS NULL`,
    [entrada.aporteId, motivo, entrada.revisor.id]
  );
  if (guardado.rowCount === 0) return { ok: false, status: 409, error: "Este aporte ya se reportó al creador" };

  await registrarAuditoria({
    actor: { tipo: "usuario", id: entrada.revisor.id },
    accion: "aporte.reportar",
    objetivo: { tipo: "aporte", id: entrada.aporteId },
    detalle: { campanaId: fila.campaign_id, motivo },
  });
  await notificar({
    usuarioId: fila.creator_id,
    tipo: "aporte_reportado",
    titulo: "Un revisor reportó un aporte",
    mensaje: `${entrada.revisor.nombre} reportó el aporte #${entrada.aporteId} de "${fila.name}". Motivo: ${motivo}. Revísalo y decide si baneas a quien lo envió.`,
    campanaId: fila.campaign_id,
    enlace: `/mis-campanas/${fila.campaign_id}/aportes/${entrada.aporteId}`,
    metadata: { aporteId: String(entrada.aporteId), motivo },
  });
  return { ok: true };
}
