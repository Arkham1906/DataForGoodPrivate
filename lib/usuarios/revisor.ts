import { pool } from "@/lib/db";

/**
 * `campana_revisores` (no `usuarios.role`) es la fuente real de si alguien es
 * revisor: `lib/session.ts` reconstruye el rol "revisor" en cada sesión a
 * partir de sus filas 'aceptado' ahí. Si solo se limpia `usuarios.role`, el
 * rol vuelve a aparecer solo con el siguiente login. Se usa al revocar el
 * rol de Revisor de aportes (`revocarRol`).
 */
export async function retirarComoRevisorDeTodasLasCampanas(usuarioId: number): Promise<void> {
  const campanasAfectadas = await pool.query<{ campana_id: number }>(
    `UPDATE campana_revisores SET estado = 'rechazado'
     WHERE usuario_id = $1 AND estado = 'aceptado'
     RETURNING campana_id`,
    [usuarioId],
  );

  for (const fila of campanasAfectadas.rows) {
    // "Tiene revisor" se calcula de campana_revisores (2026-10-30); updated_at avisa a las pantallas abiertas.
    await pool.query(
      `UPDATE campanas SET updated_at = NOW() WHERE id = $1`,
      [fila.campana_id],
    );
  }
}
