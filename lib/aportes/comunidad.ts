// Aportes de la comunidad: los aportes completos (con su archivo) que se ven sin sesión. Los usan
// "Lo último que aportó la comunidad" de la landing (los 8 más nuevos, 2026-11-22) y la pantalla /comunidad, con
// todos y "Ver más" (2026-11-22, a pedido del usuario).
// Decisión del usuario (2026-11-22): entran los aportes APROBADOS de campañas visibles públicamente (activa,
// pausada o finalizada), aunque la campaña aún no publique sus datos abiertos. Nunca un pendiente ni un
// rechazado, nunca un archivo que el creador borró, y nunca quién lo envió.
//
// Una regla, un lugar: las pantallas los listan con aportesDeLaComunidad() y GET /api/aportes/[id]/archivo deja
// ver sin sesión el archivo de uno solo si cumple la misma condición (esAporteDeLaComunidad). Del 2026-11-22
// (mañana) a la tarde solo se abrían los 8 de la landing; con /comunidad todos los que se listan.

import { pool } from "@/lib/db";
import { columnasDeArchivo } from "@/lib/aportes/tabla-archivos";
import type { DataType } from "@/types";

/** Cuántos salen en la landing (dos filas de 4). */
export const APORTES_EN_LA_PORTADA = 8;
/** Cuántos más trae cada "Ver más" de /comunidad (múltiplo de 4: filas completas). */
export const APORTES_POR_TANDA = 24;
/** Tope de lo que se pinta de una vez en /comunidad (?mostrar=). */
export const MAXIMO_A_LA_VEZ = 240;

/** La condición de "aporte de la comunidad" sobre `aportes a JOIN campanas c`. */
const CONDICION = `a.status = 'aceptado'
     AND c.status IN ('activa', 'pausada', 'finalizada')
     AND NOT EXISTS (SELECT 1 FROM archivos ar WHERE ar.id = a.archivo_id AND ar.borrado_en IS NOT NULL)`;

export interface AporteDeLaComunidad {
  id: string;
  /** Temática (o etiqueta) de la campaña. */
  tag: string;
  description: string;
  /** ISO en UTC. */
  submittedAt: string;
  tipo: DataType;
  /** Sin archivo (aporte de solo texto en la descripción). */
  sinArchivo: boolean;
  mimeType: string | null;
}

/** Los aportes de la comunidad, del más nuevo al más viejo. */
export async function aportesDeLaComunidad(limite: number, desde = 0): Promise<AporteDeLaComunidad[]> {
  // Sale como ISO en UTC con "Z" para no depender de la zona del proceso (UTC en Docker, la de la máquina en `next dev`).
  const { rows } = await pool.query(
    `SELECT a.id, COALESCE(NULLIF(c.tag, ''), c.tematica) AS tag, a.description, a.file_type, ${columnasDeArchivo("a")},
            to_char(a.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS submitted_at
       FROM aportes a
       JOIN campanas c ON c.id = a.campaign_id
      WHERE ${CONDICION}
      ORDER BY a.submitted_at DESC, a.id DESC
      LIMIT $1 OFFSET $2`,
    [limite, desde],
  );
  return rows.map((row) => ({
    id: String(row.id),
    tag: String(row.tag ?? ""),
    description: String(row.description ?? ""),
    submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : new Date().toISOString(),
    tipo: String(row.file_type ?? "foto") as DataType,
    sinArchivo: !row.file_path,
    mimeType: row.file_mime_type ? String(row.file_mime_type) : null,
  }));
}

/** Los de la landing: los 8 más nuevos. */
export function aportesDeLaPortada(): Promise<AporteDeLaComunidad[]> {
  return aportesDeLaComunidad(APORTES_EN_LA_PORTADA);
}

export async function contarAportesDeLaComunidad(): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM aportes a JOIN campanas c ON c.id = a.campaign_id WHERE ${CONDICION}`,
  );
  return Number(rows[0]?.total ?? 0);
}

/** true si el aporte se muestra a la comunidad: su archivo se puede ver sin sesión. */
export async function esAporteDeLaComunidad(aporteId: string | number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM aportes a JOIN campanas c ON c.id = a.campaign_id WHERE a.id = $1 AND ${CONDICION}`,
    [aporteId],
  );
  return (rowCount ?? 0) > 0;
}
