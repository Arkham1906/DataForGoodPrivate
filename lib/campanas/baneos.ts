import { pool } from "@/lib/db";

/*
 * Baneo por campaña (tabla campana_baneados): lo aplica el creador desde el
 * detalle de un aporte y solo impide aportar a esa campaña. No confundir con
 * la sanción de cuenta BANEO_DE_CAMPANA de lib/sanciones.ts, que bloquea toda
 * la cuenta.
 */

export type BaneadoDeCampana = {
  usuarioId: string;
  nombre: string;
  motivo: string;
  baneadoEn: string; // ISO
};

export async function estaBaneadoDeCampana(campanaId: string | number, usuarioId: string | number): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM campana_baneados WHERE campana_id = $1 AND usuario_id = $2 LIMIT 1`,
    [campanaId, usuarioId]
  );
  return (result.rowCount ?? 0) > 0;
}
export async function listarBaneadosDeCampana(campanaId: string | number): Promise<BaneadoDeCampana[]> {
  const result = await pool.query(
    `SELECT b.usuario_id, b.motivo, b.created_at, u.nombre, u.apellidos
     FROM campana_baneados b
     JOIN usuarios u ON u.id = b.usuario_id
     WHERE b.campana_id = $1
     ORDER BY b.created_at DESC`,
    [campanaId]
  );
  return result.rows.map((row) => ({
    usuarioId: String(row.usuario_id),
    nombre: `${row.nombre ?? ""} ${row.apellidos ?? ""}`.trim(),
    motivo: String(row.motivo ?? ""),
    baneadoEn: new Date(row.created_at).toISOString(),
  }));
}
/** Devuelve false si esa persona no estaba baneada de la campaña. */
export async function quitarBaneoDeCampana(campanaId: string | number, usuarioId: string | number): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM campana_baneados WHERE campana_id = $1 AND usuario_id = $2`,
    [campanaId, usuarioId]
  );
  return (result.rowCount ?? 0) > 0;
}
/** Campañas de las que esta persona está baneada, para marcarlas en las listas (isBanned). */
export async function idsDeCampanasConBaneo(usuarioId: string | number): Promise<Set<number>> {
  const result = await pool.query<{ campana_id: number }>(
    `SELECT campana_id FROM campana_baneados WHERE usuario_id = $1`,
    [usuarioId]
  );
  return new Set(result.rows.map((row) => Number(row.campana_id)));
}

export type BaneoDeUsuario = {
  campanaId: string;
  campana: string;
  motivo: string;
  baneadoPor: string;
  baneadoEn: Date;
};

/** Baneos por campaña de una persona, para su ficha en el panel del SuperUsuario. */
export async function baneosDeUsuario(usuarioId: string | number): Promise<BaneoDeUsuario[]> {
  const result = await pool.query(
    `SELECT b.campana_id, b.motivo, b.created_at, c.name, u.nombre, u.apellidos
     FROM campana_baneados b
     JOIN campanas c ON c.id = b.campana_id
     LEFT JOIN usuarios u ON u.id = b.baneado_por
     WHERE b.usuario_id = $1
     ORDER BY b.created_at DESC`,
    [usuarioId]
  );
  return result.rows.map((row) => ({
    campanaId: String(row.campana_id),
    campana: String(row.name ?? ""),
    motivo: String(row.motivo ?? ""),
    baneadoPor: `${row.nombre ?? ""} ${row.apellidos ?? ""}`.trim() || "Creador de la campaña",
    baneadoEn: new Date(row.created_at),
  }));
}
