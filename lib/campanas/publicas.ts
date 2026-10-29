import { pool } from "@/lib/db";
import { activateScheduledCampaigns, calculateCampaignDaysRemaining, finalizeExpiredCampaigns } from "@/lib/campaign-date";
import { etiquetasDeCampanas } from "@/lib/etiquetas/catalogo";

/**
 * Campañas de la vitrina pública /explorar: activas y, desde el 2026-10-24 (a pedido del usuario), también
 * las pausadas, después de las activas y con su etiqueta (no reciben aportes). Solo expone lo que ya se ve
 * en la landing y en /datos: nada de quién aporta ni de la revisión.
 */
export type CampanaPublica = {
  id: string;
  name: string;
  description: string;
  tematica: string;
  /** Subtemáticas aprobadas (2026-10-27). */
  etiquetas: string[];
  organizer: string;
  /** Nombre de quien la creó: se muestra si no puso organización (quienOrganiza). */
  creatorName: string;
  locationCity: string;
  locationState: string;
  /** Para todo el país (lib/campanas/ubicacion.ts). */
  todoElPais: boolean;
  dataTypes: string[];
  /** Los que cuentan para la meta (lib/campanas/meta.ts). */
  approvedContributions: number;
  goalContributions: number;
  participants: number;
  daysRemaining: number | null;
  status: "activa" | "pausada";
};

export type OrdenDeCampanas = "participacion" | "recientes" | "cierre";

/** Estados que salen en /explorar. */
const ESTADOS_VISIBLES = "status IN ('activa', 'pausada')";

const ORDER_SQL: Record<OrdenDeCampanas, string> = {
  participacion: "participants DESC, current_contributions DESC",
  recientes: "created_at DESC",
  cierre: "end_date ASC NULLS LAST",
};

export type FiltrosDeCampanas = {
  q?: string;
  tematica?: string;
  /** Subtemática (nombre); solo tiene sentido junto con `tematica`. */
  etiqueta?: string;
  locationState?: string;
  /** Tipo de dato que pide la campaña (foto, video, audio, documento o texto; 2026-10-28). */
  tipo?: string;
  orden?: OrdenDeCampanas;
};

function mapCampana(row: Record<string, unknown>): CampanaPublica {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    tematica: String(row.tematica ?? ""),
    etiquetas: [],
    organizer: String(row.organizer ?? ""),
    creatorName: String(row.creator_name ?? ""),
    locationCity: String(row.location_city ?? ""),
    locationState: String(row.location_state ?? ""),
    todoElPais: row.todo_el_pais === true,
    dataTypes: Array.isArray(row.data_types) ? row.data_types.map(String) : [],
    approvedContributions: Number(row.approved_contributions ?? 0),
    goalContributions: Number(row.goal_contributions ?? 0),
    participants: Number(row.participants ?? 0),
    daysRemaining: calculateCampaignDaysRemaining(row.end_date),
    status: row.status === "pausada" ? "pausada" : "activa",
  };
}

// Igual que en open-data.ts: si la BD no responde (o la tabla aún no existe)
// se devuelve vacío en vez de tumbar la página.
export async function buscarCampanasParaExplorar(filtros: FiltrosDeCampanas): Promise<CampanaPublica[]> {
  try {
    // Una programada cuya hora de inicio ya llegó sale sin esperar a la tarea de cada minuto.
    await activateScheduledCampaigns();
    await finalizeExpiredCampaigns();
    const condiciones = [ESTADOS_VISIBLES];
    const valores: unknown[] = [];

    const q = filtros.q?.trim();
    if (q) {
      valores.push(`%${q}%`);
      const p = `$${valores.length}`;
      // "Organización" es la que se muestra: la que puso o, sin ella, el nombre de quien la creó.
      condiciones.push(`(name ILIKE ${p} OR description ILIKE ${p} OR COALESCE(NULLIF(organizer, ''), creator_name) ILIKE ${p} OR location_city ILIKE ${p})`);
    }
    if (filtros.tematica) {
      valores.push(filtros.tematica);
      condiciones.push(`tematica = $${valores.length}`);
    }
    if (filtros.etiqueta) {
      valores.push(filtros.etiqueta);
      condiciones.push(
        `EXISTS (SELECT 1 FROM campana_etiquetas ce JOIN etiquetas e ON e.id = ce.etiqueta_id
                 WHERE ce.campana_id = campanas.id AND e.aprobada AND e.nombre = $${valores.length})`
      );
    }
    if (filtros.locationState) {
      valores.push(filtros.locationState);
      // Una campaña para todo el país también vale en ese estado.
      condiciones.push(`(location_state = $${valores.length} OR todo_el_pais)`);
    }
    if (filtros.tipo) {
      valores.push(filtros.tipo);
      // data_types es un arreglo JSONB de textos: ? busca el elemento.
      condiciones.push(`data_types ? $${valores.length}`);
    }

    const result = await pool.query(
      `SELECT id, name, description, tematica, organizer, creator_name, location_city, location_state, todo_el_pais, data_types,
              approved_contributions, goal_contributions, participants, end_date, status
       FROM campanas
       WHERE ${condiciones.join(" AND ")}
       ORDER BY (status = 'pausada'), ${ORDER_SQL[filtros.orden ?? "participacion"]}`,
      valores
    );
    const campanas = result.rows.map(mapCampana);
    const etiquetas = await etiquetasDeCampanas(campanas.map((c) => Number(c.id)));
    for (const c of campanas) c.etiquetas = (etiquetas.get(Number(c.id)) ?? []).map((e) => e.nombre);
    return campanas;
  } catch {
    return [];
  }
}

/**
 * Activas y pausadas, sin filtros: `activas` va en el texto de arriba ("N campañas activas recibiendo
 * aportes") y `visibles` distingue "no hay campañas" de "sin resultados".
 */
export async function contarCampanasParaExplorar(): Promise<{ activas: number; visibles: number }> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'activa')::int AS activas, COUNT(*)::int AS visibles
       FROM campanas WHERE ${ESTADOS_VISIBLES}`
    );
    return { activas: Number(result.rows[0]?.activas ?? 0), visibles: Number(result.rows[0]?.visibles ?? 0) };
  } catch {
    return { activas: 0, visibles: 0 };
  }
}

async function facetas(columna: "tematica" | "location_state"): Promise<{ valor: string; total: number }[]> {
  try {
    const result = await pool.query(
      `SELECT ${columna} AS valor, COUNT(*)::int AS total
       FROM campanas
       WHERE ${ESTADOS_VISIBLES} AND ${columna} IS NOT NULL AND ${columna} <> ''
       GROUP BY ${columna}
       ORDER BY total DESC, valor ASC`
    );
    return result.rows;
  } catch {
    return [];
  }
}

export function obtenerTematicasParaExplorar() {
  return facetas("tematica");
}

/** Etiquetas aprobadas de las campañas visibles de una temática, con cuántas campañas tiene cada una. */
export async function obtenerEtiquetasParaExplorar(tematica: string): Promise<{ valor: string; total: number }[]> {
  try {
    const result = await pool.query(
      `SELECT e.nombre AS valor, COUNT(*)::int AS total
       FROM campanas c
       JOIN campana_etiquetas ce ON ce.campana_id = c.id
       JOIN etiquetas e ON e.id = ce.etiqueta_id AND e.aprobada
       WHERE c.${ESTADOS_VISIBLES} AND c.tematica = $1
       GROUP BY e.nombre
       ORDER BY total DESC, valor ASC`,
      [tematica]
    );
    return result.rows;
  } catch {
    return [];
  }
}

export function obtenerEstadosParaExplorar() {
  return facetas("location_state");
}

/** Tipos de dato que piden las campañas visibles, con cuántas campañas pide cada uno (2026-10-28). */
export async function obtenerTiposParaExplorar(): Promise<{ valor: string; total: number }[]> {
  try {
    const result = await pool.query(
      `SELECT t.valor, COUNT(*)::int AS total
       FROM campanas, jsonb_array_elements_text(data_types) AS t(valor)
       WHERE ${ESTADOS_VISIBLES}
       GROUP BY t.valor
       ORDER BY total DESC, t.valor ASC`
    );
    return result.rows;
  } catch {
    return [];
  }
}
