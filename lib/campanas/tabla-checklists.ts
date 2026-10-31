// Checklists de campaña en tablas (2026-10-30, cuarta tanda de la rama cambios-bd): campana_checklists
// (título, tipo de dato y orden), checklist_opciones (las opciones de cada uno) y aporte_respuestas
// (qué opciones marcó cada aporte). Reemplazan a las columnas JSONB campanas.checklist_secciones,
// campanas.checklist_opciones y aportes.caracteristicas. Para no tocar cada pantalla, columnaDeChecklists()
// y columnaDeRespuestas() las vuelven a dar con esos nombres y la misma forma (lib/campanas/checklist.ts).
//
// Un checklist u opción que el creador quita y ya tiene respuestas no se borra: queda con retirado_en
// (ya no se ve al aportar) y los aportes que la marcaron la siguen mostrando. Sin respuestas, se borra.

import type { PoolClient } from "pg";
import type { SeccionDeChecklist } from "@/lib/campanas/checklist";

/** Cómo se lee una respuesta (etiquetaDeRespuesta de lib/campanas/checklist.ts): "Título: opción". */
const ETIQUETA = `CASE WHEN cc.titulo = '' THEN o.texto ELSE cc.titulo || ': ' || o.texto END`;

/**
 * Los checklists vigentes de la campaña `c` como antes en checklist_secciones:
 * [{ titulo, opciones, tipo? }] en el orden del creador. Va en la lista del SELECT o del RETURNING.
 */
export function columnaDeChecklists(c = "campanas", alias = "checklist_secciones"): string {
  return `COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'titulo', cc.titulo,
                    'tipo', cc.tipo,
                    'opciones', (SELECT COALESCE(jsonb_agg(o.texto ORDER BY o.orden), '[]'::jsonb)
                                   FROM checklist_opciones o
                                  WHERE o.checklist_id = cc.id AND o.retirada_en IS NULL)))
                  ORDER BY cc.orden)
             FROM campana_checklists cc
            WHERE cc.campana_id = ${c}.id AND cc.retirado_en IS NULL), '[]'::jsonb) AS ${alias}`;
}

/** Lo que marcó el aporte `a`, como antes en aportes.caracteristicas: ["Título: opción", ...]. */
export function columnaDeRespuestas(a = "aportes"): string {
  return `COALESCE((SELECT jsonb_agg(${ETIQUETA} ORDER BY cc.orden, o.orden)
             FROM aporte_respuestas r
             JOIN checklist_opciones o ON o.id = r.opcion_id
             JOIN campana_checklists cc ON cc.id = o.checklist_id
            WHERE r.aporte_id = ${a}.id), '[]'::jsonb) AS caracteristicas`;
}

/**
 * Deja los checklists de la campaña como los manda el formulario (ya pasados por normalizarSecciones):
 * agrega los nuevos, reordena, retira o borra los que ya no están. Un checklist se reconoce por su tipo
 * y su título (sin distinguir mayúsculas), y una opción por su texto: cambiar un título es quitar uno y
 * agregar otro, como antes con las respuestas guardadas como texto. Una sola sentencia, porque el PATCH
 * de la campaña no va en transacción.
 */
export async function guardarChecklists(
  client: Pick<PoolClient, "query">,
  campanaId: number | string,
  secciones: readonly SeccionDeChecklist[],
): Promise<void> {
  await client.query(
    `WITH entrada AS (
       SELECT e.n::int AS orden, e.s ->> 'titulo' AS titulo, NULLIF(e.s ->> 'tipo', '') AS tipo, e.s -> 'opciones' AS opciones
         FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS e(s, n)
     ),
     listas AS (
       INSERT INTO campana_checklists (campana_id, titulo, tipo, orden)
       SELECT $1, titulo, tipo, orden FROM entrada
       ON CONFLICT (campana_id, (COALESCE(tipo, '')), (lower(titulo)))
       DO UPDATE SET titulo = EXCLUDED.titulo, orden = EXCLUDED.orden, retirado_en = NULL
       RETURNING id, titulo, tipo
     ),
     pedidas AS (
       SELECT l.id AS checklist_id, o.texto, o.n::int AS orden
         FROM listas l
         JOIN entrada e ON COALESCE(e.tipo, '') = COALESCE(l.tipo, '') AND lower(e.titulo) = lower(l.titulo)
        CROSS JOIN LATERAL jsonb_array_elements_text(e.opciones) WITH ORDINALITY AS o(texto, n)
     ),
     opciones AS (
       INSERT INTO checklist_opciones (checklist_id, texto, orden)
       SELECT checklist_id, texto, orden FROM pedidas
       ON CONFLICT (checklist_id, texto) DO UPDATE SET orden = EXCLUDED.orden, retirada_en = NULL
     ),
     sobrantes AS (
       SELECT o.id, EXISTS (SELECT 1 FROM aporte_respuestas r WHERE r.opcion_id = o.id) AS usada
         FROM checklist_opciones o
        WHERE o.checklist_id IN (SELECT id FROM listas)
          AND NOT EXISTS (SELECT 1 FROM pedidas p WHERE p.checklist_id = o.checklist_id AND p.texto = o.texto)
     ),
     opciones_retiradas AS (
       UPDATE checklist_opciones SET retirada_en = COALESCE(retirada_en, NOW())
        WHERE id IN (SELECT id FROM sobrantes WHERE usada)
     ),
     opciones_borradas AS (
       DELETE FROM checklist_opciones WHERE id IN (SELECT id FROM sobrantes WHERE NOT usada)
     ),
     otras_listas AS (
       SELECT cc.id,
              EXISTS (SELECT 1 FROM checklist_opciones o JOIN aporte_respuestas r ON r.opcion_id = o.id
                       WHERE o.checklist_id = cc.id) AS usada
         FROM campana_checklists cc
        WHERE cc.campana_id = $1 AND cc.id NOT IN (SELECT id FROM listas)
     ),
     listas_retiradas AS (
       UPDATE campana_checklists SET retirado_en = COALESCE(retirado_en, NOW())
        WHERE id IN (SELECT id FROM otras_listas WHERE usada)
     )
     DELETE FROM campana_checklists WHERE id IN (SELECT id FROM otras_listas WHERE NOT usada)`,
    [campanaId, JSON.stringify(secciones)],
  );
}

/**
 * Guarda lo que marcó el aporte: `respuestas` son etiquetas ya validadas con respuestasValidas() contra
 * los checklists del tipo del aporte. Al editar un aporte, quita las que ya no marcó.
 */
export async function guardarRespuestas(
  client: Pick<PoolClient, "query">,
  aporte: { id: number | string; campanaId: number | string; tipo: string },
  respuestas: readonly string[],
): Promise<void> {
  // Las opciones vigentes de la campaña que corresponden a esas etiquetas.
  const opciones = (columnas: string) => `SELECT ${columnas}
                      FROM checklist_opciones o
                      JOIN campana_checklists cc ON cc.id = o.checklist_id
                     WHERE cc.campana_id = $2 AND cc.retirado_en IS NULL AND o.retirada_en IS NULL
                       AND (cc.tipo IS NULL OR cc.tipo = $3)
                       AND ${ETIQUETA} = ANY($4::text[])`;
  const valores = [aporte.id, aporte.campanaId, aporte.tipo, [...respuestas]];
  await client.query(`DELETE FROM aporte_respuestas WHERE aporte_id = $1 AND opcion_id NOT IN (${opciones("o.id")})`, valores);
  if (respuestas.length === 0) return;
  await client.query(
    `INSERT INTO aporte_respuestas (aporte_id, opcion_id) ${opciones("$1::int, o.id")}
     ON CONFLICT DO NOTHING`,
    valores,
  );
}
