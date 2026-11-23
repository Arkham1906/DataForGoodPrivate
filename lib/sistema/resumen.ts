// Resumen de la pantalla de inicio del SuperUsuario, /sistema (2026-11-22, a pedido del usuario: "un dashboard con
// resumen, que tenga niveles de información"). Lo que no dan los dashboards de cada área:
// - las cifras clave del periodo comparadas con el periodo anterior equivalente (periodoAnterior);
// - lo que requiere atención ahora, con su enlace (mismos criterios que el recuadro del menú lateral,
//   lib/sistema/aviso-del-menu.ts, más los aportes que esperan revisión hace más de una semana);
// - las cifras de moderación del periodo (reportes y sanciones).
// El resto del inicio sale de obtenerDashboardDeUsuarios, obtenerDashboardDeAportes y obtenerDashboardDeCampanas.
// Nunca lanza: si una consulta falla, esa parte queda en ceros y se registra el error.

import { pool } from "@/lib/db";
import type { Periodo } from "@/lib/periodo";
import { condicionDePeriodo, limitesDelPeriodo } from "@/lib/series-de-tiempo";
import { contarReportesPendientes } from "@/lib/reportes/reportes";
import { contarTematicasPendientes } from "@/lib/tematicas/catalogo";
import { contarEtiquetasPendientes } from "@/lib/etiquetas/catalogo";
import { contarApelacionesPendientes } from "@/lib/apelaciones/apelaciones";

/** Días que un aporte puede esperar revisión antes de salir en "Requiere atención". */
export const DIAS_DE_ESPERA_DE_UN_APORTE = 7;

export type Rango = { desde: string; hasta: string };

/** Una cifra del periodo y la del periodo anterior (null en el histórico, que no tiene anterior). */
export type Comparada = { actual: number; anterior: number | null };

export type PendienteDelPanel = {
  clave: string;
  cantidad: number;
  texto: string;
  /** Qué hacer o por qué importa. */
  detalle: string;
  href: string;
  /** "urgente": bloquea a alguien (una campaña sin supervisar, un reporte); "aviso": conviene revisarlo. */
  tono: "urgente" | "aviso";
};

export type ResumenDelSistema = {
  /** El periodo elegido y el anterior con el que se compara; null en el histórico. */
  rango: Rango | null;
  anterior: Rango | null;
  usuariosNuevos: Comparada;
  aportesRecibidos: Comparada;
  /** Aprobados entre revisados de los aportes enviados en el periodo, en porcentaje (null si no se revisó ninguno). */
  tasaDeAprobacion: { actual: number | null; anterior: number | null };
  campanasNuevas: Comparada;
  pendientes: PendienteDelPanel[];
  haySupervisores: boolean;
  moderacion: {
    reportesRecibidos: Comparada;
    reportesPendientes: number;
    sancionesAplicadas: Comparada;
    supervisores: number;
    sancionesPorTipo: { etiqueta: string; valor: number }[];
    reportesPorTipo: { etiqueta: string; valor: number }[];
  };
};

/* ── fechas ─────────────────────────────────────────────────────────────── */

function aFecha(dia: string): Date {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function aTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(dia: string, dias: number): string {
  const f = aFecha(dia);
  f.setUTCDate(f.getUTCDate() + dias);
  return aTexto(f);
}

/** El mismo día `meses` atrás; si ese mes es más corto, su último día (31 de marzo → 28 o 29 de febrero). */
function restarMeses(dia: string, meses: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1 - meses + 1, 0)).getUTCDate();
  return aTexto(new Date(Date.UTC(a, m - 1 - meses, Math.min(d, ultimo))));
}

/**
 * El periodo anterior equivalente: ayer para hoy; la semana pasada hasta el mismo día; el mes pasado del 1 al mismo
 * día; el año pasado del 1 de enero al mismo día; para fechas específicas, los mismos días justo antes. El histórico
 * no tiene anterior.
 */
export function periodoAnterior(periodo: Periodo, rango: Rango): Rango | null {
  switch (periodo.clave) {
    case "historico":
      return null;
    case "hoy":
      return { desde: sumarDias(rango.desde, -1), hasta: sumarDias(rango.hasta, -1) };
    case "semana":
      return { desde: sumarDias(rango.desde, -7), hasta: sumarDias(rango.hasta, -7) };
    case "mes":
      return { desde: restarMeses(rango.desde, 1), hasta: restarMeses(rango.hasta, 1) };
    case "anio":
      return { desde: restarMeses(rango.desde, 12), hasta: restarMeses(rango.hasta, 12) };
    default: {
      const dias = Math.round((aFecha(rango.hasta).getTime() - aFecha(rango.desde).getTime()) / 86_400_000) + 1;
      const hasta = sumarDias(rango.desde, -1);
      return { desde: sumarDias(hasta, -(dias - 1)), hasta };
    }
  }
}

/* ── consultas ──────────────────────────────────────────────────────────── */

const PRINCIPIO = "2000-01-01";

type FilaDePeriodo = {
  usuarios: number;
  aportes: number;
  aprobados: number;
  revisados: number;
  campanas: number;
  reportes: number;
  sanciones: number;
};

/** Las cifras que se comparan, para un rango de días de Tepic. */
async function cifrasDelRango(desde: string, hasta: string): Promise<FilaDePeriodo> {
  const { rows } = await pool.query<FilaDePeriodo>(
    `SELECT
       (SELECT COUNT(*)::int FROM usuarios WHERE ${condicionDePeriodo("created_at", "$1", "$2")}) AS usuarios,
       (SELECT COUNT(*)::int FROM aportes WHERE ${condicionDePeriodo("submitted_at", "$1", "$2")}) AS aportes,
       (SELECT COUNT(*)::int FROM aportes WHERE status = 'aceptado' AND ${condicionDePeriodo("submitted_at", "$1", "$2")}) AS aprobados,
       (SELECT COUNT(*)::int FROM aportes WHERE status IN ('aceptado', 'rechazado') AND ${condicionDePeriodo("submitted_at", "$1", "$2")}) AS revisados,
       (SELECT COUNT(*)::int FROM campanas WHERE ${condicionDePeriodo("created_at", "$1", "$2")}) AS campanas,
       (SELECT COUNT(*)::int FROM reportes WHERE ${condicionDePeriodo("created_at", "$1", "$2")}) AS reportes,
       (SELECT COUNT(*)::int FROM sanciones WHERE ${condicionDePeriodo("aplicada_en", "$1", "$2")})
         + (SELECT COUNT(*)::int FROM campana_baneados WHERE ${condicionDePeriodo("created_at", "$1", "$2")}) AS sanciones`,
    [desde, hasta],
  );
  return rows[0];
}

const tasa = (aprobados: number, revisados: number) => (revisados > 0 ? Math.round((aprobados / revisados) * 100) : null);

const CERO: FilaDePeriodo = { usuarios: 0, aportes: 0, aprobados: 0, revisados: 0, campanas: 0, reportes: 0, sanciones: 0 };

async function seguro<T>(promesa: Promise<T>, siFalla: T, que: string): Promise<T> {
  try {
    return await promesa;
  } catch (error) {
    console.error(`Resumen del panel: no se pudo leer ${que}`, error);
    return siFalla;
  }
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export async function obtenerResumenDelSistema(periodo: Periodo): Promise<ResumenDelSistema> {
  const limites = limitesDelPeriodo(periodo);
  const rango: Rango | null = limites.desde ? { desde: limites.desde, hasta: limites.hasta } : null;
  const anterior = rango ? periodoAnterior(periodo, rango) : null;

  const [actual, previo, estado, reportesPendientes, tematicas, etiquetas, sancionesPorTipo, reportesPorTipo, apelaciones] =
    await Promise.all([
      seguro(cifrasDelRango(rango?.desde ?? PRINCIPIO, limites.hasta), CERO, "las cifras del periodo"),
      anterior ? seguro(cifrasDelRango(anterior.desde, anterior.hasta), CERO, "las cifras del periodo anterior") : null,
      seguro(
        pool
          .query<{ por_supervisar: number; datos: number; supervisores: number; esperando: number }>(
            `SELECT
               (SELECT COUNT(*)::int FROM campanas
                 WHERE status = 'en_revision' AND (supervisado_por_root OR supervisor_id IS NULL)) AS por_supervisar,
               (SELECT COUNT(*)::int FROM campana_datos_abiertos d JOIN campanas c ON c.id = d.campana_id
                 WHERE d.estado = 'pendiente' AND (c.supervisado_por_root OR c.supervisor_id IS NULL)) AS datos,
               (SELECT COUNT(DISTINCT usuario_id)::int FROM usuario_roles WHERE rol = 'supervisor') AS supervisores,
               (SELECT COUNT(*)::int FROM aportes
                 WHERE status IN ('pendiente', 'espera_final')
                   AND submitted_at < NOW() - make_interval(days => $1)) AS esperando`,
            [DIAS_DE_ESPERA_DE_UN_APORTE],
          )
          .then((r) => r.rows[0]),
        { por_supervisar: 0, datos: 0, supervisores: 0, esperando: 0 },
        "los pendientes",
      ),
      seguro(contarReportesPendientes(), { reportes: 0, casos: 0 }, "los reportes pendientes"),
      seguro(contarTematicasPendientes(), 0, "las temáticas pendientes"),
      seguro(contarEtiquetasPendientes(), 0, "las subtemáticas pendientes"),
      seguro(
        pool
          .query<{ etiqueta: string; valor: number }>(
            `SELECT CASE tipo WHEN 'STRIKE' THEN 'Avisos' WHEN 'SUSPENSION_TEMPORAL' THEN 'Suspensiones'
                              ELSE 'Baneos de la cuenta' END AS etiqueta,
                    COUNT(*)::int AS valor
               FROM sanciones WHERE ${condicionDePeriodo("aplicada_en", "$1", "$2")}
              GROUP BY 1
             UNION ALL
             SELECT 'Baneos en una campaña', COUNT(*)::int FROM campana_baneados
              WHERE ${condicionDePeriodo("created_at", "$1", "$2")}
             HAVING COUNT(*) > 0
             ORDER BY 2 DESC`,
            [rango?.desde ?? PRINCIPIO, limites.hasta],
          )
          .then((r) => r.rows),
        [],
        "las sanciones por tipo",
      ),
      seguro(
        pool
          .query<{ etiqueta: string; valor: number }>(
            `SELECT CASE tipo WHEN 'campana' THEN 'De campañas' ELSE 'De aportes' END AS etiqueta, COUNT(*)::int AS valor
               FROM reportes WHERE ${condicionDePeriodo("created_at", "$1", "$2")}
              GROUP BY 1 ORDER BY 2 DESC`,
            [rango?.desde ?? PRINCIPIO, limites.hasta],
          )
          .then((r) => r.rows),
        [],
        "los reportes por tipo",
      ),
      // Nunca lanza: si falla, 0.
      contarApelacionesPendientes(),
    ]);

  const pendientes: PendienteDelPanel[] = [];
  if (estado.por_supervisar > 0) {
    pendientes.push({
      clave: "supervisar",
      cantidad: estado.por_supervisar,
      texto: `${plural(estado.por_supervisar, "campaña espera", "campañas esperan")} supervisión`,
      detalle: "Sin supervisor o a tu cargo: no reciben aportes hasta que alguien las acepte.",
      href: "/supervisar",
      tono: "urgente",
    });
  }
  if (reportesPendientes.reportes > 0) {
    pendientes.push({
      clave: "reportes",
      cantidad: reportesPendientes.reportes,
      texto: `${plural(reportesPendientes.reportes, "reporte pendiente", "reportes pendientes")} en ${plural(reportesPendientes.casos, "caso", "casos")}`,
      detalle: "Personas o aportes reportados que esperan una decisión.",
      href: "/supervisar/reportes",
      tono: "urgente",
    });
  }
  if (apelaciones > 0) {
    pendientes.push({
      clave: "apelaciones",
      cantidad: apelaciones,
      texto: `${plural(apelaciones, "apelación espera", "apelaciones esperan")} tu respuesta`,
      detalle: "Personas que apelaron una sanción o un baneo en una campaña. Solo tú las resuelves.",
      href: "/apelaciones",
      tono: "urgente",
    });
  }
  if (estado.datos > 0) {
    pendientes.push({
      clave: "datos",
      cantidad: estado.datos,
      texto: `${plural(estado.datos, "decisión", "decisiones")} de datos abiertos`,
      detalle: "Campañas terminadas: decide si sus datos se publican en el catálogo abierto.",
      href: "/supervisar",
      tono: "aviso",
    });
  }
  if (estado.esperando > 0) {
    pendientes.push({
      clave: "aportes",
      cantidad: estado.esperando,
      texto: `${plural(estado.esperando, "aporte espera", "aportes esperan")} revisión hace más de ${DIAS_DE_ESPERA_DE_UN_APORTE} días`,
      detalle: "Los revisa quien creó la campaña o su revisor; quizá convenga recordárselo.",
      href: "/aportes?etapa=pendientes",
      tono: "aviso",
    });
  }
  if (tematicas > 0) {
    pendientes.push({
      clave: "tematicas",
      cantidad: tematicas,
      texto: `${plural(tematicas, "temática propuesta", "temáticas propuestas")} por revisar`,
      detalle: "Aprobarlas las ofrece a todos; rechazarlas las borra.",
      href: "/sistema/tematicas",
      tono: "aviso",
    });
  }
  if (etiquetas > 0) {
    pendientes.push({
      clave: "subtematicas",
      cantidad: etiquetas,
      texto: `${plural(etiquetas, "subtemática propuesta", "subtemáticas propuestas")} por revisar`,
      detalle: "Etiquetas que propusieron los creadores en sus campañas.",
      href: "/sistema/tematicas",
      tono: "aviso",
    });
  }

  const comparada = (clave: keyof FilaDePeriodo): Comparada => ({ actual: actual[clave], anterior: previo ? previo[clave] : null });

  return {
    rango,
    anterior,
    usuariosNuevos: comparada("usuarios"),
    aportesRecibidos: comparada("aportes"),
    tasaDeAprobacion: {
      actual: tasa(actual.aprobados, actual.revisados),
      anterior: previo ? tasa(previo.aprobados, previo.revisados) : null,
    },
    campanasNuevas: comparada("campanas"),
    pendientes,
    haySupervisores: estado.supervisores > 0,
    moderacion: {
      reportesRecibidos: comparada("reportes"),
      reportesPendientes: reportesPendientes.reportes,
      sancionesAplicadas: comparada("sanciones"),
      supervisores: estado.supervisores,
      sancionesPorTipo,
      reportesPorTipo,
    },
  };
}
