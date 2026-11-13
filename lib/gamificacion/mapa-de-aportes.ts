// Datos del mapa de aportes de /mis-aportes (2026-11-13; SRS v1.3: RF-GAM-15, 87, 88; diseño V10, fase 3 de
// modificaciones-sistema-previas-srs-v1.4). Server-only. Lee lo guardado; no calcula ni concede nada (RNF-GAM-06):
// - Aportes del usuario con su campaña y temática, calificación, estado, EXP (aportes.exp_otorgada) y el desglose del
//   cálculo guardado en exp_movimientos (RF-GAM-07).
// - Por campaña: sus subtemáticas aprobadas (etiquetasDeCampanas, la misma regla que el resto del sistema: a quien
//   aporta no le llegan las pendientes), meta (goal_contributions), aceptados de todas las personas y los tuyos (RF-GAM-88), cuota y bono de
//   cuota (campana_cuota_bonos, solo 'concedido'), y el multiplicador de campaña especial vigente hoy.
// - Los anónimos no llevan user_id: no aparecen (RN-GAM-26). Solo los ve quien aportó (RF-GAM-77).

import { pool } from "@/lib/db";
import { calificacionDesde } from "@/lib/aportes/calificacion";
import { etiquetasDeCampanas } from "@/lib/etiquetas/catalogo";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import type {
  AporteEnElMapa,
  CampanaEnElMapa,
  DatosDelMapaDeAportes,
  EstadoDelAporteEnElMapa,
} from "./mapa-de-aportes-tipos";

/** Largo máximo de la descripción que viaja al navegador: la lista solo muestra una línea. */
const LARGO_DE_DESCRIPCION = 90;

const ESTADOS: ReadonlySet<string> = new Set<EstadoDelAporteEnElMapa>(["aceptado", "pendiente", "rechazado"]);

function recortar(texto: string | null): string {
  const limpio = (texto ?? "").replace(/\s+/g, " ").trim();
  return limpio.length > LARGO_DE_DESCRIPCION ? `${limpio.slice(0, LARGO_DE_DESCRIPCION - 1).trimEnd()}…` : limpio;
}

type FilaDeAporte = {
  id: number;
  campaign_id: number;
  file_type: string;
  description: string | null;
  status: string;
  calificacion: number | null;
  exp_otorgada: number | null;
  submitted_at: Date;
  exp_base: number | null;
  mult_calidad: number | null;
  factor: number | null;
  potenciador_id: number | null;
  mult_campana: number | null;
};

type FilaDeCampana = {
  id: number;
  name: string;
  tematica: string;
  goal_contributions: number | null;
  quota_per_user: number | null;
  aprobados_de_todos: number;
  bono: number | null;
  especial: number | null;
};

/** El mapa completo de una persona. null si falla (se loguea el error): la página sigue sin el mapa. */
export async function obtenerMapaDeAportes(usuarioId: number | string): Promise<DatosDelMapaDeAportes | null> {
  try {
    const [aportesR, campanasR, interesesR, subInteresR] = await Promise.all([
      pool.query<FilaDeAporte>(
        `SELECT a.id, a.campaign_id, a.file_type, a.description, a.status, a.calificacion, a.exp_otorgada, a.submitted_at,
                m.exp_base, m.mult_calidad::float8 AS mult_calidad, m.factor::float8 AS factor, m.potenciador_id,
                m.mult_campana::float8 AS mult_campana
          FROM aportes a
          LEFT JOIN LATERAL (
            SELECT exp_base, mult_calidad, factor, potenciador_id, mult_campana
              FROM exp_movimientos
              WHERE aporte_id = a.id AND tipo = 'aporte'
              ORDER BY id DESC LIMIT 1
          ) m ON true
          WHERE a.user_id = $1
          ORDER BY a.submitted_at DESC, a.id DESC`,
        [usuarioId],
      ),
      pool.query<FilaDeCampana>(
        `SELECT c.id, c.name, COALESCE(NULLIF(c.tematica, ''), c.tag, '') AS tematica, c.goal_contributions,
                c.quota_per_user,
                (SELECT COUNT(*)::int FROM aportes t WHERE t.campaign_id = c.id AND t.status = 'aceptado') AS aprobados_de_todos,
                (SELECT b.bono FROM campana_cuota_bonos b
                  WHERE b.campana_id = c.id AND b.usuario_id = $1 AND b.estado = 'concedido') AS bono,
                (SELECT e.multiplicador FROM campana_especial e
                  WHERE e.campana_id = c.id
                    AND (NOW() AT TIME ZONE $2)::date BETWEEN e.inicio AND e.fin) AS especial
          FROM campanas c
          WHERE c.id IN (SELECT DISTINCT campaign_id FROM aportes WHERE user_id = $1)`,
        [usuarioId, ZONA_DE_CAMPANAS],
      ),
      pool.query<{ intereses: unknown }>(`SELECT intereses FROM usuarios WHERE id = $1`, [usuarioId]),
      pool.query<{ nombre: string }>(
        `SELECT e.nombre FROM usuario_etiquetas ue JOIN etiquetas e ON e.id = ue.etiqueta_id
          WHERE ue.usuario_id = $1 AND e.aprobada`,
        [usuarioId],
      ),
    ]);
    const subtematicas = await etiquetasDeCampanas(campanasR.rows.map((c) => Number(c.id)));

    const porCampana = new Map<number, AporteEnElMapa[]>();
    for (const f of aportesR.rows) {
      if (!ESTADOS.has(f.status)) continue;
      const estado = f.status as EstadoDelAporteEnElMapa;
      const aceptado = estado === "aceptado";
      const aporte: AporteEnElMapa = {
        id: Number(f.id),
        campanaId: Number(f.campaign_id),
        tipo: f.file_type,
        descripcion: recortar(f.description),
        estado,
        calificacion: aceptado ? calificacionDesde(f.calificacion) : null,
        exp: aceptado && f.exp_otorgada != null ? Number(f.exp_otorgada) : null,
        desglose:
          aceptado && f.exp_base != null && f.mult_calidad != null && f.factor != null
            ? {
                base: Number(f.exp_base),
                multCalidad: Number(f.mult_calidad),
                factor: Number(f.factor),
                conPotenciador: f.potenciador_id != null,
                conCampanaEspecial: Number(f.mult_campana ?? 1) > 1,
              }
            : null,
        enviadoEn: new Date(f.submitted_at).toISOString(),
      };
      const lista = porCampana.get(aporte.campanaId) ?? [];
      lista.push(aporte);
      porCampana.set(aporte.campanaId, lista);
    }

    const campanas: CampanaEnElMapa[] = campanasR.rows
      .filter((c) => porCampana.has(Number(c.id)))
      .map((c) => {
        const aportes = porCampana.get(Number(c.id)) ?? [];
        return {
          id: Number(c.id),
          nombre: c.name,
          tematica: c.tematica || "Sin temática",
          subtematicas: (subtematicas.get(Number(c.id)) ?? []).map((e) => e.nombre),
          meta: c.goal_contributions != null && c.goal_contributions > 0 ? Number(c.goal_contributions) : null,
          aprobadosDeTodos: Number(c.aprobados_de_todos),
          aprobadosTuyos: aportes.filter((a) => a.estado === "aceptado").length,
          cuota: c.quota_per_user != null && c.quota_per_user > 0 ? Number(c.quota_per_user) : null,
          bonoDeCuota: c.bono != null ? Number(c.bono) : null,
          especial: c.especial != null && Number(c.especial) > 1 ? Number(c.especial) : null,
          aportes,
        };
      })
      // La campaña con el aporte más reciente primero: es la que el mapa conserva si hay que recortar.
      .sort((a, b) => b.aportes[0].enviadoEn.localeCompare(a.aportes[0].enviadoEn) || a.id - b.id);

    const aportesPorTematica = new Map<string, number>();
    for (const c of campanas) aportesPorTematica.set(c.tematica, (aportesPorTematica.get(c.tematica) ?? 0) + c.aportes.length);
    const tematicas = [...aportesPorTematica.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
      .map(([t]) => t);

    const crudos = interesesR.rows[0]?.intereses;
    const intereses = Array.isArray(crudos) ? crudos.filter((i): i is string => typeof i === "string" && i.trim() !== "") : [];

    return { campanas, tematicas, intereses, subtematicasDeInteres: subInteresR.rows.map((f) => f.nombre) };
  } catch (error) {
    console.error("Error armando el mapa de aportes", error);
    return null;
  }
}
