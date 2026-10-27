// Qué estado puede darle el creador a su campaña (POST /api/campanas, PATCH y PUT de
// /api/campanas/[id]). Una regla, un lugar: dominio.md § 4 y § 5.
//   - El creador solo guarda como `borrador` o envía `en_revision`. La activa el supervisor
//     (lib/supervision/decision.ts); el creador solo reactiva una finalizada o la finaliza.
//   - Máximo MAX_CAMPANAS_ACTIVAS activas a la vez: pasado ese número, solo borrador.
//   - Contadores, "especial", "revisor asignado" y XP no los decide el creador.

import { pool } from "@/lib/db";

export const MAX_CAMPANAS_ACTIVAS = 5;

/** Estados que el creador puede pedir al crear o al editar por completo. */
export const ESTADOS_QUE_ELIGE_EL_CREADOR = new Set(["borrador", "en_revision"]);

/** Estados en los que el creador edita todo (y puede volver a enviar a revisión). */
export const ESTADOS_CON_EDICION_COMPLETA = new Set(["borrador", "en_revision", "rechazada"]);

/** Activa y aceptada: solo meta y fecha/hora de fin. */
export const CAMPOS_DE_EDICION_LIMITADA = new Set(["goalContributions", "goal_contributions", "endDate", "end_date", "endTime", "end_time"]);

/**
 * Pausada (2026-10-22, a pedido del usuario): además nombre, descripción, temática, tipos de dato
 * (con la cuota, que depende de ellos), checklists (texto y orden), inicio y ubicación.
 * Sigue pausada y se avisa a quien la supervisa. La organización no cambia.
 */
export const CAMPOS_EDITABLES_EN_PAUSA = new Set([
  ...CAMPOS_DE_EDICION_LIMITADA,
  "name",
  "description",
  "tematica",
  "tag",
  "dataTypes",
  "data_types",
  "checklistSecciones",
  "checklist_secciones",
  "checklistOpciones",
  "checklist_opciones",
  "quotaPerUser",
  "quota_per_user",
  "startDate",
  "start_date",
  "startTime",
  "start_time",
  "todoElPais",
  "locationState",
  "location_state",
  "locationCity",
  "location_city",
  "locationColonia",
  "location_colonia",
]);

/** Columnas que, si cambian al editar una pausada, se avisan a la supervisión. */
export const COLUMNAS_AVISADAS_EN_PAUSA = [
  "name",
  "description",
  "tematica",
  "data_types",
  "checklist_secciones",
  "goal_contributions",
  "quota_per_user",
  "start_date",
  "start_time",
  "end_date",
  "end_time",
  "location_state",
  "location_city",
  "location_colonia",
  "todo_el_pais",
] as const;

// TODO(dominio): punto abierto 4 (cálculo de XP). Hasta decidirlo, todas las campañas
// usan el valor que siempre mandó el formulario; el creador no lo elige.
export const XP_POR_APORTE = 50;

/** Campañas activas de esta persona. */
export async function contarActivas(usuarioId: string | number): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM campanas WHERE creator_id = $1 AND status = 'activa'`,
    [usuarioId]
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Por qué el creador no puede pedir ese estado, o null si puede. Solo para crear o para
 * editar una campaña en borrador, en revisión o rechazada.
 */
export async function errorDeEstadoPedido(estado: string, usuarioId: string | number): Promise<string | null> {
  if (!ESTADOS_QUE_ELIGE_EL_CREADOR.has(estado)) {
    return "Solo puedes guardar la campaña como borrador o enviarla a revisión: la activa el supervisor.";
  }
  if (estado === "en_revision" && (await contarActivas(usuarioId)) >= MAX_CAMPANAS_ACTIVAS) {
    return `Ya tienes ${MAX_CAMPANAS_ACTIVAS} campañas activas: por ahora solo puedes guardarla como borrador.`;
  }
  return null;
}
