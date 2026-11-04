// Qué campañas puede leer cada quien con GET /api/campanas y GET /api/campanas/[id]
// (decisión del usuario, 2026-10-20). Antes los dos devolvían cualquier campaña, en cualquier
// estado, sin sesión.
//   - Cualquiera, con o sin sesión: activa, pausada y finalizada.
//   - El creador: las suyas, en cualquier estado.
//   - El supervisor (rol): además las que están en revisión (para tomarlas) y las que supervisa.
//   - El revisor aceptado de una campaña: esa campaña.
//   - La sesión raíz: todas.
// El resto (borrador, en_revision, aceptada/programada, rechazada) responde 404, como si no existiera.

import { hasRootSession } from "@/lib/rootSession";
import type { SessionUser } from "@/lib/session";

export const ESTADOS_PUBLICOS = ["activa", "pausada", "finalizada"] as const;

/**
 * Condición SQL para la tabla `campanas` (con el alias que se pase) y sus parámetros, numerados
 * desde `desde`. Se agrega con AND al WHERE de la consulta.
 */
export async function condicionDeVisibilidad(
  user: SessionUser | null,
  alias = "campanas",
  desde = 1,
): Promise<{ sql: string; params: unknown[] }> {
  if (await hasRootSession()) return { sql: "TRUE", params: [] };

  const estados = `$${desde}`;
  if (!user) return { sql: `${alias}.status = ANY(${estados}::text[])`, params: [[...ESTADOS_PUBLICOS]] };

  const usuario = `$${desde + 1}`;
  const esSupervisor = `$${desde + 2}`;
  return {
    sql: `(${alias}.status = ANY(${estados}::text[])
           OR ${alias}.creator_id = ${usuario}
           OR (${esSupervisor} AND (${alias}.status = 'en_revision' OR ${alias}.supervisor_id = ${usuario}))
           OR EXISTS (SELECT 1 FROM campana_revisores r
                      WHERE r.campana_id = ${alias}.id AND r.usuario_id = ${usuario} AND r.estado = 'aceptado'))`,
    params: [[...ESTADOS_PUBLICOS], user.id, user.role.includes("supervisor")],
  };
}
