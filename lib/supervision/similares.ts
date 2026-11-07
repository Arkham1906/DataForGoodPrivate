// Campañas similares (2026-11-04, a pedido del usuario): al revisar una campaña, la supervisión ve las
// que se le parecen en el sistema y decide si se acepta o se rechaza; si la rechaza por eso, tiene que
// explicar el motivo (MOTIVO_CAMPANA_SIMILAR de lib/reportes/motivos.ts). Desde el 2026-11-07 no solo por
// temática: también subtemática, nombre, descripción y tipos de dato (lib/supervision/parecido.ts), con las
// más parecidas primero. Solo activas, programadas (aceptada) y finalizadas (2026-11-07, decisión del
// usuario): ni pausadas, ni en revisión. Lo leen GET /api/campanas/[id]/similares (supervisor) y
// /supervisar/[campaignId] (SuperUsuario, en el servidor); se muestra en components/supervision/CampanasSimilares.

import { pool } from "@/lib/db";
import { columnasCalculadas } from "@/lib/campanas/tipos-de-campana";
import { compararCampanas, esSimilar, type Coincidencia } from "@/lib/supervision/parecido";

/** Cuántas se muestran; `total` dice cuántas hay. Las más parecidas van primero. */
export const MAXIMO_DE_SIMILARES = 12;

/** Estados que salen, en el orden en que se muestran a igual parecido. */
const ESTADOS_SIMILARES = ["activa", "aceptada", "finalizada"];

/** Cuántas campañas se comparan, de las más recientes: el parecido se calcula aquí, no en SQL. */
const MAXIMO_A_COMPARAR = 1000;

export type CampanaSimilar = {
  id: string;
  name: string;
  status: string;
  tematica: string;
  /** Subtemáticas de la campaña, por nombre. */
  etiquetas: string[];
  /** En qué se parece a la campaña en revisión. */
  coincidencias: Coincidencia[];
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

/** Las subtemáticas de la fila `c`, por nombre (también las pendientes: la supervisión las ve). */
const COLUMNA_DE_ETIQUETAS = `(SELECT COALESCE(jsonb_agg(e.nombre ORDER BY e.nombre), '[]'::jsonb)
    FROM campana_etiquetas ce JOIN etiquetas e ON e.id = ce.etiqueta_id
    WHERE ce.campana_id = c.id) AS etiquetas`;

function listaDeTexto(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.map(String) : [];
}

/** Las que se parecen a una campaña en revisión; null si no existe. Fuera de revisión, ninguna. */
export async function obtenerCampanasSimilares(campanaId: string | number): Promise<CampanasSimilares | null> {
  const actual = await pool.query(
    `SELECT c.status, c.name, c.description, COALESCE(NULLIF(c.tematica, ''), c.tag, '') AS tematica,
            ${COLUMNA_DE_ETIQUETAS}, ${columnasCalculadas("c")}
     FROM campanas c WHERE c.id = $1 LIMIT 1`,
    [campanaId],
  );
  if (actual.rowCount === 0) return null;
  const fila = actual.rows[0];
  const tematica = String(fila.tematica ?? "");
  if (fila.status !== "en_revision") return { tematica, total: 0, campanas: [] };
  const enRevision = {
    tematica,
    etiquetas: listaDeTexto(fila.etiquetas),
    name: String(fila.name ?? ""),
    description: String(fila.description ?? ""),
    dataTypes: listaDeTexto(fila.data_types),
  };

  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.status, c.description, c.creator_name, c.organizer, c.todo_el_pais,
            c.location_state, c.location_city, c.goal_contributions,
            COALESCE(NULLIF(c.tematica, ''), c.tag, '') AS tematica,
            to_char(c.start_date, 'YYYY-MM-DD') AS inicio, to_char(c.end_date, 'YYYY-MM-DD') AS fin,
            ${COLUMNA_DE_ETIQUETAS}, ${columnasCalculadas("c")}
     FROM campanas c
     WHERE c.id <> $1 AND c.status = ANY($2::text[])
     ORDER BY c.created_at DESC
     LIMIT $3`,
    [campanaId, ESTADOS_SIMILARES, MAXIMO_A_COMPARAR],
  );

  const parecidas = rows
    .map((row) => {
      const campana: CampanaSimilar = {
        id: String(row.id),
        name: String(row.name ?? ""),
        status: String(row.status ?? ""),
        tematica: String(row.tematica ?? ""),
        etiquetas: listaDeTexto(row.etiquetas),
        coincidencias: [],
        description: String(row.description ?? ""),
        creatorName: String(row.creator_name ?? ""),
        organizer: String(row.organizer ?? ""),
        todoElPais: Boolean(row.todo_el_pais),
        locationState: String(row.location_state ?? ""),
        locationCity: String(row.location_city ?? ""),
        dataTypes: listaDeTexto(row.data_types),
        startDate: row.inicio ?? null,
        endDate: row.fin ?? null,
        approvedContributions: Number(row.approved_contributions ?? 0),
        goalContributions: Number(row.goal_contributions ?? 0),
      };
      const { coincidencias, puntaje } = compararCampanas(enRevision, campana);
      return { campana: { ...campana, coincidencias }, puntaje };
    })
    .filter(({ campana }) => esSimilar(campana.coincidencias))
    // Sort estable: a igual parecido y estado, siguen de la más reciente a la más vieja.
    .sort(
      (a, b) =>
        b.puntaje - a.puntaje ||
        ESTADOS_SIMILARES.indexOf(a.campana.status) - ESTADOS_SIMILARES.indexOf(b.campana.status),
    );

  return {
    tematica,
    total: parecidas.length,
    campanas: parecidas.slice(0, MAXIMO_DE_SIMILARES).map(({ campana }) => campana),
  };
}
