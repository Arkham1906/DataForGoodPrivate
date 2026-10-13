// Lista negra de correos (2026-10-12). Un correo entra al cuarto aviso o con un baneo inmediato
// (aplicarSancion) y sale si se restaura ese baneo (restaurarAcceso). Mientras esté, no se puede crear
// una cuenta con él: ni con el registro (POST /api/usuarios) ni con Google (callback). La cuenta baneada
// que ya existe sigue entrando, pero solo ve /cuenta-bloqueada.

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";

export const MENSAJE_CORREO_BLOQUEADO =
  "Este correo no puede usarse en DataForGood porque su cuenta fue baneada.";

const normalizar = (email: string) => email.trim().toLowerCase();

export async function correoEnListaNegra(email: string): Promise<boolean> {
  const { rowCount } = await pool.query(`SELECT 1 FROM lista_negra_correos WHERE email = $1`, [normalizar(email)]);
  return (rowCount ?? 0) > 0;
}

/** Agrega el correo de la cuenta, dentro de la transacción del baneo. Si ya estaba, lo liga al baneo nuevo. */
export async function agregarAListaNegra(
  client: PoolClient,
  datos: { usuarioId: number; sancionId: number; motivo: string },
): Promise<void> {
  await client.query(
    `INSERT INTO lista_negra_correos (email, usuario_id, sancion_id, motivo)
     SELECT LOWER(TRIM(email)), id, $2, $3 FROM usuarios WHERE id = $1
     ON CONFLICT (email) DO UPDATE SET sancion_id = EXCLUDED.sancion_id, motivo = EXCLUDED.motivo`,
    [datos.usuarioId, datos.sancionId, datos.motivo],
  );
}

/** Saca de la lista el correo que entró con este baneo (al restaurarlo). */
export async function quitarDeListaNegra(sancionId: number): Promise<void> {
  await pool.query(`DELETE FROM lista_negra_correos WHERE sancion_id = $1`, [sancionId]);
}

export type CorreoEnListaNegra = { email: string; usuarioId: string | null; usuario: string | null; motivo: string | null; desde: Date };

/** Para la lista de sanciones de la moderación (/supervisar/sanciones y /supervision/sanciones). */
export async function listarListaNegra(): Promise<CorreoEnListaNegra[]> {
  try {
    const { rows } = await pool.query<{
      email: string;
      usuario_id: number | null;
      usuario: string | null;
      motivo: string | null;
      creado_en: Date;
    }>(
      `SELECT l.email, l.usuario_id, NULLIF(TRIM(u.nombre || ' ' || u.apellidos), '') AS usuario, l.motivo, l.creado_en
       FROM lista_negra_correos l LEFT JOIN usuarios u ON u.id = l.usuario_id
       ORDER BY l.creado_en DESC`,
    );
    return rows.map((r) => ({
      email: r.email,
      usuarioId: r.usuario_id ? String(r.usuario_id) : null,
      usuario: r.usuario,
      motivo: r.motivo,
      desde: r.creado_en,
    }));
  } catch (error) {
    console.error("Error listando la lista negra", error);
    return [];
  }
}
