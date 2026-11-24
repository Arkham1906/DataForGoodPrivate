// Resumen de la pantalla de inicio del SuperUsuario, /sistema (2026-11-22, a pedido del usuario: "un dashboard con
// resumen, que tenga niveles de información"). Lo que no dan los dashboards de cada área:
// - las cifras clave del periodo comparadas con el periodo anterior equivalente (periodoAnterior);
// - lo que requiere atención ahora, con su enlace: desde el 2026-11-24 (a pedido del usuario) sale de la misma fuente
//   que /sistema/pendientes y el menú, pendientesDelPanel() de lib/pendientes/del-panel.ts, agrupada por tipo
//   ("3 campañas esperan supervisión"); antes tenía sus propias consultas con los mismos criterios;
// - las cifras de moderación del periodo (reportes y sanciones).
// El resto del inicio sale de obtenerDashboardDeUsuarios, obtenerDashboardDeAportes y obtenerDashboardDeCampanas.
// Nunca lanza: si una consulta falla, esa parte queda en ceros y se registra el error.

import { pool } from "@/lib/db";
import type { Periodo } from "@/lib/periodo";
import { condicionDePeriodo, limitesDelPeriodo } from "@/lib/series-de-tiempo";
import { pendientesDelPanel } from "@/lib/pendientes/del-panel";
import { DIAS_DE_ESPERA_DE_UN_APORTE, type Pendiente } from "@/lib/pendientes/tipos";

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

  const [actual, previo, supervisores, delPanel, sancionesPorTipo, reportesPorTipo] =
    await Promise.all([
      seguro(cifrasDelRango(rango?.desde ?? PRINCIPIO, limites.hasta), CERO, "las cifras del periodo"),
      anterior ? seguro(cifrasDelRango(anterior.desde, anterior.hasta), CERO, "las cifras del periodo anterior") : null,
      seguro(
        pool
          .query<{ n: number }>(`SELECT COUNT(DISTINCT usuario_id)::int AS n FROM usuario_roles WHERE rol = 'supervisor'`)
          .then((r) => r.rows[0]?.n ?? 0),
        0,
        "los supervisores",
      ),
      // null si falla: entonces no se dice "Todo al día" ni que falten supervisores.
      seguro<Pendiente[] | null>(pendientesDelPanel(), null, "los pendientes"),
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
    ]);

  // Los pendientes de lib/pendientes/del-panel.ts, agrupados por tipo en el orden de siempre (2026-11-24).
  const items = delPanel ?? [];
  const deTipo = (tipo: string) => items.filter((p) => p.tipo === tipo);
  const cuantos = (lista: Pendiente[]) => lista.reduce((suma, p) => suma + (p.cantidad ?? 1), 0);
  const pendientes: PendienteDelPanel[] = [];
  const agregar = (tipo: string, armar: (n: number, lista: Pendiente[]) => Omit<PendienteDelPanel, "cantidad">) => {
    const lista = deTipo(tipo);
    const n = cuantos(lista);
    if (n > 0) pendientes.push({ ...armar(n, lista), cantidad: n });
  };
  agregar("tickets", (n) => ({
    clave: "tickets",
    texto: `${plural(n, "ticket de supervisor espera", "tickets de supervisores esperan")} tu decisión`,
    detalle: "Sanciones o decisiones de datos abiertos que pidió la supervisión: no se aplican hasta que las apruebes.",
    href: "/tickets",
    tono: "urgente",
  }));
  agregar("supervisar", (n) => ({
    clave: "supervisar",
    texto: `${plural(n, "campaña espera", "campañas esperan")} supervisión`,
    detalle: "Sin supervisor o a tu cargo: no reciben aportes hasta que alguien las acepte.",
    href: "/supervisar",
    tono: "urgente",
  }));
  agregar("reportes", (n, lista) => ({
    clave: "reportes",
    texto: `${plural(n, "reporte pendiente", "reportes pendientes")} en ${plural(lista[0]?.casos ?? n, "caso", "casos")}`,
    detalle: "Personas o aportes reportados que esperan una decisión.",
    href: "/supervisar/reportes",
    tono: "urgente",
  }));
  agregar("apelaciones", (n) => ({
    clave: "apelaciones",
    texto: `${plural(n, "apelación espera", "apelaciones esperan")} tu respuesta`,
    detalle: "Personas que apelaron una sanción o un baneo en una campaña. Solo tú las resuelves.",
    href: "/apelaciones",
    tono: "urgente",
  }));
  agregar("datos", (n) => ({
    clave: "datos",
    texto: `${plural(n, "decisión", "decisiones")} de datos abiertos`,
    detalle: "Campañas terminadas: decide si sus datos se publican en el catálogo abierto.",
    href: "/supervisar",
    tono: "aviso",
  }));
  agregar("aportes", (n) => ({
    clave: "aportes",
    texto: `${plural(n, "aporte espera", "aportes esperan")} revisión hace más de ${DIAS_DE_ESPERA_DE_UN_APORTE} días`,
    detalle: "Los revisa quien creó la campaña o su revisor; quizá convenga recordárselo.",
    href: "/aportes?etapa=pendientes",
    tono: "aviso",
  }));
  agregar("tematicas", (n) => ({
    clave: "tematicas",
    texto: `${plural(n, "temática propuesta", "temáticas propuestas")} por revisar`,
    detalle: "Aprobarlas las ofrece a todos; rechazarlas las borra.",
    href: "/sistema/tematicas",
    tono: "aviso",
  }));
  agregar("subtematicas", (n) => ({
    clave: "subtematicas",
    texto: `${plural(n, "subtemática propuesta", "subtemáticas propuestas")} por revisar`,
    detalle: "Etiquetas que propusieron los creadores en sus campañas.",
    href: "/sistema/tematicas",
    tono: "aviso",
  }));
  // "Ningún supervisor" lo pinta la página aparte (con sus dos botones): sale de la misma fuente.
  const haySupervisores = delPanel === null || deTipo("sin_supervisores").length === 0;

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
    haySupervisores,
    moderacion: {
      reportesRecibidos: comparada("reportes"),
      reportesPendientes: cuantos(deTipo("reportes")),
      sancionesAplicadas: comparada("sanciones"),
      supervisores,
      sancionesPorTipo,
      reportesPorTipo,
    },
  };
}
