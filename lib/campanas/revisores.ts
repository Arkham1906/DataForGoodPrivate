// Quitar a un revisor de aportes de una campaña o cancelar su invitación (2026-10-22, a pedido del
// usuario, junto con quitar el límite de revisores). Lo llama DELETE /api/campanas/[id]/revisores,
// que ya comprobó que quien pide es el creador.
//   - Invitación pendiente: se borra la fila de campana_revisores y su notificación de invitación;
//     si la persona intenta aceptarla, /api/notificaciones/[id]/aceptar responde 409.
//   - Revisor aceptado: se borra su fila; si ya no revisa ninguna otra campaña, se le quita "revisor"
//     de usuarios.role (lib/session.ts lo reconstruye de las filas 'aceptado', así que con la fila
//     borrada no vuelve). campanas.has_reviewer_assigned se recalcula. Los aportes que ya decidió
//     no cambian (la decisión no se cambia; aportes.first_pass_by_user_id se conserva).
// Todo en una transacción.

import { pool } from "@/lib/db";

export type ResultadoDeQuitarRevisor =
  | { ok: true; estadoAnterior: "invitado" | "aceptado"; nombreDeCampana: string }
  | { ok: false; status: 404 | 409; error: string };

export async function quitarRevisor(campanaId: number, usuarioId: number): Promise<ResultadoDeQuitarRevisor> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const fila = await client.query<{ estado: string; nombre: string }>(
      `DELETE FROM campana_revisores r USING campanas c
       WHERE r.campana_id = $1 AND r.usuario_id = $2 AND c.id = r.campana_id
         AND r.estado IN ('invitado', 'aceptado')
       RETURNING r.estado, c.name AS nombre`,
      [campanaId, usuarioId],
    );
    if (fila.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, status: 404, error: "Esa persona no es revisora ni tiene una invitación pendiente en esta campaña" };
    }
    const { estado, nombre } = fila.rows[0];

    if (estado === "invitado") {
      await client.query(
        `DELETE FROM notificaciones WHERE usuario_id = $1 AND campana_id = $2 AND tipo = 'invitacion_revisor'`,
        [usuarioId, campanaId],
      );
    } else {
      await client.query(
        `UPDATE usuarios SET role = role - 'revisor', updated_at = NOW()
         WHERE id = $1 AND role ? 'revisor'
           AND NOT EXISTS (SELECT 1 FROM campana_revisores WHERE usuario_id = $1 AND estado = 'aceptado')`,
        [usuarioId],
      );
      await client.query(
        `UPDATE campanas SET has_reviewer_assigned = EXISTS (
           SELECT 1 FROM campana_revisores WHERE campana_id = $1 AND estado = 'aceptado'
         ), updated_at = NOW()
         WHERE id = $1`,
        [campanaId],
      );
    }

    await client.query("COMMIT");
    return { ok: true, estadoAnterior: estado as "invitado" | "aceptado", nombreDeCampana: nombre };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
