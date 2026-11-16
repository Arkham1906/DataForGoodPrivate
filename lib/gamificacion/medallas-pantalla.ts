// Datos de la pestaña Medallas de Mi progreso (2026-11-15; lienzo aprobado el mismo día; SRS v1.3: RF-GAM-46 a 49).
// Documento: claude/pantallas-v12/medallas-propuesta.md.
// Todo sale de la base y del catálogo: medallas y medalla_niveles (que copian lib/datos/medallas.json: nombre, grupo,
// orden, niveles, umbrales e ilustración), medallas_usuario (nivel registrado), medalla_ascensos (fecha de cada
// nivel) y valoresDeMedallas() (lo que mide cada una hoy, lo mismo con que evaluacion.ts concede los niveles). Una
// medalla nueva del catálogo aparece sola, con su grupo y sus niveles. Solo la persona recibe sus datos.

import { pool } from "@/lib/db";
import { valoresDeMedallas } from "./evaluacion";
import {
  GRUPOS_DE_MEDALLA,
  medallasMasCercanas,
  nivelVisible,
  queMideMedalla,
  type GrupoDeMedalla,
  type MedallaConAvance,
  type MedallaEnPantalla,
  type NivelDeMedalla,
  type PantallaDeMedallas,
} from "./medallas";

const MEDALLAS_CERCA = 3;

export async function obtenerPantallaDeMedallas(usuarioId: number | string): Promise<PantallaDeMedallas | null> {
  try {
    const [medallasR, nivelesR, ascensosR, valores] = await Promise.all([
      pool.query<{ id: number; clave: string; nombre: string; grupo: string | null; mide: string | null; nivel_actual: number }>(
        `SELECT m.id, m.clave, m.nombre, m.grupo, m.mide, COALESCE(mu.nivel_actual, 0)::int AS nivel_actual
            FROM medallas m
            LEFT JOIN medallas_usuario mu ON mu.medalla_id = m.id AND mu.usuario_id = $1
          WHERE m.activa AND m.clave IS NOT NULL
          ORDER BY m.orden NULLS LAST, m.id`,
        [usuarioId],
      ),
      pool.query<NivelDeMedalla & { medalla_id: number }>(
        `SELECT medalla_id, nivel, nombre, umbral, ilustracion_path AS ilustracion FROM medalla_niveles ORDER BY medalla_id, nivel`,
      ),
      pool.query<{ medalla_id: number; nivel: number; alcanzado_en: Date }>(
        `SELECT medalla_id, nivel, MIN(alcanzado_en) AS alcanzado_en FROM medalla_ascensos WHERE usuario_id = $1 GROUP BY 1, 2`,
        [usuarioId],
      ),
      valoresDeMedallas(pool, usuarioId),
    ]);

    const fechas = new Map(ascensosR.rows.map((a) => [`${a.medalla_id}:${a.nivel}`, new Date(a.alcanzado_en).toISOString()]));
    const conAvance: (MedallaConAvance & { id: number; grupo: GrupoDeMedalla })[] = medallasR.rows.map((m) => ({
      id: m.id,
      clave: m.clave,
      nombre: m.nombre,
      grupo: (GRUPOS_DE_MEDALLA as readonly string[]).includes(m.grupo ?? "") ? (m.grupo as GrupoDeMedalla) : "adicionales",
      mide: m.mide,
      nivelActual: m.nivel_actual,
      // El valor de hoy: Pulso Firme puede bajar si llega un rechazo tardío; el nivel registrado no baja (RF-GAM-47).
      valor: (m.mide && valores[m.mide]) || 0,
      niveles: nivelesR.rows.filter((n) => n.medalla_id === m.id).map(({ nivel, nombre, umbral, ilustracion }) => ({ nivel, nombre, umbral, ilustracion })),
    }));

    const medallas: MedallaEnPantalla[] = conAvance
      .filter((m) => m.niveles.length > 0)
      .map((m) => ({
        clave: m.clave,
        nombre: m.nombre,
        grupo: m.grupo,
        mide: m.mide,
        queMide: queMideMedalla(m.mide),
        valor: m.valor,
        nivel: nivelVisible(m),
        niveles: m.niveles.map((n) => ({ ...n, ilustracion: n.ilustracion ?? null, alcanzadoEn: fechas.get(`${m.id}:${n.nivel}`) ?? null })),
      }));

    // Sin avance en ninguna (cuenta nueva) no hay «Más cerca de subir»: todas están en 0 (lienzo del 2026-11-15).
    const cerca = medallasMasCercanas(conAvance, MEDALLAS_CERCA).filter((c) => c.valor > 0);
    return { medallas, cerca };
  } catch (error) {
    console.error("Error armando la pantalla de medallas", error);
    return null;
  }
}
