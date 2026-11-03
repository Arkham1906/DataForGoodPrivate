// Tipos de dato de una campaña (tabla campana_tipos, 2026-10-30, rama cambios-bd): una fila por tipo que
// pide la campaña, con su orden, su límite total (lib/campanas/limite-por-tipo.ts), cuántos aportes no
// rechazados lleva y, en "documento", los formatos de "Archivo" que acepta (lib/aportes/archivo.ts).
// Reemplaza a las columnas JSONB campanas.data_types, limite_por_tipo, enviados_por_tipo y
// formatos_de_documento. Para no tocar cada pantalla, columnasCalculadas() las vuelve a dar con esos
// nombres al leer una campaña, junto con has_reviewer_assigned (se calcula de campana_revisores) y,
// desde la tercera tanda, los contadores (campana_estadisticas) y la campaña especial (campana_especial);
// desde la cuarta, los checklists (campana_checklists, lib/campanas/tabla-checklists.ts).
// Lo usan los route handlers de campañas, la cuota de aportes (lib/aportes/comun.ts) y las listas.

import type { PoolClient } from "pg";
import type { LimitePorTipo } from "@/lib/campanas/limite-por-tipo";
import type { CuotaPorTipo } from "@/lib/campanas/cuota-por-tipo";
import { columnaDeChecklists } from "@/lib/campanas/tabla-checklists";

/**
 * Columnas que antes estaban en `campanas`, calculadas para la fila `c` (alias de la tabla en la
 * consulta): data_types (arreglo en el orden del creador), limite_por_tipo (NULL sin límites, como
 * antes), cuota_por_tipo (tope por persona de cada tipo, 2026-10-31; NULL sin topes), enviados_por_tipo, formatos_de_documento ([] = todos), has_reviewer_assigned, los contadores
 * (columnasDeEstadisticas) e is_special con especial_inicio, especial_fin, especial_multiplicador y
 * especial_insignia (lib/campanas/especial.ts los lee con especialDesdeFila) y checklist_secciones
 * (columnaDeChecklists; lib/campanas/checklist.ts los lee con seccionesDesdeFila).
 * Va en la lista del SELECT o del RETURNING: `SELECT c.*, ${columnasCalculadas("c")} FROM campanas c`.
 */
export function columnasCalculadas(c = "campanas"): string {
  return `(SELECT COALESCE(jsonb_agg(ct.tipo ORDER BY ct.orden), '[]'::jsonb)
             FROM campana_tipos ct WHERE ct.campana_id = ${c}.id) AS data_types,
          (SELECT jsonb_object_agg(ct.tipo, ct.limite)
             FROM campana_tipos ct WHERE ct.campana_id = ${c}.id AND ct.limite IS NOT NULL) AS limite_por_tipo,
          (SELECT jsonb_object_agg(ct.tipo, ct.cuota_por_persona)
             FROM campana_tipos ct WHERE ct.campana_id = ${c}.id AND ct.cuota_por_persona IS NOT NULL) AS cuota_por_tipo,
          (SELECT COALESCE(jsonb_object_agg(ct.tipo, ct.enviados), '{}'::jsonb)
             FROM campana_tipos ct WHERE ct.campana_id = ${c}.id) AS enviados_por_tipo,
          COALESCE((SELECT ct.formatos FROM campana_tipos ct
                     WHERE ct.campana_id = ${c}.id AND ct.tipo = 'documento'), '[]'::jsonb) AS formatos_de_documento,
          EXISTS (SELECT 1 FROM campana_revisores cr
                   WHERE cr.campana_id = ${c}.id AND cr.estado = 'aceptado') AS has_reviewer_assigned,
          ${columnasDeEstadisticas(c)},
          EXISTS (SELECT 1 FROM campana_especial ce WHERE ce.campana_id = ${c}.id) AS is_special,
          (SELECT ce.inicio FROM campana_especial ce WHERE ce.campana_id = ${c}.id) AS especial_inicio,
          (SELECT ce.fin FROM campana_especial ce WHERE ce.campana_id = ${c}.id) AS especial_fin,
          (SELECT ce.multiplicador FROM campana_especial ce WHERE ce.campana_id = ${c}.id) AS especial_multiplicador,
          (SELECT ce.insignia FROM campana_especial ce WHERE ce.campana_id = ${c}.id) AS especial_insignia,
          ${columnaDeChecklists(c)}`;
}

/** Contadores de campana_estadisticas con sus nombres de siempre (0 si faltara la fila). */
export function columnasDeEstadisticas(c = "campanas"): string {
  return ["current_contributions", "approved_contributions", "pending_contributions", "rejected_contributions",
    "participants", "downloads_count"]
    .map((col) => `COALESCE((SELECT ce.${col} FROM campana_estadisticas ce WHERE ce.campana_id = ${c}.id), 0) AS ${col}`)
    .join(",\n          ");
}

/** Solo data_types, para las listas que no necesitan límites ni formatos. */
export function columnaDeTipos(c = "campanas"): string {
  return `(SELECT COALESCE(jsonb_agg(ct.tipo ORDER BY ct.orden), '[]'::jsonb)
             FROM campana_tipos ct WHERE ct.campana_id = ${c}.id) AS data_types`;
}

/** Condición "la campaña `c` pide el tipo del parámetro" (antes `data_types ? $n`). */
export function condicionDeTipo(c: string, parametro: string): string {
  return `EXISTS (SELECT 1 FROM campana_tipos ct WHERE ct.campana_id = ${c}.id AND ct.tipo = ${parametro})`;
}

/**
 * Deja los tipos de la campaña como se piden: borra los que ya no pide, agrega los nuevos y actualiza
 * orden, límite, tope por persona (2026-10-31) y formatos (solo en "documento"). Después recalcula los
 * enviados de cada tipo, porque un tipo que se vuelve a pedir puede tener aportes de antes. Va dentro de
 * la transacción de la campaña.
 */
export async function guardarTiposDeCampana(
  client: Pick<PoolClient, "query">,
  campanaId: number | string,
  entrada: { tipos: readonly string[]; limite: LimitePorTipo | null; cuota: CuotaPorTipo | null; formatos: readonly string[] },
): Promise<void> {
  // Una sola sentencia (borrar y agregar): el PATCH de la campaña no va en transacción.
  await client.query(
    `WITH quitados AS (
       DELETE FROM campana_tipos WHERE campana_id = $1 AND NOT (tipo = ANY($2::text[]))
     )
     INSERT INTO campana_tipos (campana_id, tipo, orden, limite, cuota_por_persona, formatos)
     SELECT $1, t.tipo, t.orden, ($3::jsonb ->> t.tipo)::int, ($5::jsonb ->> t.tipo)::int,
            CASE WHEN t.tipo = 'documento' THEN $4::jsonb END
     FROM unnest($2::text[]) WITH ORDINALITY AS t(tipo, orden)
     ON CONFLICT (campana_id, tipo) DO UPDATE
       SET orden = EXCLUDED.orden, limite = EXCLUDED.limite, cuota_por_persona = EXCLUDED.cuota_por_persona,
           formatos = EXCLUDED.formatos`,
    [campanaId, [...entrada.tipos], JSON.stringify(entrada.limite ?? {}), JSON.stringify(entrada.formatos), JSON.stringify(entrada.cuota ?? {})],
  );
  await actualizarEnviados(client, campanaId);
}

/** Aportes no rechazados de cada tipo que pide la campaña (antes campanas.enviados_por_tipo). */
export async function actualizarEnviados(client: Pick<PoolClient, "query">, campanaId: number | string): Promise<void> {
  await client.query(
    `UPDATE campana_tipos ct
        SET enviados = (SELECT COUNT(*)::int FROM aportes a
                         WHERE a.campaign_id = ct.campana_id AND a.file_type = ct.tipo AND a.status <> 'rechazado')
      WHERE ct.campana_id = $1`,
    [campanaId],
  );
}
