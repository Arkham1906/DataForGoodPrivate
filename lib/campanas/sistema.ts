import { pool } from "@/lib/db";
import { activateScheduledCampaigns, finalizeExpiredCampaigns, normalizeCampaignDate } from "@/lib/campaign-date";
import { hasRootSession } from "@/lib/rootSession";
import {
  NOMBRE_DE_TIPO,
  ORDEN_DE_ESTADOS,
  POR_PAGINA,
  esEstado,
  esTipo,
  hoyLocal,
  porcentajeDeMeta,
  type DashboardDeCampanas,
  type EstadoDeCampana,
  type FilaDeCampana,
  type TipoDeDato,
} from "@/lib/campanas/sistema-opciones";

export * from "@/lib/campanas/sistema-opciones";

/*
 * Sección Campañas del panel del SuperUsuario (/sistema/campanas): dashboard,
 * listado y panel individual, en modo consulta. Vive bajo /sistema y no en
 * /campanas porque esa ruta ya es la pantalla del usuario común.
 *
 * Cada función exige sesión raíz: el layout de (panel) y el proxy ya la
 * piden, pero la autorización se repite donde se leen los datos.
 */

/* ── consultas ──────────────────────────────────────────────────────────── */

async function prepararLectura(): Promise<void> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  await activateScheduledCampaigns();
  await finalizeExpiredCampaigns();
}

/*
 * Base de toda la sección: cada campaña con sus aportes y participantes
 * contados desde `aportes` (no de los contadores de `campanas`). Un
 * participante es un usuario distinto, o un correo distinto si aportó sin
 * cuenta.
 */
const CAMPANAS_CON_CONTEOS = `
  SELECT c.id, c.name, COALESCE(NULLIF(c.tematica, ''), c.tag, '') AS tematica, c.creator_name,
         c.data_types, c.status, c.goal_contributions, c.start_date, c.end_date, c.created_at,
         COALESCE(a.aportes, 0)::int AS aportes,
         COALESCE(a.aprobados, 0)::int AS aprobados,
         COALESCE(a.participantes, 0)::int AS participantes
  FROM campanas c
  LEFT JOIN (
    SELECT campaign_id,
           COUNT(*) AS aportes,
           COUNT(*) FILTER (WHERE status = 'aceptado') AS aprobados,
           COUNT(DISTINCT COALESCE(user_id::text, participant_email, anonimo_id)) AS participantes
    FROM aportes
    GROUP BY campaign_id
  ) a ON a.campaign_id = c.id`;

function mapearFila(row: Record<string, unknown>): FilaDeCampana {
  const tipos = Array.isArray(row.data_types) ? row.data_types.map(String).filter((t) => esTipo(t)) : [];
  return {
    id: String(row.id),
    nombre: String(row.name ?? ""),
    tematica: String(row.tematica ?? ""),
    creador: String(row.creator_name ?? ""),
    tiposDeDato: tipos as TipoDeDato[],
    estado: esEstado(String(row.status)) ?? "borrador",
    participantes: Number(row.participantes ?? 0),
    aportes: Number(row.aportes ?? 0),
    aprobados: Number(row.aprobados ?? 0),
    meta: Number(row.goal_contributions ?? 0),
    venceEn: normalizeCampaignDate(row.end_date),
  };
}

export type FiltrosDeCampanas = {
  q?: string;
  estado?: EstadoDeCampana;
  tematica?: string;
  /** Subtemática (nombre, aprobada); solo junto con `tematica`. */
  etiqueta?: string;
  tipo?: TipoDeDato;
  vigencia?: string;
  orden?: string;
  pagina?: number;
};

const ORDEN_SQL: Record<string, string> = {
  participantes: "participantes DESC, id DESC",
  aportes: "aportes DESC, id DESC",
  avance: "CASE WHEN goal_contributions > 0 THEN aprobados::float / goal_contributions ELSE 0 END DESC, id DESC",
  vence: "end_date ASC NULLS LAST, id DESC",
};

/** Filtrado, orden y paginación en SQL. */
export async function buscarCampanas(f: FiltrosDeCampanas): Promise<{ filas: FilaDeCampana[]; total: number }> {
  await prepararLectura();

  // El listado no muestra borradores (ver ESTADOS_DEL_LISTADO).
  const condiciones: string[] = ["status <> 'borrador'"];
  const valores: (string | number)[] = [];
  const param = (v: string | number) => {
    valores.push(v);
    return `$${valores.length}`;
  };

  const q = (f.q ?? "").trim();
  if (q) {
    const p = param(`%${q}%`);
    const exacto = param(q);
    condiciones.push(`(name ILIKE ${p} OR tematica ILIKE ${p} OR creator_name ILIKE ${p} OR id::text = ${exacto})`);
  }
  if (f.estado) condiciones.push(`status = ${param(f.estado)}`);
  if (f.tematica) condiciones.push(`tematica = ${param(f.tematica)}`);
  if (f.tematica && f.etiqueta) {
    condiciones.push(
      `EXISTS (SELECT 1 FROM campana_etiquetas ce JOIN etiquetas e ON e.id = ce.etiqueta_id
               WHERE ce.campana_id = base.id AND e.aprobada AND e.nombre = ${param(f.etiqueta)})`,
    );
  }
  if (f.tipo) condiciones.push(`data_types ? ${param(f.tipo)}`);
  if (f.vigencia === "7d" || f.vigencia === "30d" || f.vigencia === "mas30") {
    const hoy = param(hoyLocal());
    condiciones.push(
      f.vigencia === "7d"
        ? `end_date >= ${hoy}::date AND end_date < ${hoy}::date + 7`
        : f.vigencia === "30d"
          ? `end_date >= ${hoy}::date AND end_date < ${hoy}::date + 30`
          : `end_date > ${hoy}::date + 30`,
    );
  }

  const where = `WHERE ${condiciones.join(" AND ")}`;
  const orden = ORDEN_SQL[f.orden ?? ""] ?? "created_at DESC, id DESC";
  const pagina = Math.max(1, f.pagina ?? 1);

  const result = await pool.query(
    `SELECT *, COUNT(*) OVER() AS total
     FROM (${CAMPANAS_CON_CONTEOS}) base
     ${where}
     ORDER BY ${orden}
     LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`,
    valores,
  );

  return {
    filas: result.rows.map(mapearFila),
    total: result.rows.length > 0 ? Number(result.rows[0].total) : 0,
  };
}

export async function contarPorEstado(): Promise<Record<EstadoDeCampana | "todas", number>> {
  await prepararLectura();
  const result = await pool.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*) AS n FROM campanas GROUP BY status`,
  );
  const conteos = Object.fromEntries(ORDEN_DE_ESTADOS.map((e) => [e, 0])) as Record<EstadoDeCampana, number>;
  let todas = 0;
  for (const r of result.rows) {
    const e = esEstado(r.status);
    // "Todas" es el total del listado, que no incluye borradores.
    if (e !== "borrador") todas += Number(r.n);
    if (e) conteos[e] = Number(r.n);
  }
  return { ...conteos, todas };
}

/** Etiquetas aprobadas que usan las campañas del listado (sin borradores), por temática, para el filtro. */
export async function listarEtiquetasPorTematica(): Promise<Record<string, string[]>> {
  await prepararLectura();
  const result = await pool.query<{ tematica: string; nombre: string }>(
    `SELECT DISTINCT c.tematica, e.nombre
     FROM campanas c
     JOIN campana_etiquetas ce ON ce.campana_id = c.id
     JOIN etiquetas e ON e.id = ce.etiqueta_id AND e.aprobada
     WHERE c.status <> 'borrador'
     ORDER BY c.tematica, e.nombre`,
  );
  const porTema: Record<string, string[]> = {};
  for (const r of result.rows) (porTema[r.tematica] ??= []).push(r.nombre);
  return porTema;
}

/** Temáticas que existen en la BD, para el filtro del listado. */
export async function listarTematicas(): Promise<string[]> {
  await prepararLectura();
  const result = await pool.query<{ tematica: string }>(
    `SELECT DISTINCT COALESCE(NULLIF(tematica, ''), tag) AS tematica FROM campanas
     WHERE COALESCE(NULLIF(tematica, ''), tag) IS NOT NULL
     ORDER BY 1`,
  );
  return result.rows.map((r) => r.tematica);
}

export async function obtenerDashboardDeCampanas(): Promise<DashboardDeCampanas> {
  await prepararLectura();
  const hoy = hoyLocal();

  const [campanasResult, globalesResult] = await Promise.all([
    pool.query(`${CAMPANAS_CON_CONTEOS} ORDER BY c.id`),
    pool.query<{ aportes: string; participantes: string }>(
      // Personas distintas en toda la plataforma: quien aporta en tres campañas cuenta una vez.
      `SELECT COUNT(*) AS aportes, COUNT(DISTINCT COALESCE(user_id::text, participant_email, anonimo_id)) AS participantes FROM aportes`,
    ),
  ]);

  const filas = campanasResult.rows.map((row) => ({
    ...mapearFila(row),
    inicio: normalizeCampaignDate(row.start_date),
  }));
  const activas = filas.filter((c) => c.estado === "activa");

  const porEstado = Object.fromEntries(ORDEN_DE_ESTADOS.map((e) => [e, 0])) as Record<EstadoDeCampana, number>;
  for (const c of filas) porEstado[c.estado] += 1;

  // Temática y tipo de dato: sobre las campañas activas. Una campaña puede
  // pedir varios tipos, así que esa suma puede superar el total.
  const contar = (valores: string[]) => {
    const mapa = new Map<string, number>();
    for (const v of valores) mapa.set(v, (mapa.get(v) ?? 0) + 1);
    return [...mapa.entries()]
      .map(([etiqueta, valor]) => ({ etiqueta, valor }))
      .sort((a, b) => b.valor - a.valor);
  };
  const porTematica = contar(activas.map((c) => c.tematica || "Sin temática"));
  const porTipoDeDato = contar(activas.flatMap((c) => c.tiposDeDato.map((t) => NOMBRE_DE_TIPO[t])));

  // Avance medio: media de los porcentajes de cada activa (no aportes totales
  // entre metas totales, que dominaría la campaña más grande).
  const conMeta = activas.filter((c) => c.meta > 0);
  const avanceMedio = conMeta.length > 0
    ? Math.round(conMeta.reduce((s, c) => s + porcentajeDeMeta(c.aprobados, c.meta), 0) / conMeta.length)
    : 0;

  const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  const vigencia = { menosDe7: 0, entre7y30: 0, masDe30: 0, sinFecha: 0 };
  const duraciones: number[] = [];
  const antiguedades: number[] = [];
  for (const c of activas) {
    const d = c.venceEn ? diasEntre(hoy, c.venceEn) : null;
    if (d === null) vigencia.sinFecha += 1;
    else if (d < 7) vigencia.menosDe7 += 1;
    else if (d <= 30) vigencia.entre7y30 += 1;
    else vigencia.masDe30 += 1;
    if (c.inicio && c.venceEn) duraciones.push(diasEntre(c.inicio, c.venceEn));
    if (c.inicio) antiguedades.push(Math.max(0, diasEntre(c.inicio, hoy)));
  }
  const media = (xs: number[]) => (xs.length > 0 ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

  const g = globalesResult.rows[0];

  return {
    activas: activas.length,
    registradas: filas.length,
    participantesUnicos: Number(g?.participantes ?? 0),
    aportesRecibidos: Number(g?.aportes ?? 0),
    avanceMedio,
    porTematica,
    porTipoDeDato,
    porEstado,
    vigencia: {
      ...vigencia,
      duracionMediaEnDias: media(duraciones),
      antiguedadMediaEnDias: media(antiguedades),
    },
    masParticipacion: [...activas]
      .sort((a, b) => b.participantes - a.participantes || b.aportes - a.aportes)
      .slice(0, 3)
      .map(({ inicio, ...fila }) => (void inicio, fila)),
    cortadoEn: new Date(),
  };
}

/** Datos de cabecera del panel individual (el resto sale de lib/campanas/panel.ts). */
export async function obtenerCabeceraDeCampana(
  id: string,
): Promise<{ tematica: string; creador: string; supervisadaPor: string } | null> {
  await prepararLectura();
  if (!/^\d+$/.test(id)) return null;

  const result = await pool.query(
    `SELECT COALESCE(NULLIF(c.tematica, ''), c.tag, '') AS tematica, c.creator_name, c.supervisado_por_root,
            TRIM(CONCAT(u.nombre, ' ', u.apellidos)) AS supervisor
     FROM campanas c
     LEFT JOIN usuarios u ON u.id = c.supervisor_id
     WHERE c.id = $1 LIMIT 1`,
    [id],
  );
  if (result.rowCount === 0) return null;
  const r = result.rows[0];
  return {
    tematica: String(r.tematica ?? ""),
    creador: String(r.creator_name ?? ""),
    supervisadaPor: r.supervisado_por_root ? "SuperUsuario" : r.supervisor ? String(r.supervisor) : "Sin supervisor",
  };
}
