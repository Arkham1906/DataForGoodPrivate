// Campañas activas donde a una persona le faltan aportes para su cuota (2026-11-10: salió de
// lib/notificaciones/periodicas.ts para no repetir la regla). Cuentan las campañas donde ya aportó y las
// favoritas que cierran a más tardar en `favoritasQueCierranAntesDe`; nunca las propias ni las que la banearon.
// La usan el recordatorio semanal y el aviso del menú lateral (lib/usuarios/aviso-del-menu.ts).

import { pool } from "@/lib/db";

export type CampanaConCuotaPendiente = {
  id: number;
  name: string;
  /** Aportes que le faltan para llegar a la cuota por persona. */
  faltan: number;
  end_date: Date | string | null;
};

export async function campanasConCuotaPendiente(
  usuarioId: number | string,
  opciones: { favoritasQueCierranAntesDe: string; limite: number },
): Promise<CampanaConCuotaPendiente[]> {
  const { rows } = await pool.query<CampanaConCuotaPendiente>(
    `SELECT c.id, c.name, (c.quota_per_user - COUNT(a.id))::int AS faltan, c.end_date
       FROM campanas c
       LEFT JOIN aportes a ON a.campaign_id = c.id AND a.user_id = $1
      WHERE c.status = 'activa' AND c.creator_id <> $1
        AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = c.id AND b.usuario_id = $1)
        AND (EXISTS (SELECT 1 FROM aportes x WHERE x.campaign_id = c.id AND x.user_id = $1)
             OR (EXISTS (SELECT 1 FROM campanas_guardadas g WHERE g.campana_id = c.id AND g.usuario_id = $1)
                 AND c.end_date <= $2::date))
      GROUP BY c.id
      HAVING COUNT(a.id) < c.quota_per_user
      ORDER BY c.end_date ASC NULLS LAST
      LIMIT $3`,
    [usuarioId, opciones.favoritasQueCierranAntesDe, opciones.limite],
  );
  return rows;
}
