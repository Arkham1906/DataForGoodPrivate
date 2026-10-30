// Roles de cada persona en la tabla usuario_roles (2026-10-30, cuarta tanda de la rama cambios-bd): una
// fila por rol (usuario, supervisor, revisor, admin; lib/roles.ts) con la fecha en que se le dio. Reemplaza
// a la columna JSONB usuarios.role. Un trigger da "usuario" a cada cuenta nueva. Para no tocar cada
// pantalla, columnaDeRoles() la vuelve a dar con ese nombre: ["usuario", "supervisor", ...].

import type { PoolClient } from "pg";

/** Los roles de la fila `u` como antes en usuarios.role ("usuario" primero). Va en el SELECT o el RETURNING. */
export function columnaDeRoles(u = "usuarios"): string {
  return `COALESCE((SELECT jsonb_agg(ur.rol ORDER BY ur.rol <> 'usuario', ur.asignado_en, ur.rol)
             FROM usuario_roles ur WHERE ur.usuario_id = ${u}.id), '["usuario"]'::jsonb) AS role`;
}

/** Condición "la fila `u` tiene el rol" (antes `u.role @> '["supervisor"]'`); `rol` es un literal o un parámetro. */
export function condicionDeRol(u: string, rol: string): string {
  return `EXISTS (SELECT 1 FROM usuario_roles ur WHERE ur.usuario_id = ${u}.id AND ur.rol = ${rol})`;
}

/** Da el rol (si ya lo tenía, no cambia nada). Devuelve si lo agregó. */
export async function agregarRol(client: Pick<PoolClient, "query">, usuarioId: number, rol: string): Promise<boolean> {
  const { rowCount } = await client.query(
    `INSERT INTO usuario_roles (usuario_id, rol) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [usuarioId, rol],
  );
  return (rowCount ?? 0) > 0;
}

/** Quita el rol ("usuario" no se quita). Devuelve si lo tenía. */
export async function quitarRol(client: Pick<PoolClient, "query">, usuarioId: number, rol: string): Promise<boolean> {
  const { rowCount } = await client.query(
    `DELETE FROM usuario_roles WHERE usuario_id = $1 AND rol = $2 AND rol <> 'usuario'`,
    [usuarioId, rol],
  );
  return (rowCount ?? 0) > 0;
}
