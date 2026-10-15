// Reglas de supervisión de campañas, en un solo lugar: tomar una campaña y dictaminarla
// (aceptada, rechazada, reportada). Las usan PATCH /api/campanas/[id] (supervisor) y
// lib/supervision/acciones-root.ts (SuperUsuario). Notifican al creador y escriben en audit_log.

import { pool } from "@/lib/db";
import { hasCampaignStarted } from "@/lib/campaign-date";
import { registrarAuditoria, type ActorDeAuditoria } from "@/lib/auditoria";
import { asegurarEnlaceVigente } from "@/lib/campanas/enlaces";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { avisarCampanaNueva } from "@/lib/notificaciones/campanas-por-interes";

export type AccionDeSupervision = "aceptada" | "rechazada" | "reportada";

export const ACCIONES_DE_SUPERVISION = new Set<string>(["aceptada", "rechazada", "reportada"]);

/**
 * Quién dictamina: un usuario con rol de supervisor (fila de `usuarios`) o el
 * SuperUsuario desde /supervisar, que no tiene fila en `usuarios` (ver
 * lib/rootSession.ts). Por eso lo del SuperUsuario se marca con
 * `campanas.supervisado_por_root` / `campana_supervisores.por_superusuario`
 * en vez de un `supervisor_id`.
 */
export type AutorDeDecision = { tipo: "usuario"; usuarioId: number } | { tipo: "root" };

function actorDeAuditoria(autor: AutorDeDecision): ActorDeAuditoria {
  return autor.tipo === "root" ? { tipo: "superusuario" } : { tipo: "usuario", id: autor.usuarioId };
}

export type ResultadoDeDecision =
  | { ok: true; nextStatus: string; mensaje: string }
  | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * Una campaña la supervisa un solo supervisor: quien la toma primero con el
 * botón "Supervisar esta campaña". El UPDATE es atómico (solo pasa si sigue en
 * revisión y sin supervisor), así que si dos la toman a la vez, gana uno.
 * Una vez tomada se queda con ese supervisor, también si el creador la
 * corrige y la reenvía tras un rechazo.
 */
export async function tomarCampanaParaSupervisar(
  campanaId: string | number,
  autor: AutorDeDecision,
): Promise<{ ok: true } | { ok: false; status: 403 | 404 | 409; error: string }> {
  const supervisorId = autor.tipo === "usuario" ? autor.usuarioId : null;
  const porRoot = autor.tipo === "root";

  const tomada = await pool.query(
    `UPDATE campanas
     SET supervisor_id = $2, supervisado_por_root = $3, updated_at = NOW()
     WHERE id = $1
       AND status = 'en_revision'
       AND supervisor_id IS NULL
       AND NOT supervisado_por_root
       AND ($2::int IS NULL OR creator_id <> $2::int)
     RETURNING id`,
    [campanaId, supervisorId, porRoot],
  );
  if (tomada.rowCount !== 0) {
    await registrarAuditoria({
      actor: actorDeAuditoria(autor),
      accion: "supervision.tomar",
      objetivo: { tipo: "campana", id: campanaId },
    });
    return { ok: true };
  }

  // No se pudo: averiguar por qué para dar un mensaje útil.
  const actual = await pool.query(
    `SELECT status, creator_id, supervisor_id, supervisado_por_root FROM campanas WHERE id = $1 LIMIT 1`,
    [campanaId],
  );
  if (actual.rowCount === 0) return { ok: false, status: 404, error: "Campaña no encontrada" };
  const fila = actual.rows[0];

  if (esSuSupervisor(fila, autor)) return { ok: true };
  if (autor.tipo === "usuario" && Number(fila.creator_id) === autor.usuarioId) {
    return { ok: false, status: 403, error: "No puedes supervisar una campaña que creaste" };
  }
  if (fila.supervisor_id != null || fila.supervisado_por_root) {
    return { ok: false, status: 409, error: "Otro supervisor ya está supervisando esta campaña" };
  }
  return { ok: false, status: 409, error: "Solo se pueden tomar campañas en revisión" };
}

function esSuSupervisor(
  fila: { supervisor_id: unknown; supervisado_por_root: unknown },
  autor: AutorDeDecision,
): boolean {
  return autor.tipo === "root"
    ? Boolean(fila.supervisado_por_root)
    : fila.supervisor_id != null && Number(fila.supervisor_id) === autor.usuarioId;
}

export async function registrarDecisionDeCampana(
  campanaId: string | number,
  accion: AccionDeSupervision,
  motivoEntrada: unknown,
  autor: AutorDeDecision,
): Promise<ResultadoDeDecision> {
  const existing = await pool.query(
    `SELECT id, status, creator_id, name, start_date, start_time, supervisor_id, supervisado_por_root
     FROM campanas WHERE id = $1 LIMIT 1`,
    [campanaId],
  );
  if (existing.rowCount === 0) {
    return { ok: false, status: 404, error: "Campaña no encontrada" };
  }
  const campana = existing.rows[0];

  // Un supervisor puede crear campañas, pero no dictaminar ni reportar las suyas.
  if (autor.tipo === "usuario" && Number(campana.creator_id) === autor.usuarioId) {
    return { ok: false, status: 403, error: "No puedes supervisar una campaña que creaste" };
  }
  const estado = String(campana.status);
  // Aceptar o rechazar solo en revisión; reportar, también ya aceptada (antes no se comprobaba:
  // por la API se podía "rechazar" una campaña activa).
  if ((accion === "aceptada" || accion === "rechazada") && estado !== "en_revision") {
    return { ok: false, status: 400, error: "Solo se aceptan o rechazan campañas en revisión" };
  }
  if (accion === "reportada" && !["en_revision", "aceptada", "activa", "pausada"].includes(estado)) {
    return { ok: false, status: 400, error: "Esta campaña ya no se puede reportar" };
  }
  // Solo el supervisor que la tomó dictamina o reporta. El SuperUsuario, además, supervisa las
  // campañas que ya aceptó cualquier supervisor (2026-10-15): puede reportarlas.
  const rootSobreAceptada = autor.tipo === "root" && accion === "reportada" && estado !== "en_revision";
  if (!esSuSupervisor(campana, autor) && !rootSobreAceptada) {
    return {
      ok: false,
      status: 403,
      error: campana.supervisor_id != null || campana.supervisado_por_root
        ? "Esta campaña la supervisa otro supervisor"
        : "Primero toma la campaña con \"Supervisar esta campaña\"",
    };
  }

  // Aceptada con fecha/hora de inicio futura: el estado de la campaña
  // queda "aceptada" (en_revision -> aceptada -> activa) y se activa sola
  // cuando lleguen (activateScheduledCampaigns); sin fecha definida se
  // activa de inmediato igual que antes.
  const nextStatus =
    accion === "aceptada"
      ? hasCampaignStarted(campana.start_date, campana.start_time) ? "activa" : "aceptada"
      : accion === "rechazada" ? "rechazada" : String(campana.status);
  const motivo = String(motivoEntrada ?? "").trim() || null;
  if (accion === "rechazada" && !motivo) {
    return { ok: false, status: 400, error: "El motivo es obligatorio al rechazar una campaña" };
  }

  const supervisorId = autor.tipo === "usuario" ? autor.usuarioId : null;
  const porRoot = autor.tipo === "root";

  await pool.query(`UPDATE campanas SET status = $2, updated_at = NOW() WHERE id = $1`, [campanaId, nextStatus]);
  // Aceptada y ya empezó: queda activa con su enlace público listo para compartir.
  // Si queda "aceptada" (inicio futuro), el enlace se crea al activarse (lib/campaign-date.ts).
  // Solo al aceptar: reportar una campaña ya activa la deja "activa" y antes volvía a mandar
  // campana_nueva (2026-10-15).
  if (accion === "aceptada" && nextStatus === "activa") {
    await asegurarEnlaceVigente(Number(campanaId));
    // A quien tiene su temática y vive donde se hace (en segundo plano).
    avisarCampanaNueva(Number(campanaId));
  }

  await pool.query(
    `INSERT INTO campana_supervisores (campana_id, supervisor_id, por_superusuario, accion, motivo, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [campanaId, supervisorId, porRoot, accion, motivo],
  );

  await registrarAuditoria({
    actor: actorDeAuditoria(autor),
    accion: "supervision.dictaminar",
    objetivo: { tipo: "campana", id: campanaId },
    detalle: { accion, motivo, estadoAnterior: String(campana.status), estadoNuevo: nextStatus },
  });

  // "Reportada" no avisa al creador (2026-10-15, a pedido del usuario): un reporte solo lo ven los supervisores.
  if (accion !== "reportada") await notificar({
    usuarioId: campana.creator_id,
    campanaId,
    metadata: motivo ? { motivo } : {},
    ...(accion === "aceptada"
      ? {
          tipo: "campana_aceptada" as const,
          titulo: "Campaña aceptada",
          mensaje: nextStatus === "activa"
            ? `Tu campaña "${campana.name}" fue aceptada y ya está activa.`
            : `Tu campaña "${campana.name}" fue aceptada. Se activará en su fecha de inicio.`,
          enlace: nextStatus === "activa" ? `/mis-campanas/${campanaId}/panel` : "/mis-campanas",
        }
      : {
          tipo: "campana_rechazada" as const,
          titulo: "Campaña rechazada",
          mensaje: `Tu campaña "${campana.name}" fue rechazada. Motivo: ${motivo}`,
          enlace: "/mis-campanas",
        }),
  });

  const mensaje = accion === "aceptada"
    ? nextStatus === "activa"
      ? "Campaña aceptada y puesta en activo"
      : "Campaña aceptada; se activará el día de su fecha de inicio"
    : accion === "rechazada"
      ? "Campaña rechazada"
      : "Campaña reportada";

  return { ok: true, nextStatus, mensaje };
}
