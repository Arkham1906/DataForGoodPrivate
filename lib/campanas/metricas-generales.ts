// "Métricas generales" del panel de una campaña (2026-10-27, a pedido del usuario): según sus
// atributos (tipos de dato, ubicación, checklists) y cómo llegan y se revisan sus aportes. La
// tarjeta de temática se quitó el mismo día, a pedido del usuario (poco relevante).
// Server-only. Aquí no se autoriza: GET /api/campanas/[id]/metricas y los paneles de supervisión
// verifican antes quién mira. Se cuenta directo de `aportes` (no de los contadores de `campanas`).
// Privacidad: solo conteos; de las personas, solo el estado de su perfil, agrupado.

import { pool } from "@/lib/db";
import { etiquetaDeRespuesta, seccionesDesdeFila } from "@/lib/campanas/checklist";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { ORDEN_DE_TIPOS } from "@/lib/campanas/reparto-sugerido";
import type { MetricasGenerales } from "./metricas-generales-tipos";

const ETIQUETA_DE_TIPO: Record<string, string> = {
  texto: "Texto",
  foto: "Foto",
  video: "Video",
  audio: "Audio",
  documento: "Archivo",
};

/** Clave de una persona dentro de la campaña (con cuenta, por correo de antes o dispositivo anónimo). */
const SQL_PERSONA = `COALESCE(user_id::text, participant_email, anonimo_id)`;

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

export async function obtenerMetricasGenerales(campanaId: string | number): Promise<MetricasGenerales | null> {
  const campanaResult = await pool.query(
    `SELECT id, data_types, quota_per_user,
            location_state, location_city, location_colonia, todo_el_pais,
            checklist_secciones, checklist_opciones, collection_mode
     FROM campanas WHERE id = $1`,
    [campanaId],
  );
  const campana = campanaResult.rows[0];
  if (!campana) return null;
  const estado = String(campana.location_state ?? "").trim();
  const municipio = String(campana.location_city ?? "").trim();
  const todoElPais = campana.todo_el_pais === true;
  const cuota = Number(campana.quota_per_user ?? 0);

  const [tipos, origen, revision, motivos, participacion, ubicacion, sinCuenta, respuestas] = await Promise.all([
    pool.query<{ file_type: string; recibidos: number; aprobados: number; rechazados: number; peso: string | null }>(
      `SELECT file_type, COUNT(*)::int AS recibidos,
              COUNT(*) FILTER (WHERE status = 'aceptado')::int AS aprobados,
              COUNT(*) FILTER (WHERE status = 'rechazado')::int AS rechazados,
              AVG(file_size_bytes) FILTER (WHERE file_size_bytes > 0) AS peso
       FROM aportes WHERE campaign_id = $1 GROUP BY file_type`,
      [campanaId],
    ),
    pool.query<{ total: number; con_cuenta: number; por_enlace: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE user_id IS NOT NULL)::int AS con_cuenta,
              COUNT(*) FILTER (WHERE enlace_id IS NOT NULL)::int AS por_enlace
       FROM aportes WHERE campaign_id = $1`,
      [campanaId],
    ),
    pool.query<{ aprobados: number; rechazados: number; pendientes: number; horas: string | null }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'aceptado')::int AS aprobados,
              COUNT(*) FILTER (WHERE status = 'rechazado')::int AS rechazados,
              COUNT(*) FILTER (WHERE status IN ('pendiente', 'espera_final'))::int AS pendientes,
              AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600)
                FILTER (WHERE status IN ('aceptado', 'rechazado') AND reviewed_at IS NOT NULL AND reviewed_at >= submitted_at) AS horas
       FROM aportes WHERE campaign_id = $1`,
      [campanaId],
    ),
    pool.query<{ motivo: string; n: number }>(
      `SELECT TRIM(rejection_reason) AS motivo, COUNT(*)::int AS n
       FROM aportes WHERE campaign_id = $1 AND status = 'rechazado' AND COALESCE(TRIM(rejection_reason), '') <> ''
       GROUP BY 1 ORDER BY n DESC, motivo LIMIT 3`,
      [campanaId],
    ),
    pool.query<{ participantes: number; promedio: string | null; en_cuota: number }>(
      `WITH p AS (SELECT ${SQL_PERSONA} AS persona, COUNT(*) AS n FROM aportes WHERE campaign_id = $1 GROUP BY 1)
       SELECT COUNT(*)::int AS participantes, AVG(n) AS promedio,
              COUNT(*) FILTER (WHERE $2::int > 0 AND n >= $2)::int AS en_cuota
       FROM p`,
      [campanaId, cuota],
    ),
    pool.query<{ estado: string | null; municipio: string | null }>(
      `SELECT NULLIF(TRIM(u.state), '') AS estado, NULLIF(TRIM(u.city), '') AS municipio
       FROM usuarios u
       WHERE u.id IN (SELECT DISTINCT user_id FROM aportes WHERE campaign_id = $1 AND user_id IS NOT NULL)`,
      [campanaId],
    ),
    pool.query<{ n: number }>(
      `SELECT COUNT(DISTINCT anonimo_id)::int AS n FROM aportes WHERE campaign_id = $1 AND user_id IS NULL AND anonimo_id IS NOT NULL`,
      [campanaId],
    ),
    pool.query<{ respuesta: string; n: number; aprobados: number }>(
      `SELECT r.respuesta, COUNT(*)::int AS n,
              (SELECT COUNT(*)::int FROM aportes WHERE campaign_id = $1 AND status = 'aceptado') AS aprobados
       FROM aportes a, jsonb_array_elements_text(COALESCE(a.caracteristicas, '[]'::jsonb)) AS r(respuesta)
       WHERE a.campaign_id = $1 AND a.status = 'aceptado' AND jsonb_typeof(COALESCE(a.caracteristicas, '[]'::jsonb)) = 'array'
       GROUP BY r.respuesta`,
      [campanaId],
    ),
  ]);

  // Tipos: los que pide la campaña, en el orden de siempre; también los que llegaron sin pedirse (campañas viejas).
  const filasDeTipo = new Map(tipos.rows.map((f) => [f.file_type, f]));
  const pedidos: string[] = Array.isArray(campana.data_types) ? campana.data_types.map(String) : [];
  const ordenDeTipos = [
    ...ORDEN_DE_TIPOS.filter((t) => pedidos.includes(t) || filasDeTipo.has(t)),
    ...[...filasDeTipo.keys()].filter((t) => !(ORDEN_DE_TIPOS as string[]).includes(t)),
  ];
  const porTipo = ordenDeTipos.map((tipo) => {
    const f = filasDeTipo.get(tipo);
    const decididos = (f?.aprobados ?? 0) + (f?.rechazados ?? 0);
    return {
      tipo,
      etiqueta: ETIQUETA_DE_TIPO[tipo] ?? tipo,
      recibidos: f?.recibidos ?? 0,
      aprobados: f?.aprobados ?? 0,
      rechazados: f?.rechazados ?? 0,
      tasaDeAprobacion: decididos > 0 ? porcentaje(f?.aprobados ?? 0, decididos) : null,
      pesoPromedioBytes: f?.peso ? Math.round(Number(f.peso)) : null,
    };
  });

  // Ubicación de quienes aportaron con cuenta.
  const conCuenta = ubicacion.rows;
  const conteoPorEstado = new Map<string, number>();
  for (const p of conCuenta) if (p.estado) conteoPorEstado.set(p.estado, (conteoPorEstado.get(p.estado) ?? 0) + 1);
  const tieneZona = !todoElPais && estado !== "";
  const enLaZona = tieneZona
    ? conCuenta.filter((p) => p.estado === estado && (!municipio || p.municipio === municipio)).length
    : null;

  // Checklists: cada opción de cada sección, sobre los aportes aprobados.
  const respuestasPorEtiqueta = new Map(respuestas.rows.map((f) => [f.respuesta, f.n]));
  const aprobadosParaChecklists = respuestas.rows[0]?.aprobados ?? revision.rows[0]?.aprobados ?? 0;
  const checklists = seccionesDesdeFila(campana).map((s) => ({
    titulo: s.titulo,
    opciones: s.opciones.map((opcion) => {
      const n = respuestasPorEtiqueta.get(etiquetaDeRespuesta(s.titulo, opcion)) ?? 0;
      return { opcion, aportes: n, porcentaje: porcentaje(n, aprobadosParaChecklists) };
    }),
  }));

  const r = revision.rows[0];
  const decididos = (r?.aprobados ?? 0) + (r?.rechazados ?? 0);
  const p = participacion.rows[0];
  const o = origen.rows[0];

  return {
    tipos: porTipo,
    ubicacion: {
      zona: textoDeUbicacion({ todoElPais, estado, municipio, colonia: campana.location_colonia }),
      todoElPais,
      participantesConCuenta: conCuenta.length,
      enLaZona,
      sinUbicacion: conCuenta.filter((x) => !x.estado).length,
      sinCuenta: sinCuenta.rows[0]?.n ?? 0,
      porEstado: [...conteoPorEstado.entries()]
        .map(([nombre, n]) => ({ estado: nombre, participantes: n }))
        .sort((a, b) => b.participantes - a.participantes || a.estado.localeCompare(b.estado, "es"))
        .slice(0, 6),
    },
    origen: {
      total: o?.total ?? 0,
      conCuenta: o?.con_cuenta ?? 0,
      sinCuenta: (o?.total ?? 0) - (o?.con_cuenta ?? 0),
      porEnlace: o?.por_enlace ?? 0,
    },
    revision: {
      aprobados: r?.aprobados ?? 0,
      rechazados: r?.rechazados ?? 0,
      pendientes: r?.pendientes ?? 0,
      tasaDeAprobacion: decididos > 0 ? porcentaje(r?.aprobados ?? 0, decididos) : null,
      horasPromedio: r?.horas != null ? Math.round(Number(r.horas) * 10) / 10 : null,
      motivos: motivos.rows.map((m) => ({ motivo: m.motivo, aportes: m.n })),
    },
    participacion: {
      cuota,
      participantes: p?.participantes ?? 0,
      promedioPorParticipante: p?.promedio != null ? Math.round(Number(p.promedio) * 10) / 10 : null,
      llegaronALaCuota: p?.en_cuota ?? 0,
    },
    checklists,
    aprobadosParaChecklists,
  };
}
