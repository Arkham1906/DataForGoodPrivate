import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS, calculateCampaignDaysRemaining, hoyEnTepic, normalizeCampaignDate } from "@/lib/campaign-date";

/*
 * Datos del "Panel de campaña" de la vista de supervisor (usuario promovido
 * en /supervision/[id]/panel y SuperUsuario en /supervisar/[id]/panel). Aquí
 * no se autoriza: cada página verifica antes que quien mira sea el supervisor
 * de la campaña. Las métricas se cuentan directo de `aportes` en vez de los
 * contadores de `campanas`, para que no dependan de que estén al día.
 */

const DIAS = 14;

const NOMBRE_DE_DIA = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" });

const ETIQUETA_DE_TIPO: Record<string, string> = {
  texto: "Texto",
  foto: "Foto",
  video: "Video",
  audio: "Audio",
  documento: "Archivo",
};

export type PanelDeCampana = {
  id: string;
  nombre: string;
  status: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  diasRestantes: number | null;
  meta: number;
  metricas: {
    recibidos: number;
    aprobados: number;
    pendientes: number;
    rechazados: number;
    participantes: number;
  };
  /** Porcentaje de la meta, sobre aportes recibidos (igual que el panel del creador). */
  porcentajeMeta: number;
  recoleccionDiaria: { fecha: string; etiqueta: string; valor: number }[];
  /** Sobre aportes aprobados, por cada tipo de dato que admite la campaña. */
  porTipo: { tipo: string; etiqueta: string; valor: number; porcentaje: number }[];
  ritmo: {
    aportesPorDia: number;
    /** "YYYY-MM-DD" en que se alcanzaría la meta al ritmo actual; null si no hay ritmo o ya se alcanzó. */
    fechaEstimadaMeta: string | null;
    llegaAntesDelCierre: boolean | null;
  };
};

/** Últimos `dias` días de Tepic (más antiguo primero), como clave "YYYY-MM-DD" + etiqueta corta. */
function diasRecientes(dias: number): { clave: string; etiqueta: string }[] {
  const [anio, mes, dia] = hoyEnTepic().split("-").map(Number);
  const lista: { clave: string; etiqueta: string }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = new Date(Date.UTC(anio, mes - 1, dia - i));
    lista.push({ clave: fecha.toISOString().slice(0, 10), etiqueta: NOMBRE_DE_DIA.format(fecha).replace(".", "") });
  }
  return lista;
}

export async function obtenerPanelDeCampana(campanaId: string | number): Promise<PanelDeCampana | null> {
  const campanaResult = await pool.query(
    `SELECT id, name, status, start_date, end_date, goal_contributions, data_types FROM campanas WHERE id = $1 LIMIT 1`,
    [campanaId],
  );
  if (campanaResult.rowCount === 0) return null;
  const campana = campanaResult.rows[0];

  const dias = diasRecientes(DIAS);
  const desde = dias[0]?.clave ?? "1970-01-01";

  const [conteos, diaria, tipos] = await Promise.all([
    pool.query<{ recibidos: string; aprobados: string; pendientes: string; rechazados: string; participantes: string }>(
      `SELECT COUNT(*) AS recibidos,
              COUNT(*) FILTER (WHERE status = 'aceptado') AS aprobados,
              COUNT(*) FILTER (WHERE status IN ('pendiente', 'espera_final')) AS pendientes,
              COUNT(*) FILTER (WHERE status = 'rechazado') AS rechazados,
              COUNT(DISTINCT COALESCE(user_id::text, participant_email, anonimo_id)) AS participantes
       FROM aportes WHERE campaign_id = $1`,
      [campanaId],
    ),
    // submitted_at se guarda en UTC; el día se cuenta en la hora de Tepic (antes, desde las
    // 17:00 de Tepic los aportes caían en el día siguiente).
    pool.query<{ dia: string; n: string }>(
      `SELECT to_char((submitted_at AT TIME ZONE 'UTC') AT TIME ZONE $3, 'YYYY-MM-DD') AS dia, COUNT(*) AS n
       FROM aportes
       WHERE campaign_id = $1 AND submitted_at >= ($2::date::timestamp AT TIME ZONE $3) AT TIME ZONE 'UTC'
       GROUP BY 1`,
      [campanaId, desde, ZONA_DE_CAMPANAS],
    ),
    pool.query<{ file_type: string; n: string }>(
      `SELECT file_type, COUNT(*) AS n FROM aportes WHERE campaign_id = $1 AND status = 'aceptado' GROUP BY file_type`,
      [campanaId],
    ),
  ]);

  const c = conteos.rows[0];
  const metricas = {
    recibidos: Number(c?.recibidos ?? 0),
    aprobados: Number(c?.aprobados ?? 0),
    pendientes: Number(c?.pendientes ?? 0),
    rechazados: Number(c?.rechazados ?? 0),
    participantes: Number(c?.participantes ?? 0),
  };
  const meta = Number(campana.goal_contributions ?? 0);

  const porDia = new Map(diaria.rows.map((r) => [r.dia, Number(r.n)]));
  const recoleccionDiaria = dias.map((d) => ({ fecha: d.clave, etiqueta: d.etiqueta, valor: porDia.get(d.clave) ?? 0 }));

  const conteoPorTipo = new Map(tipos.rows.map((r) => [r.file_type, Number(r.n)]));
  const tiposDeLaCampana: string[] = Array.isArray(campana.data_types) ? campana.data_types.map(String) : [];
  const porTipo = tiposDeLaCampana.map((tipo) => {
    const valor = conteoPorTipo.get(tipo) ?? 0;
    return {
      tipo,
      etiqueta: ETIQUETA_DE_TIPO[tipo] ?? tipo,
      valor,
      porcentaje: metricas.aprobados > 0 ? Math.round((valor / metricas.aprobados) * 100) : 0,
    };
  });

  // Ritmo: promedio diario de los últimos 14 días (o desde el inicio, si la
  // campaña lleva menos), proyectado sobre lo que falta para la meta.
  const fechaInicio = normalizeCampaignDate(campana.start_date);
  const fechaFin = normalizeCampaignDate(campana.end_date);
  const hoy = dias[dias.length - 1].clave;
  const inicioVentana = fechaInicio && fechaInicio > desde ? fechaInicio : desde;
  const diasVentana = Math.max(1, Math.round((Date.parse(hoy) - Date.parse(inicioVentana)) / 86_400_000) + 1);
  const enVentana = recoleccionDiaria.filter((d) => d.fecha >= inicioVentana).reduce((s, d) => s + d.valor, 0);
  const aportesPorDia = enVentana / diasVentana;
  const faltan = Math.max(0, meta - metricas.recibidos);

  let fechaEstimadaMeta: string | null = null;
  if (faltan > 0 && aportesPorDia > 0) {
    const diasParaMeta = Math.ceil(faltan / aportesPorDia);
    fechaEstimadaMeta = new Date(Date.parse(hoy) + diasParaMeta * 86_400_000).toISOString().slice(0, 10);
  }

  return {
    id: String(campana.id),
    nombre: String(campana.name ?? ""),
    status: String(campana.status ?? ""),
    fechaInicio,
    fechaFin,
    diasRestantes: fechaFin ? calculateCampaignDaysRemaining(campana.end_date) : null,
    meta,
    metricas,
    porcentajeMeta: meta > 0 ? Math.min(100, Math.round((metricas.recibidos / meta) * 100)) : 0,
    recoleccionDiaria,
    porTipo,
    ritmo: {
      aportesPorDia: Math.round(aportesPorDia * 10) / 10,
      fechaEstimadaMeta,
      llegaAntesDelCierre: fechaEstimadaMeta && fechaFin ? fechaEstimadaMeta <= fechaFin : null,
    },
  };
}
