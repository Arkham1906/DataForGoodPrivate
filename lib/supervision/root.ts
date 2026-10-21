import { redirect } from "next/navigation";

import { pool } from "@/lib/db";
import { activateScheduledCampaigns, finalizeExpiredCampaigns, normalizeCampaignDate } from "@/lib/campaign-date";
import { hasRootSession } from "@/lib/rootSession";
import { pausaDesdeFila, type PausaDeCampana } from "@/lib/campanas/pausa";
import { normalizarCuotaPorTipo, type CuotaPorTipo } from "@/lib/campanas/cuota-por-tipo";

/*
 * Datos del modo supervisor del SuperUsuario (/supervisar, dentro de
 * app/(panel)). Es una copia aislada de /supervision: solo responde con
 * sesión raíz (root_sessions), nunca con la sesión de un usuario, aunque
 * tenga rol de supervisor. El SuperUsuario solo supervisa: no tiene fila en
 * `usuarios`, así que no puede crear campañas, aportar ni revisar aportes.
 * Desde el 2026-10-15 (a pedido del usuario) ve TODAS las campañas que ya pasaron
 * la supervisión, las haya aceptado él o cualquier supervisor, y las supervisa
 * igual que las suyas: panel, participantes, aportes y "Reportar".
 */

/** Estados de una campaña que ya pasó la supervisión (la aceptó alguien). */
export const ESTADOS_SUPERVISADOS = ["aceptada", "activa", "pausada", "finalizada"];

/** Guardia de cada página: el layout de (panel) ya la aplica, pero no basta solo. */
export async function exigirSesionRoot(): Promise<void> {
  if (!(await hasRootSession())) redirect("/root");
}

export type CampanaSupervisable = {
  id: string;
  name: string;
  creatorName: string;
  tag: string;
  status: string;
  latestSupervisionAction: string | null;
  /** libre: nadie la ha tomado; mia: la tomó el SuperUsuario; otro: la tomó un usuario supervisor. */
  supervision: "libre" | "mia" | "otro";
  /** Quién la supervisa: "SuperUsuario", el nombre del supervisor, o null si nadie. */
  supervisadaPor: string | null;
  currentContributions: number;
  /** Los que cuentan para la meta (lib/campanas/meta.ts). */
  approvedContributions: number;
  goalContributions: number;
  participants: number;
  quotaPerUser: number;
  /** Reparto de la cuota por tipo de dato; null = solo la cuota general. */
  cuotaPorTipo: CuotaPorTipo | null;
  description: string;
  organizer: string;
  dataTypes: string[];
  locationColonia: string;
  /** Para todo el país (lib/campanas/ubicacion.ts). */
  todoElPais: boolean;
  locationCity: string;
  locationState: string;
  startDate: string | null;
  endDate: string | null;
  /** Quién la pausó y por qué, o null si no está pausada. */
  pausa: PausaDeCampana | null;
};

function mapear(row: Record<string, unknown>): CampanaSupervisable {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    creatorName: String(row.creator_name ?? ""),
    tag: String(row.tag ?? row.tematica ?? ""),
    status: String(row.status ?? ""),
    latestSupervisionAction: row.latest_supervision_action ? String(row.latest_supervision_action) : null,
    supervision: row.supervisado_por_root ? "mia" : row.supervisor_id != null ? "otro" : "libre",
    supervisadaPor: row.supervisado_por_root
      ? "SuperUsuario"
      : row.supervisor_id != null
        ? String(row.supervisor_nombre ?? "").trim() || "Un supervisor"
        : null,
    currentContributions: Number(row.current_contributions ?? 0),
    approvedContributions: Number(row.approved_contributions ?? 0),
    goalContributions: Number(row.goal_contributions ?? 0),
    participants: Number(row.participants ?? 0),
    quotaPerUser: Number(row.quota_per_user ?? 0),
    cuotaPorTipo: normalizarCuotaPorTipo(row.cuota_por_tipo, Array.isArray(row.data_types) ? row.data_types.map(String) : []),
    description: String(row.description ?? ""),
    organizer: String(row.organizer ?? ""),
    dataTypes: Array.isArray(row.data_types) ? row.data_types.map(String) : [],
    locationColonia: String(row.location_colonia ?? ""),
    todoElPais: row.todo_el_pais === true,
    locationCity: String(row.location_city ?? ""),
    locationState: String(row.location_state ?? ""),
    startDate: normalizeCampaignDate(row.start_date),
    endDate: normalizeCampaignDate(row.end_date),
    pausa: pausaDesdeFila(row),
  };
}

// Último dictamen de cualquier supervisor (o del SuperUsuario) y el nombre de quien la supervisa.
const ULTIMA_ACCION_ROOT = `
  LEFT JOIN LATERAL (
    SELECT cs.accion
    FROM campana_supervisores cs
    WHERE cs.campana_id = c.id
    ORDER BY cs.created_at DESC, cs.id DESC
    LIMIT 1
  ) ultima ON true
  LEFT JOIN LATERAL (
    SELECT CONCAT_WS(' ', u.nombre, u.apellidos) AS supervisor_nombre
    FROM usuarios u
    WHERE u.id = c.supervisor_id
  ) sup ON true`;

export async function listarCampanasParaRoot(): Promise<{
  pendientes: CampanaSupervisable[];
  supervisadas: CampanaSupervisable[];
}> {
  await exigirSesionRoot();
  await activateScheduledCampaigns();
  await finalizeExpiredCampaigns();

  const [pendientes, supervisadas] = await Promise.all([
    // Por supervisar: las libres y las que ya tomó el SuperUsuario (un solo supervisor por campaña).
    pool.query(
      `SELECT c.*, sup.supervisor_nombre FROM campanas c ${ULTIMA_ACCION_ROOT}
       WHERE c.status = 'en_revision'
         AND (c.supervisado_por_root OR c.supervisor_id IS NULL)
       ORDER BY c.created_at DESC`,
    ),
    // Supervisadas: todas las que ya pasaron la supervisión (las aceptó él o un supervisor) y las
    // que rechazó o reportó cualquiera, para la pestaña de incidencias.
    pool.query(
      `SELECT c.*, ultima.accion AS latest_supervision_action, sup.supervisor_nombre
       FROM campanas c ${ULTIMA_ACCION_ROOT}
       WHERE c.status = ANY($1::text[])
          OR (c.status IN ('en_revision', 'rechazada') AND (c.supervisado_por_root OR c.supervisor_id IS NOT NULL))
       ORDER BY c.created_at DESC`,
      [ESTADOS_SUPERVISADOS],
    ),
  ]);

  return { pendientes: pendientes.rows.map(mapear), supervisadas: supervisadas.rows.map(mapear) };
}

export async function obtenerCampanaParaRoot(id: string): Promise<CampanaSupervisable | null> {
  await exigirSesionRoot();
  if (!/^\d+$/.test(id)) return null;

  const result = await pool.query(
    `SELECT c.*, ultima.accion AS latest_supervision_action, sup.supervisor_nombre
     FROM campanas c ${ULTIMA_ACCION_ROOT}
     WHERE c.id = $1
     LIMIT 1`,
    [id],
  );
  return result.rowCount === 0 ? null : mapear(result.rows[0]);
}

/** Campaña que ya recolecta (o recolectó), la haya aceptado quien sea: participantes, aportes y panel. */
export async function obtenerCampanaSupervisadaPorRoot(id: string): Promise<{ id: number; name: string } | null> {
  await exigirSesionRoot();
  if (!/^\d+$/.test(id)) return null;

  const result = await pool.query<{ id: number; name: string }>(
    `SELECT id, name FROM campanas
     WHERE id = $1 AND status IN ('activa', 'pausada', 'finalizada')
     LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}
