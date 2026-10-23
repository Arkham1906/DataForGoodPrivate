// Pausar, reanudar o finalizar una campaña desde la supervisión (2026-10-15, a pedido del usuario).
// Lo puede hacer el supervisor que la supervisa (PATCH /api/campanas/[id] { action: "pausar" |
// "reanudar" | "finalizar", motivo }) y el SuperUsuario sobre cualquier campaña aceptada
// (lib/supervision/acciones-root.ts). Pausar y finalizar piden motivo, que ve el creador (notificación
// y /mis-campanas) y, al pausar, también quien quiere aportar. Una campaña pausada por la supervisión
// solo la reanuda la supervisión; el creador sí puede finalizarla.

import { pool } from "@/lib/db";
import { errorDeReanudarAntesDeInicio, hasCampaignEnded, normalizeCampaignDate, normalizeCampaignTime } from "@/lib/campaign-date";
import { registrarAuditoria } from "@/lib/auditoria";
import { asegurarEnlaceVigente } from "@/lib/campanas/enlaces";
import { MAX_CAMPANAS_ACTIVAS, contarActivas } from "@/lib/campanas/estado-del-creador";
import { MAXIMO_MOTIVO_DE_SUPERVISION } from "@/lib/campanas/pausa";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { avisarCampanaEspecial } from "@/lib/notificaciones/campanas-por-interes";
import type { AutorDeDecision } from "@/lib/supervision/decision";

export type CambioDeEstadoPorSupervision = "pausar" | "reanudar" | "finalizar";

export const CAMBIOS_DE_ESTADO_POR_SUPERVISION = new Set<string>(["pausar", "reanudar", "finalizar"]);

export type ResultadoDeCambioDeEstado =
  | { ok: true; nextStatus: string; mensaje: string }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

/** De qué estado sale cada cambio y a cuál llega. */
const TRANSICIONES: Record<CambioDeEstadoPorSupervision, { desde: string[]; hacia: string }> = {
  pausar: { desde: ["activa"], hacia: "pausada" },
  reanudar: { desde: ["pausada"], hacia: "activa" },
  finalizar: { desde: ["activa", "pausada"], hacia: "finalizada" },
};

export async function cambiarEstadoPorSupervision(
  campanaId: string | number,
  cambio: CambioDeEstadoPorSupervision,
  motivoEntrada: unknown,
  autor: AutorDeDecision,
): Promise<ResultadoDeCambioDeEstado> {
  const existente = await pool.query(
    `SELECT id, status, creator_id, name, supervisor_id, supervisado_por_root, start_date, start_time, end_date, end_time, pausa_por, is_special
     FROM campanas WHERE id = $1 LIMIT 1`,
    [campanaId],
  );
  if (existente.rowCount === 0) return { ok: false, status: 404, error: "Campaña no encontrada" };
  const campana = existente.rows[0];

  // El supervisor, solo la que supervisa (y nunca una suya). El SuperUsuario, cualquiera ya aceptada.
  if (autor.tipo === "usuario") {
    if (Number(campana.creator_id) === autor.usuarioId) {
      return { ok: false, status: 403, error: "No puedes supervisar una campaña que creaste" };
    }
    if (campana.supervisor_id == null || Number(campana.supervisor_id) !== autor.usuarioId) {
      return { ok: false, status: 403, error: "Solo quien supervisa esta campaña puede cambiar su estado" };
    }
  }

  const { desde, hacia } = TRANSICIONES[cambio];
  const estado = String(campana.status);
  if (!desde.includes(estado)) {
    const error = {
      pausar: "Solo se puede pausar una campaña activa",
      reanudar: "Solo se puede reanudar una campaña pausada",
      finalizar: "Solo se puede finalizar una campaña activa o pausada",
    }[cambio];
    return { ok: false, status: 400, error };
  }

  const motivo = String(motivoEntrada ?? "").trim();
  if (cambio !== "reanudar") {
    if (!motivo) {
      return { ok: false, status: 400, error: cambio === "pausar" ? "Escribe por qué se pausa la campaña" : "Escribe por qué se finaliza la campaña" };
    }
    if (motivo.length > MAXIMO_MOTIVO_DE_SUPERVISION) {
      return { ok: false, status: 400, error: `El motivo admite hasta ${MAXIMO_MOTIVO_DE_SUPERVISION} caracteres` };
    }
  }

  if (cambio === "reanudar") {
    // La que pausó el creador la reanuda el creador.
    if (campana.pausa_por !== "supervision") {
      return { ok: false, status: 403, error: "Esta campaña la pausó quien la organiza; solo esa persona puede reanudarla" };
    }
    if (hasCampaignEnded(normalizeCampaignDate(campana.end_date), normalizeCampaignTime(campana.end_time))) {
      return {
        ok: false,
        status: 400,
        error: "La fecha de cierre ya pasó: quien organiza la campaña debe poner una nueva, o finalízala",
      };
    }
    const errorDeInicio = errorDeReanudarAntesDeInicio(campana.start_date, campana.start_time);
    if (errorDeInicio) return { ok: false, status: 400, error: errorDeInicio };
    // Mismo tope que cuando la reanuda el creador: cuenta para sus campañas activas.
    if ((await contarActivas(campana.creator_id)) >= MAX_CAMPANAS_ACTIVAS) {
      return {
        ok: false,
        status: 400,
        error: `Quien organiza la campaña ya tiene ${MAX_CAMPANAS_ACTIVAS} campañas activas; no se puede reanudar esta por ahora`,
      };
    }
  }

  // Condicional al estado leído: si cambió mientras tanto (el creador la pausó, se finalizó...), no se aplica.
  const actualizada = await pool.query(
    `UPDATE campanas
     SET status = $2::text,
         pausa_por = CASE WHEN $2::text = 'pausada' THEN 'supervision' ELSE pausa_por END,
         pausa_motivo = CASE WHEN $2::text = 'pausada' THEN $3::text ELSE pausa_motivo END,
         pausada_en = CASE WHEN $2::text = 'pausada' THEN NOW() ELSE pausada_en END,
         updated_at = NOW()
     WHERE id = $1 AND status = $4
     RETURNING id`,
    [campanaId, hacia, motivo || null, estado],
  );
  if (actualizada.rowCount === 0) {
    return { ok: false, status: 409, error: "La campaña cambió mientras tanto. Vuelve a cargar la página" };
  }

  if (hacia === "activa") {
    await asegurarEnlaceVigente(Number(campanaId));
    // Se reanudó con incentivos que no se avisaron mientras estaba pausada.
    if (campana.is_special) avisarCampanaEspecial(Number(campanaId));
  }

  await registrarAuditoria({
    actor: autor.tipo === "root" ? { tipo: "superusuario" } : { tipo: "usuario", id: autor.usuarioId },
    accion: cambio === "pausar" ? "supervision.pausar" : cambio === "reanudar" ? "supervision.reanudar" : "supervision.finalizar",
    objetivo: { tipo: "campana", id: campanaId },
    detalle: { motivo: motivo || null, estadoAnterior: estado, estadoNuevo: hacia },
  });

  const nombre = String(campana.name ?? "");
  await notificar({
    usuarioId: campana.creator_id,
    campanaId,
    metadata: motivo ? { motivo } : {},
    ...(cambio === "pausar"
      ? {
          tipo: "campana_pausada" as const,
          titulo: "La supervisión pausó tu campaña",
          mensaje: `"${nombre}" no recibe aportes por ahora. Motivo: ${motivo}`,
          enlace: "/mis-campanas",
        }
      : cambio === "reanudar"
        ? {
            tipo: "campana_reanudada" as const,
            titulo: "Tu campaña se reanudó",
            mensaje: `La supervisión reanudó "${nombre}": vuelve a recibir aportes.`,
            enlace: `/mis-campanas/${campanaId}/panel`,
          }
        : {
            tipo: "campana_finalizada" as const,
            titulo: "La supervisión finalizó tu campaña",
            mensaje: `"${nombre}" ya no recibe aportes. Motivo: ${motivo}`,
            enlace: `/mis-campanas/${campanaId}/panel`,
          }),
  });

  const mensaje = { pausar: "Campaña pausada", reanudar: "Campaña reanudada", finalizar: "Campaña finalizada" }[cambio];
  return { ok: true, nextStatus: hacia, mensaje };
}
