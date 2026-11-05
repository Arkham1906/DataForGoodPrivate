// Campañas similares (2026-11-04, a pedido del usuario): al revisar una campaña, la supervisión ve las
// demás de la misma temática que hay en el sistema y decide si se acepta o se rechaza; si la rechaza por eso,
// tiene que explicar el motivo (MOTIVO_CAMPANA_SIMILAR de lib/reportes/motivos.ts). No cuenta borradores
// ni rechazadas: no están en el sistema. Lo leen GET /api/campanas/[id]/similares (supervisor) y
// /supervisar/[campaignId] (SuperUsuario, en el servidor); se muestra en components/supervision/CampanasSimilares.

import { pool } from "@/lib/db";
import { columnasCalculadas } from "@/lib/campanas/tipos-de-campana";

/** Cuántas se muestran; `total` dice cuántas hay. Las abiertas van primero. */
export const MAXIMO_DE_SIMILARES = 12;

const ESTADOS_SIMILARES = ["activa", "aceptada", "en_revision", "pausada", "finalizada"];

export type CampanaSimilar = {
  id: string;
  name: string;
  status: string;
  description: string;
  creatorName: string;
  organizer: string;
  todoElPais: boolean;
  locationState: string;
  locationCity: string;
  dataTypes: string[];
  startDate: string | null;
  endDate: string | null;
  approvedContributions: number;
  goalContributions: number;
};

export type CampanasSimilares = { tematica: string; total: number; campanas: CampanaSimilar[] };

/** Las de la misma temática que una campaña en revisión; null si no existe. Fuera de revisión, ninguna. */
export async function obtenerCampanasSimilares(campanaId: string | number): Promise<CampanasSimilares | null> {
  const actual = await pool.query<{ status: string; tematica: string }>(
    `SELECT status, COALESCE(NULLIF(tematica, ''), tag, '') AS tematica FROM campanas WHERE id = $1 LIMIT 1`,
    [campanaId],
  );
  if (actual.rowCount === 0) return null;
  const { status, tematica } = actual.rows[0];
  if (status !== "en_revision" || !tematica.trim()) return { tematica, total: 0, campanas: [] };

  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.status, c.description, c.creator_name, c.organizer, c.todo_el_pais,
            c.location_state, c.location_city, c.goal_contributions,
            to_char(c.start_date, 'YYYY-MM-DD') AS inicio, to_char(c.end_date, 'YYYY-MM-DD') AS fin,
            ${columnasCalculadas("c")}, COUNT(*) OVER () AS total
     FROM campanas c
     WHERE c.id <> $1
       AND c.status = ANY($2::text[])
       AND lower(btrim(COALESCE(NULLIF(c.tematica, ''), c.tag, ''))) = lower(btrim($3))
     ORDER BY CASE c.status WHEN 'activa' THEN 0 WHEN 'aceptada' THEN 1 WHEN 'en_revision' THEN 2 WHEN 'pausada' THEN 3 ELSE 4 END,
              c.created_at DESC
     LIMIT $4`,
    [campanaId, ESTADOS_SIMILARES, tematica, MAXIMO_DE_SIMILARES],
  );

  return {
    tematica,
    total: Number(rows[0]?.total ?? 0),
    campanas: rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      status: String(row.status ?? ""),
      description: String(row.description ?? ""),
      creatorName: String(row.creator_name ?? ""),
      organizer: String(row.organizer ?? ""),
      todoElPais: Boolean(row.todo_el_pais),
      locationState: String(row.location_state ?? ""),
      locationCity: String(row.location_city ?? ""),
      dataTypes: Array.isArray(row.data_types) ? row.data_types.map(String) : [],
      startDate: row.inicio ?? null,
      endDate: row.fin ?? null,
      approvedContributions: Number(row.approved_contributions ?? 0),
      goalContributions: Number(row.goal_contributions ?? 0),
    })),
  };
}
