// Inscripción a una campaña para aportar (2026-10-15, a pedido del usuario): la persona acepta una sola
// vez el acuerdo de confirmación y el de uso del aporte (lib/aportes/consentimiento.ts). Antes se
// aceptaban en una ventana en cada aporte. POST /api/aportes exige la inscripción y guarda su hora en
// aportes.consentimiento_en. Tabla campana_inscripciones (lib/db-schema.ts). La usan
// POST /api/campanas/[id]/inscripcion, GET /api/campanas?id= (viewer.inscrito) y POST /api/aportes.
// Sin cuenta (/c/[token]) no hay inscripción.

import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { errorDeConsentimiento } from "@/lib/aportes/consentimiento";
import { estaBaneadoDeCampana } from "@/lib/campanas/baneos";

export type ResultadoDeInscripcion = { ok: true } | { ok: false; status: 400 | 403 | 404; error: string };

/** Hora en que la persona aceptó los acuerdos de la campaña, o null si no está inscrita. */
export async function inscripcionDe(campanaId: number | string, usuarioId: number | string): Promise<Date | null> {
  const { rows } = await pool.query<{ aceptada_en: Date }>(
    `SELECT aceptada_en FROM campana_inscripciones WHERE campana_id = $1 AND usuario_id = $2`,
    [campanaId, usuarioId],
  );
  return rows[0]?.aceptada_en ?? null;
}

/** Inscribe a la persona con los dos acuerdos aceptados. Inscribirse otra vez no cambia nada. */
export async function inscribir(entrada: {
  campanaId: number;
  usuarioId: number;
  acuerdos: Record<string, unknown>;
}): Promise<ResultadoDeInscripcion> {
  const error = errorDeConsentimiento(entrada.acuerdos);
  if (error) return { ok: false, status: 400, error };

  const { rows } = await pool.query<{ creator_id: number; status: string }>(
    `SELECT creator_id, status FROM campanas WHERE id = $1`,
    [entrada.campanaId],
  );
  const campana = rows[0];
  if (!campana || campana.status === "borrador") return { ok: false, status: 404, error: "Campaña no encontrada" };
  if (Number(campana.creator_id) === entrada.usuarioId) {
    return { ok: false, status: 403, error: "No puedes aportar en una campaña que creaste" };
  }
  if (campana.status !== "activa" && campana.status !== "pausada") {
    return { ok: false, status: 400, error: "Esta campaña no está recibiendo aportes" };
  }
  if (await estaBaneadoDeCampana(entrada.campanaId, entrada.usuarioId)) {
    return { ok: false, status: 403, error: "No puedes aportar en esta campaña porque estás baneado de ella" };
  }

  const guardada = await pool.query(
    `INSERT INTO campana_inscripciones (campana_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [entrada.campanaId, entrada.usuarioId],
  );
  if (guardada.rowCount) {
    await registrarAuditoria({
      actor: { tipo: "usuario", id: entrada.usuarioId },
      accion: "campana.inscribirse",
      objetivo: { tipo: "campana", id: entrada.campanaId },
    });
  }
  return { ok: true };
}
