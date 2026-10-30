// Archivo de un aporte en la tabla `archivos` (2026-10-30, tercera tanda de la rama cambios-bd): ruta en
// MinIO, nombre original, tipo MIME, tamaño y cuándo se borró de MinIO (la fila se conserva). El aporte
// apunta con aportes.archivo_id; NULL = aporte de solo texto. Antes eran las columnas file_path,
// file_original_name, file_mime_type, file_size_bytes y archivo_borrado_en de aportes; para no tocar
// cada pantalla, columnasDeArchivo() las vuelve a dar con esos nombres. aportes.file_type se queda:
// es el tipo de dato del aporte (texto no tiene archivo). Las medallas siguen con sus columnas file_*
// (son de gamificación). Al borrar un aporte, un trigger borra su fila de archivos.

import type { PoolClient } from "pg";
import type { SavedUpload } from "@/lib/minio";

/**
 * file_path ('' sin archivo, como antes), file_original_name, file_mime_type, file_size_bytes y
 * archivo_borrado_en del aporte `a` (alias de la tabla). Va en la lista del SELECT o del RETURNING.
 */
export function columnasDeArchivo(a = "aportes"): string {
  const de = (columna: string) => `(SELECT ar.${columna} FROM archivos ar WHERE ar.id = ${a}.archivo_id)`;
  return `COALESCE(${de("ruta")}, '') AS file_path,
          ${de("nombre_original")} AS file_original_name,
          ${de("mime")} AS file_mime_type,
          ${de("tamano_bytes")} AS file_size_bytes,
          ${de("borrado_en")} AS archivo_borrado_en`;
}

/** Registra en `archivos` lo que se subió a MinIO y devuelve su id (null si el aporte no trae archivo). */
export async function registrarArchivo(
  client: Pick<PoolClient, "query">,
  guardado: SavedUpload | null,
  nombreOriginal: string | null = null,
): Promise<number | null> {
  if (!guardado) return null;
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO archivos (ruta, nombre_original, mime, tamano_bytes) VALUES ($1, $2, $3, $4) RETURNING id`,
    [guardado.relativePath, nombreOriginal, guardado.mimeType, guardado.sizeBytes],
  );
  return rows[0].id;
}
