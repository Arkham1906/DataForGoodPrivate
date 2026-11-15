// Rango y EXP de una cuenta para pantallas fuera de «Mi progreso» (2026-11-13, A6; SRS v1.3: RF-GAM-16, 77, 82):
// el distintivo de Mi cuenta y lo que se pierde al eliminar la cuenta. Sustituye a usuarios.level y
// usuarios.xp_total, columnas anteriores que ya no se actualizan. Es el rango actual de la propia persona, que siempre
// puede ver su nombre (RF-GAM-78). Una cuenta sin fila de progreso está en el rango 1 con 0 EXP.
// Pendiente (decisión del 13 nov): más adelante el distintivo se acercará al avatar de gamificación.

import { pool } from "@/lib/db";

export type RangoDeCuenta = {
  numero: number;
  nombre: string;
  exp: number;
  /** Medallas con al menos un nivel alcanzado. */
  medallas: number;
};

/** null si falla la lectura (se loguea): quien la usa decide si oculta el dato. */
export async function obtenerRangoDeCuenta(usuarioId: number | string): Promise<RangoDeCuenta | null> {
  try {
    const { rows } = await pool.query<{ numero: number; nombre: string; exp: number; medallas: number }>(
      `SELECT r.numero, r.nombre,
              COALESCE(p.exp_total, 0)::int AS exp,
              (SELECT COUNT(DISTINCT m.medalla_id) FROM medalla_ascensos m WHERE m.usuario_id = $1)::int AS medallas
         FROM rangos r
         LEFT JOIN usuario_progreso p ON p.usuario_id = $1
        WHERE r.numero = COALESCE(p.rango_actual, 1)`,
      [usuarioId],
    );
    const fila = rows[0];
    return fila ? { numero: fila.numero, nombre: fila.nombre, exp: fila.exp, medallas: fila.medallas } : null;
  } catch (error) {
    console.error("Error leyendo el rango de la cuenta", error);
    return null;
  }
}
