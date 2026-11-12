import { pool } from "@/lib/db";
import { columnaDeTipos, condicionDeTipos } from "@/lib/campanas/tipos-de-campana";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
import { activateScheduledCampaigns, calculateCampaignDaysRemaining, finalizeExpiredCampaigns } from "@/lib/campaign-date";
import { etiquetasDeCampanas } from "@/lib/etiquetas/catalogo";
import { tematicasVisibles } from "@/lib/tematicas/catalogo";
import { slugDeTematica } from "@/lib/tematicas/ruta";

/**
 * Campañas de la vitrina pública /explorar: solo las activas. Del 2026-10-24 al 2026-11-03 también salían
 * las pausadas; se quitaron a pedido del usuario, igual que en /campanas. Solo expone lo que ya se ve en la
 * landing y en /datos: nada de quién aporta ni de la revisión.
 */
export type CampanaPublica = {
  id: string;
  name: string;
  description: string;
  hasBanner: boolean;
  bannerVersion?: string;
  bannerScale: number;
  bannerPositionX: number;
  bannerPositionY: number;
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
  status: "activa";
};

export type OrdenDeCampanas = "participacion" | "recientes" | "cierre" | "mayor_avance" | "menor_avance" | "menos_aportes";

/** Estados que salen en /explorar. */
const ESTADOS_VISIBLES = "status = 'activa'";

const ORDER_SQL: Record<OrdenDeCampanas, string> = {
  participacion: "est.participants DESC, est.current_contributions DESC",
  recientes: "created_at DESC",
  cierre: "end_date ASC NULLS LAST",
  mayor_avance: "CASE WHEN goal_contributions > 0 THEN est.approved_contributions::float / goal_contributions ELSE 0 END DESC, created_at DESC",
  menor_avance: "CASE WHEN goal_contributions > 0 THEN est.approved_contributions::float / goal_contributions ELSE 0 END ASC, created_at DESC",
  menos_aportes: "est.current_contributions ASC, created_at DESC",
};

export type FiltrosDeCampanas = {
  q?: string;
  tematica?: string;
  /** Subtemática (nombre); solo tiene sentido junto con `tematica`. */
  etiqueta?: string;
  locationState?: string;
  /** Tipo de dato que pide la campaña (foto, video, audio, documento o texto; 2026-10-28). */
  /** Tipos de dato: salen las campañas que los piden todos (2026-11-03). */
  tipos?: string[];
  orden?: OrdenDeCampanas;
  /** Cuántas como máximo (2026-11-12: las más recientes de la landing); sin él, todas. */
  limite?: number;
};

function mapCampana(row: Record<string, unknown>): CampanaPublica {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    hasBanner: Boolean(row.banner_path),
    bannerVersion: row.updated_at ? String(row.updated_at) : undefined,
    bannerScale: Number(row.banner_scale ?? 1),
    bannerPositionX: Number(row.banner_position_x ?? 50),
    bannerPositionY: Number(row.banner_position_y ?? 50),
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
    status: "activa",
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
    if (filtros.tipos?.length) {
      valores.push(filtros.tipos);
      condiciones.push(condicionDeTipos("campanas", `$${valores.length}`));
    }
    let limite = "";
    if (filtros.limite !== undefined && Number.isInteger(filtros.limite) && filtros.limite > 0) {
      valores.push(filtros.limite);
      limite = `LIMIT $${valores.length}`;
    }

    const result = await pool.query(
      `SELECT id, name, description, banner_path, banner_scale, banner_position_x, banner_position_y, tematica, organizer, creator_name, location_city, location_state, todo_el_pais, ${columnaDeTipos()},
              est.approved_contributions, goal_contributions, est.participants, end_date, status
       FROM campanas
       JOIN campana_estadisticas est ON est.campana_id = campanas.id
       WHERE ${condiciones.join(" AND ")}
       ORDER BY ${ORDER_SQL[filtros.orden ?? "participacion"]}
       ${limite}`,
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

/** Activas, sin filtros: va en el texto de arriba y distingue "no hay campañas" de "sin resultados". */
export async function contarCampanasParaExplorar(): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS activas FROM campanas WHERE ${ESTADOS_VISIBLES}`
    );
    return Number(result.rows[0]?.activas ?? 0);
  } catch {
    return 0;
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
export async function obtenerTiposParaExplorar(elegidos: string[] = []): Promise<{ valor: string; total: number }[]> {
  try {
    const result = await pool.query(
      `SELECT t.tipo AS valor, COUNT(*)::int AS total
       FROM campanas JOIN campana_tipos t ON t.campana_id = campanas.id
       WHERE ${ESTADOS_VISIBLES} AND ${condicionDeTipos("campanas", "$1")}
       GROUP BY t.tipo`,
      [elegidos]
    );
    // Con tipos elegidos, cada número dice cuántas quedan al sumar ese tipo. Salen siempre todos los tipos y
    // en el mismo orden, también en 0: la lista no cambia al filtrar (2026-11-03, a pedido del usuario).
    const totales = new Map<string, number>(result.rows.map((r) => [r.valor, r.total]));
    return Object.keys(NOMBRE_DE_TIPO).map((valor) => ({ valor, total: totales.get(valor) ?? 0 }));
  } catch {
    return [];
  }
}

/**
 * La temática de /explorar/tematica/[slug] (2026-11-12): primero entre las que tienen campañas visibles y
 * después en el catálogo (una temática sin campañas activas también tiene su página, vacía). null si el slug
 * no es de ninguna: la página responde 404.
 */
export async function resolverTematicaDeRuta(slug: string): Promise<string | null> {
  const [conCampanas, catalogo] = await Promise.all([
    obtenerTematicasParaExplorar(),
    tematicasVisibles().catch(() => [] as string[]),
  ]);
  return [...conCampanas.map((t) => t.valor), ...catalogo].find((nombre) => slugDeTematica(nombre) === slug) ?? null;
}
