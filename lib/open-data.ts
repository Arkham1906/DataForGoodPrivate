import { pool } from "@/lib/db";
import { columnaDeTipos, condicionDeTipos } from "@/lib/campanas/tipos-de-campana";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
import type { DataType } from "@/types";
import { quienOrganiza } from "@/lib/campanas/organizacion";
import { textoDelProposito } from "@/lib/campanas/proposito";
import { sqlDatosPublicados } from "@/lib/campanas/datos-abiertos";

/**
 * Un "conjunto de datos abierto" es una campaña terminada que la supervisión
 * decidió publicar (lib/supervision/datos-abiertos.ts), con el tamaño y las
 * descargas calculados en vivo a partir de `aportes` (ver dominio.md, § 9).
 *
 * TODO(dominio): publicar no anonimiza ni congela el conjunto; esta lectura
 * toma los aportes aceptados de la campaña tal como están hoy en la BD.
 */
export interface OpenDataset {
  id: string;
  name: string;
  description: string;
  /** Quién organiza (quienOrganiza): la organización o, si no puso, el nombre del creador. */
  organizer: string;
  tematica: string;
  /** Para qué se usaron los datos (2026-10-27, lib/campanas/proposito.ts); null en campañas de antes. */
  proposito: string | null;
  dataTypes: DataType[];
  approvedContributions: number;
  /** Aprobados con archivo que sigue en MinIO: los que suman al tamaño y salen en el ZIP. */
  filesCount: number;
  locationCity: string;
  locationState: string;
  /** Para todo el país (lib/campanas/ubicacion.ts). */
  todoElPais: boolean;
  closedAt: string | null; // ISO date (end_date)
  sizeBytes: number;
  sizeLabel: string;
  downloads: number;
  /** La campaña tuvo un supervisor asignado que la llevó a "activa" antes de finalizarse. */
  verified: boolean;
  license: string;
}

export const DATA_TYPE_LABELS: Record<DataType, string> = {
  texto: "Texto",
  foto: "Foto",
  video: "Video",
  audio: "Audio",
  documento: "Archivo",
};

/**
 * Licencia fija para todo el catálogo mientras el equipo no defina un modelo
 * de licenciamiento por campaña (decisión temporal, dominio.md § 9).
 */
export const OPEN_DATA_LICENSE = "CC BY 4.0";

const MIME_FORMAT_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "video/mp4": "MP4",
  "video/webm": "WEBM",
  "video/quicktime": "MOV",
  "audio/mpeg": "MP3",
  "audio/mp4": "M4A",
  "audio/wav": "WAV",
  "audio/ogg": "OGG",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-excel": "XLS",
  "text/plain": "TXT",
};

export function formatMime(mime: string): string {
  if (MIME_FORMAT_LABELS[mime]) return MIME_FORMAT_LABELS[mime];
  const subtype = mime.split("/")[1] ?? mime;
  return subtype.replace(/^x-/, "").toUpperCase();
}

/** Extensión de archivo a partir del MIME real, para nombrar los archivos del ZIP de descarga. */
export function extensionForMime(mime: string): string {
  return `.${formatMime(mime).toLowerCase()}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export type OpenDataOrder = "recientes" | "cobertura" | "descargas";

export interface OpenDataFilters {
  q?: string;
  tematica?: string;
  locationState?: string;
  /** Uno o varios: salen los conjuntos cuya campaña pidió todos (como /explorar, 2026-11-06). */
  tipos?: string[];
  orden?: OpenDataOrder;
}

const SELECT = `
  SELECT c.id, c.name, c.description, c.tematica, c.tag, c.proposito, c.proposito_otro, ${columnaDeTipos("c")},
         est.approved_contributions,
         c.location_city, c.location_state, c.todo_el_pais, c.organizer, c.creator_name,
         c.end_date, c.supervisor_id, c.supervisado_por_root, est.downloads_count,
         COALESCE(f.size_bytes, 0) AS size_bytes,
         COALESCE(f.archivos, 0) AS archivos
  FROM campanas c
  JOIN campana_estadisticas est ON est.campana_id = c.id
  LEFT JOIN LATERAL (
    SELECT SUM(ar.tamano_bytes)::bigint AS size_bytes,
           COUNT(*)::int AS archivos
    FROM aportes a
    JOIN archivos ar ON ar.id = a.archivo_id
    -- Solo archivos que siguen en MinIO: uno borrado por moderación no entra al ZIP.
    WHERE a.campaign_id = c.id AND a.status = 'aceptado' AND ar.borrado_en IS NULL
  ) f ON true
`;

function mapDataset(row: Record<string, unknown>): OpenDataset {
  const approved = Number(row.approved_contributions ?? 0);
  const sizeBytes = Number(row.size_bytes ?? 0);

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    organizer: quienOrganiza({ organizer: row.organizer as string | null, creatorName: row.creator_name as string | null }),
    tematica: String(row.tematica ?? row.tag ?? ""),
    proposito: textoDelProposito(row.proposito, row.proposito_otro),
    dataTypes: Array.isArray(row.data_types) ? (row.data_types as DataType[]) : [],
    approvedContributions: approved,
    filesCount: Number(row.archivos ?? 0),
    locationCity: String(row.location_city ?? ""),
    locationState: String(row.location_state ?? ""),
    todoElPais: row.todo_el_pais === true,
    closedAt: row.end_date ? new Date(String(row.end_date)).toISOString().slice(0, 10) : null,
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    downloads: Number(row.downloads_count ?? 0),
    verified: row.supervisor_id != null || Boolean(row.supervisado_por_root),
    license: OPEN_DATA_LICENSE,
  };
}

const ORDER_SQL: Record<OpenDataOrder, string> = {
  recientes: "c.end_date DESC NULLS LAST",
  cobertura: "est.approved_contributions DESC",
  descargas: "est.downloads_count DESC",
};

// La landing (app/page.tsx) llama estas dos con revalidate = 300, así que se
// prerrenderizan en el build sin Postgres disponible (imagen de Docker);
// igual que contarFilas en metricas.ts, si la BD no responde se devuelve
// vacío en vez de tumbar el build o la página.
export async function buscarConjuntosAbiertos(
  filtros: OpenDataFilters
): Promise<{ conjuntos: OpenDataset[] }> {
  try {
    const condiciones = [sqlDatosPublicados("c")];
    const valores: unknown[] = [];

    const q = filtros.q?.trim();
    if (q) {
      valores.push(`%${q}%`);
      const p = `$${valores.length}`;
      condiciones.push(`(c.name ILIKE ${p} OR c.description ILIKE ${p} OR c.organizer ILIKE ${p} OR c.creator_name ILIKE ${p})`);
    }
    if (filtros.tematica) {
      valores.push(filtros.tematica);
      condiciones.push(`c.tematica = $${valores.length}`);
    }
    if (filtros.locationState) {
      valores.push(filtros.locationState);
      // Una campaña para todo el país también vale en ese estado.
      condiciones.push(`(c.location_state = $${valores.length} OR c.todo_el_pais)`);
    }
    if (filtros.tipos?.length) {
      valores.push(filtros.tipos);
      condiciones.push(condicionDeTipos("c", `$${valores.length}`));
    }

    const orderBy = ORDER_SQL[filtros.orden ?? "recientes"];

    const result = await pool.query(
      `${SELECT} WHERE ${condiciones.join(" AND ")} ORDER BY ${orderBy}`,
      valores
    );

    return { conjuntos: result.rows.map(mapDataset) };
  } catch {
    return { conjuntos: [] };
  }
}

/** Total de conjuntos publicados, sin filtros: para distinguir "catálogo vacío" de "sin resultados para este filtro". */
export async function contarConjuntosPublicados(): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*)::int AS total FROM campanas WHERE ${sqlDatosPublicados("campanas")}`);
    return Number(result.rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

export async function obtenerConjuntoAbierto(id: string): Promise<OpenDataset | null> {
  const result = await pool.query(`${SELECT} WHERE c.id = $1 AND ${sqlDatosPublicados("c")} LIMIT 1`, [id]);
  if (result.rowCount === 0) return null;
  return mapDataset(result.rows[0]);
}

/** Temáticas presentes entre las campañas publicadas, para las facetas del catálogo. */
export async function obtenerTematicasDelCatalogo(): Promise<{ valor: string; total: number }[]> {
  const result = await pool.query(
    `SELECT tematica AS valor, COUNT(*)::int AS total
     FROM campanas
     WHERE ${sqlDatosPublicados("campanas")} AND tematica IS NOT NULL AND tematica <> ''
     GROUP BY tematica
     ORDER BY total DESC, valor ASC`
  );
  return result.rows;
}

/**
 * Tipos de dato de las campañas publicadas, para las facetas del catálogo (2026-11-06, como /explorar). Con
 * tipos elegidos, cada número dice cuántos quedan al sumar ese tipo; salen siempre todos, también en 0, para
 * que la lista no cambie al filtrar.
 */
export async function obtenerTiposDelCatalogo(elegidos: string[] = []): Promise<{ valor: string; total: number }[]> {
  const result = await pool.query(
    `SELECT t.tipo AS valor, COUNT(*)::int AS total
     FROM campanas JOIN campana_tipos t ON t.campana_id = campanas.id
     WHERE ${sqlDatosPublicados("campanas")} AND ${condicionDeTipos("campanas", "$1")}
     GROUP BY t.tipo`,
    [elegidos]
  );
  const totales = new Map<string, number>(result.rows.map((r) => [r.valor, r.total]));
  return Object.keys(NOMBRE_DE_TIPO).map((valor) => ({ valor, total: totales.get(valor) ?? 0 }));
}

/** Estados presentes entre las campañas publicadas, para las facetas del catálogo. */
export async function obtenerEstadosDelCatalogo(): Promise<{ valor: string; total: number }[]> {
  const result = await pool.query(
    `SELECT location_state AS valor, COUNT(*)::int AS total
     FROM campanas
     WHERE ${sqlDatosPublicados("campanas")} AND location_state IS NOT NULL AND location_state <> ''
     GROUP BY location_state
     ORDER BY total DESC, valor ASC`
  );
  return result.rows;
}
