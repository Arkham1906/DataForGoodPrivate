// Parámetros vigentes de la gamificación (2026-11-09; SRS v1.3: RF-GAM-64, 67; RNF-GAM-05). Lee la versión de
// parametros_gamificacion con mayor vigente_desde que ya empezó y la fecha de lanzamiento del módulo (la primera
// lanzamiento_en guardada). Lo usan lib/gamificacion/recompensas.ts y lib/gamificacion/evaluacion.ts.

import type { PoolClient } from "pg";
import { parametrosDesde, type ParametrosDeGamificacion } from "./exp-reglas";

export type ParametrosVigentes = {
  version: number;
  valores: ParametrosDeGamificacion;
  /** Desde cuándo cuenta la gamificación (RF-GAM-67): lo aceptado antes no da EXP. null = el módulo no está activo. */
  lanzamiento: Date | null;
};

/** null si no hay una versión vigente con la forma de la v2 (se loguea): sin parámetros válidos no se concede nada. */
export async function leerParametros(client: Pick<PoolClient, "query">): Promise<ParametrosVigentes | null> {
  const { rows } = await client.query<{ version: number; valores: unknown; lanzamiento: Date | string | null }>(
    `SELECT version, valores, (SELECT MIN(lanzamiento_en) FROM parametros_gamificacion) AS lanzamiento
      FROM parametros_gamificacion
      WHERE vigente_desde <= NOW()
      ORDER BY vigente_desde DESC, version DESC
      LIMIT 1`,
  );
  const fila = rows[0];
  const valores = parametrosDesde(fila?.valores);
  if (!fila || !valores) {
    console.error("parametros_gamificacion no tiene una versión vigente con la forma de la v2: no se concede EXP.");
    return null;
  }
  return { version: fila.version, valores, lanzamiento: fila.lanzamiento ? new Date(fila.lanzamiento) : null };
}
