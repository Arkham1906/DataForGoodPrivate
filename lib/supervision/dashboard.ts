// Dashboard del supervisor (2026-11-13, a pedido del usuario): lo que lleva arriba /supervision.
// Server-only, solo lectura. Cuenta lo del supervisor con sesión (rol "supervisor"), no lo del SuperUsuario:
// - Por dictaminar: campañas 'en_revision' que no son suyas y están libres o ya son suyas (la misma regla que la
//   lista "Por supervisar" de la página), con cuánto lleva esperando cada una (campanas.en_revision_desde).
// - Tus dictámenes: filas de campana_supervisores con su supervisor_id y accion aceptada/rechazada: aceptadas,
//   rechazadas, hoy y en 7 días (hora de Tepic), por día en los últimos DIAS_DE_ACTIVIDAD días, mediana del envío
//   al dictamen en 30 días (campana_supervisores.en_revision_desde → created_at; los dictámenes de antes del
//   2026-11-13 no tienen hora y no cuentan) y los motivos de sus rechazos, agrupados por el motivo de la lista.
// - Las que supervisa (campanas.supervisor_id): por estado, y lo que espera algo de él: datos abiertos por decidir
//   (campana_datos_abiertos 'pendiente'), pausadas por la supervisión que el creador ya ajustó (ajustes_en) y
//   reportes pendientes que le tocan (contarReportesPendientes, la misma cuenta que /supervision/reportes).
// Si una consulta falla devuelve null y la pantalla muestra la lista sin el dashboard.

import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { contarReportesPendientes } from "@/lib/reportes/reportes";
import { MOTIVOS_DE_RECHAZO_DE_CAMPANA, MOTIVO_CAMPANA_SIMILAR, OTRO_MOTIVO } from "@/lib/reportes/motivos";
import type { DiaDeActividad } from "@/lib/revisiones/dashboard";

export const DIAS_DE_ACTIVIDAD = 14;
/** Campañas que se listan en "Esperan tu dictamen" y en "Por resolver" (las que más llevan esperando). */
const CAMPANAS_EN_LISTA = 5;
/** Lo que se muestra cuando el rechazo no trae motivo de la lista (solo la explicación, u "Otro"). */
export const MOTIVO_SOLO_EXPLICACION = "Otro motivo";

export type CampanaEnEspera = {
  id: string;
  nombre: string;
  creador: string;
  /** ISO de cuándo entró a revisión; null si no se sabe. */
  desde: string | null;
  /** true si ya la tomaste; false si está libre. */
  tuya: boolean;
};

export type PendienteDeLaSupervision = {
  id: string;
  nombre: string;
  tipo: "datos" | "reanudar";
};

export type DashboardDelSupervisor = {
  porDictaminar: number;
  /** ISO de la que más lleva esperando, o null sin campañas en revisión (o sin hora). */
  esperaMasLarga: string | null;
  enEspera: CampanaEnEspera[];
  aceptadas: number;
  rechazadas: number;
  hoy: number;
  semana: number;
  /** Mediana, en segundos, del envío a revisión al dictamen en los últimos 30 días; null sin datos. */
  medianaDeDictamen: number | null;
  actividad: DiaDeActividad[];
  /** Motivos de sus rechazos, de más a menos (sin los que tienen 0). */
  motivos: { motivo: string; total: number }[];
  supervisadas: { activas: number; programadas: number; pausadas: number; finalizadas: number };
  datosPorDecidir: number;
  porReanudar: number;
  /** Las campañas de datosPorDecidir y porReanudar, hasta CAMPANAS_EN_LISTA. */
  porResolver: PendienteDeLaSupervision[];
  /** Reportes pendientes que le tocan (casos: una campaña o un aporte con varios reportes cuenta uno). */
  reportes: number;
};

/** El motivo de la lista con el que empieza el texto guardado (textoDelMotivoDeRechazo). */
function motivoDeLista(texto: string): string {
  if (texto.startsWith(MOTIVO_CAMPANA_SIMILAR) || texto.startsWith("Ya existen campañas similares")) {
    return MOTIVO_CAMPANA_SIMILAR;
  }
  const motivo = MOTIVOS_DE_RECHAZO_DE_CAMPANA.find((m) => m !== OTRO_MOTIVO && texto.startsWith(m));
  return motivo ?? MOTIVO_SOLO_EXPLICACION;
}

export async function obtenerDashboardDelSupervisor(usuarioId: number): Promise<DashboardDelSupervisor | null> {
  try {
    const [esperaR, dictamenesR, actividadR, motivosR, supervisadasR, porResolverR, reportes] = await Promise.all([
      pool.query<{ id: number; name: string; creator_name: string | null; desde: Date | null; tuya: boolean }>(
        `SELECT c.id, c.name, c.creator_name, c.en_revision_desde AS desde, (c.supervisor_id = $1) AS tuya
           FROM campanas c
          WHERE c.status = 'en_revision'
            AND c.creator_id <> $1
            AND ((c.supervisor_id IS NULL AND NOT c.supervisado_por_root) OR c.supervisor_id = $1)
          ORDER BY c.en_revision_desde ASC NULLS LAST, c.id ASC`,
        [usuarioId],
      ),
      pool.query<{ aceptadas: number; rechazadas: number; hoy: number; semana: number; mediana: number | null }>(
        `SELECT COUNT(*) FILTER (WHERE accion = 'aceptada')::int AS aceptadas,
                COUNT(*) FILTER (WHERE accion = 'rechazada')::int AS rechazadas,
                COUNT(*) FILTER (WHERE (created_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date)::int AS hoy,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS semana,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM created_at - en_revision_desde))
                  FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND en_revision_desde IS NOT NULL
                            AND en_revision_desde <= created_at) AS mediana
           FROM campana_supervisores
          WHERE supervisor_id = $1 AND accion IN ('aceptada', 'rechazada')`,
        [usuarioId, ZONA_DE_CAMPANAS],
      ),
      pool.query<{ dia: string; aceptados: number; rechazados: number }>(
        `WITH dias AS (
           SELECT generate_series((NOW() AT TIME ZONE $2)::date - ($3::int - 1), (NOW() AT TIME ZONE $2)::date, INTERVAL '1 day')::date AS dia
         ),
         dictamenes AS (
           SELECT (created_at AT TIME ZONE $2)::date AS dia, accion
             FROM campana_supervisores
            WHERE supervisor_id = $1 AND accion IN ('aceptada', 'rechazada')
              AND created_at >= NOW() - ($3::int + 1) * INTERVAL '1 day'
         )
         SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
                COUNT(x.accion) FILTER (WHERE x.accion = 'aceptada')::int AS aceptados,
                COUNT(x.accion) FILTER (WHERE x.accion = 'rechazada')::int AS rechazados
           FROM dias d LEFT JOIN dictamenes x ON x.dia = d.dia
          GROUP BY d.dia
          ORDER BY d.dia`,
        [usuarioId, ZONA_DE_CAMPANAS, DIAS_DE_ACTIVIDAD],
      ),
      pool.query<{ motivo: string | null }>(
        `SELECT motivo FROM campana_supervisores WHERE supervisor_id = $1 AND accion = 'rechazada'`,
        [usuarioId],
      ),
      pool.query<{ activas: number; programadas: number; pausadas: number; finalizadas: number }>(
        `SELECT COUNT(*) FILTER (WHERE status = 'activa')::int AS activas,
                COUNT(*) FILTER (WHERE status = 'aceptada')::int AS programadas,
                COUNT(*) FILTER (WHERE status = 'pausada')::int AS pausadas,
                COUNT(*) FILTER (WHERE status = 'finalizada')::int AS finalizadas
           FROM campanas
          WHERE supervisor_id = $1`,
        [usuarioId],
      ),
      pool.query<{ id: number; name: string; tipo: "datos" | "reanudar"; desde: Date | null }>(
        `SELECT c.id, c.name, 'datos' AS tipo, c.end_date::timestamptz AS desde
           FROM campanas c
           JOIN campana_datos_abiertos d ON d.campana_id = c.id AND d.estado = 'pendiente'
          WHERE c.supervisor_id = $1 AND c.status = 'finalizada'
         UNION ALL
         SELECT c.id, c.name, 'reanudar' AS tipo, c.ajustes_en AS desde
           FROM campanas c
          WHERE c.supervisor_id = $1 AND c.status = 'pausada' AND c.pausa_por = 'supervision' AND c.ajustes_en IS NOT NULL
         ORDER BY desde ASC NULLS LAST, id ASC`,
        [usuarioId],
      ),
      contarReportesPendientes(usuarioId, usuarioId),
    ]);

    const espera = esperaR.rows;
    const dictamenes = dictamenesR.rows[0];

    const conteo = new Map<string, number>();
    for (const { motivo } of motivosR.rows) {
      const clave = motivoDeLista(String(motivo ?? "").trim());
      conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
    }
    // Orden: de más a menos; empates en el orden de la lista y "Otro motivo" al final.
    const orden = (m: string) => (m === MOTIVO_SOLO_EXPLICACION ? Number.MAX_SAFE_INTEGER : MOTIVOS_DE_RECHAZO_DE_CAMPANA.indexOf(m));
    const motivos = [...conteo.entries()]
      .map(([motivo, total]) => ({ motivo, total }))
      .sort((a, b) => b.total - a.total || orden(a.motivo) - orden(b.motivo));

    const porResolver = porResolverR.rows;
    const supervisadas = supervisadasR.rows[0];
    const primera = espera.find((c) => c.desde);

    return {
      porDictaminar: espera.length,
      esperaMasLarga: primera?.desde ? new Date(primera.desde).toISOString() : null,
      enEspera: espera.slice(0, CAMPANAS_EN_LISTA).map((c) => ({
        id: String(c.id),
        nombre: String(c.name),
        creador: String(c.creator_name ?? "").trim() || "Usuario",
        desde: c.desde ? new Date(c.desde).toISOString() : null,
        tuya: Boolean(c.tuya),
      })),
      aceptadas: Number(dictamenes?.aceptadas ?? 0),
      rechazadas: Number(dictamenes?.rechazadas ?? 0),
      hoy: Number(dictamenes?.hoy ?? 0),
      semana: Number(dictamenes?.semana ?? 0),
      medianaDeDictamen: dictamenes?.mediana == null ? null : Number(dictamenes.mediana),
      actividad: actividadR.rows.map((f) => ({
        dia: String(f.dia),
        aceptados: Number(f.aceptados),
        rechazados: Number(f.rechazados),
      })),
      motivos,
      supervisadas: {
        activas: Number(supervisadas?.activas ?? 0),
        programadas: Number(supervisadas?.programadas ?? 0),
        pausadas: Number(supervisadas?.pausadas ?? 0),
        finalizadas: Number(supervisadas?.finalizadas ?? 0),
      },
      datosPorDecidir: porResolver.filter((p) => p.tipo === "datos").length,
      porReanudar: porResolver.filter((p) => p.tipo === "reanudar").length,
      porResolver: porResolver.slice(0, CAMPANAS_EN_LISTA).map((p) => ({ id: String(p.id), nombre: String(p.name), tipo: p.tipo })),
      reportes: Number(reportes.casos ?? 0),
    };
  } catch (error) {
    console.error("No se pudo armar el dashboard del supervisor", error);
    return null;
  }
}
