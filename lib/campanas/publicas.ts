import { pool } from "@/lib/db";
import { activateScheduledCampaigns, calculateCampaignDaysRemaining, finalizeExpiredCampaigns } from "@/lib/campaign-date";

/**
 * Campañas activas para la vitrina pública /explorar. Solo expone lo que ya
 * se ve en la landing y en /datos: nada de quién aporta ni de la revisión.
 */
export type CampanaPublica = {
  id: string;
  name: string;
  description: string;
  tematica: string;
  organizer: string;
  locationCity: string;
  locationState: string;
  dataTypes: string[];
  currentContributions: number;
  goalContributions: number;
  participants: number;
  daysRemaining: number | null;
};

export type OrdenDeCampanas = "participacion" | "recientes" | "cierre";

const ORDER_SQL: Record<OrdenDeCampanas, string> = {
  participacion: "participants DESC, current_contributions DESC",
  recientes: "created_at DESC",
  cierre: "end_date ASC NULLS LAST",
};

export type FiltrosDeCampanas = {
  q?: string;
  tematica?: string;
  locationState?: string;
  orden?: OrdenDeCampanas;
};

function mapCampana(row: Record<string, unknown>): CampanaPublica {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    tematica: String(row.tematica ?? ""),
    organizer: String(row.organizer ?? ""),
    locationCity: String(row.location_city ?? ""),
    locationState: String(row.location_state ?? ""),
    dataTypes: Array.isArray(row.data_types) ? row.data_types.map(String) : [],
    currentContributions: Number(row.current_contributions ?? 0),
    goalContributions: Number(row.goal_contributions ?? 0),
    participants: Number(row.participants ?? 0),
    daysRemaining: calculateCampaignDaysRemaining(row.end_date),
  };
}

// Igual que en open-data.ts: si la BD no responde (o la tabla aún no existe)
// se devuelve vacío en vez de tumbar la página.
export async function buscarCampanasActivas(filtros: FiltrosDeCampanas): Promise<CampanaPublica[]> {
  try {
    // Una programada cuya hora de inicio ya llegó sale sin esperar a la tarea de cada minuto.
    await activateScheduledCampaigns();
    await finalizeExpiredCampaigns();
    const condiciones = ["status = 'activa'"];
    const valores: unknown[] = [];

    const q = filtros.q?.trim();
    if (q) {
      valores.push(`%${q}%`);
      const p = `$${valores.length}`;
      condiciones.push(`(name ILIKE ${p} OR description ILIKE ${p} OR organizer ILIKE ${p} OR location_city ILIKE ${p})`);
    }
    if (filtros.tematica) {
      valores.push(filtros.tematica);
      condiciones.push(`tematica = $${valores.length}`);
    }
    if (filtros.locationState) {
      valores.push(filtros.locationState);
      condiciones.push(`location_state = $${valores.length}`);
    }

    const result = await pool.query(
      `SELECT id, name, description, tematica, organizer, location_city, location_state, data_types,
              current_contributions, goal_contributions, participants, end_date
       FROM campanas
       WHERE ${condiciones.join(" AND ")}
       ORDER BY ${ORDER_SQL[filtros.orden ?? "participacion"]}`,
      valores
    );
    return result.rows.map(mapCampana);
  } catch {
    return [];
  }
}

/** Total de campañas activas, sin filtros: distingue "no hay campañas" de "sin resultados". */
export async function contarCampanasActivas(): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*)::int AS total FROM campanas WHERE status = 'activa'`);
    return Number(result.rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

async function facetas(columna: "tematica" | "location_state"): Promise<{ valor: string; total: number }[]> {
  try {
    const result = await pool.query(
      `SELECT ${columna} AS valor, COUNT(*)::int AS total
       FROM campanas
       WHERE status = 'activa' AND ${columna} IS NOT NULL AND ${columna} <> ''
       GROUP BY ${columna}
       ORDER BY total DESC, valor ASC`
    );
    return result.rows;
  } catch {
    return [];
  }
}

export function obtenerTematicasActivas() {
  return facetas("tematica");
}

export function obtenerEstadosActivos() {
  return facetas("location_state");
}
