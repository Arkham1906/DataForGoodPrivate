// Series de tiempo de las gráficas (2026-11-22, a pedido del usuario): cada columna con su fecha completa (hora,
// día, semana, mes o año, y el año a la vista) y cualquier periodo de lib/periodo.ts (hoy, esta semana, este mes,
// este año, todo el histórico o unas fechas específicas). Una sola consulta para todas: la fuente da un instante `t`
// (TIMESTAMPTZ) y una serie `s` por fila, y aquí se cuentan por cubeta en la hora de Tepic. La cubeta sale del largo
// del periodo: un solo día, por hora (hoy, hasta la hora actual); hasta 45 días, por día; hasta 30 semanas, por
// semana (de lunes a domingo); hasta 3 años, por mes; más, por año. Lo pinta components/ui/GraficaDeTiempo.
// Solo servidor (usa pg).

import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS, ahoraEnZona, hoyEnTepic } from "@/lib/fecha-de-tepic";
import { fechaCorta, type CubetaDeTiempo, type Periodo, type SerieDeTiempo, type UnidadDeTiempo } from "@/lib/periodo";

// Los tipos y los nombres de unidad viven en lib/periodo.ts (sin pg) para que los use el navegador.
export { NOMBRE_DE_UNIDAD, type CubetaDeTiempo, type SerieDeTiempo, type UnidadDeTiempo } from "@/lib/periodo";

const ZONA = ZONA_DE_CAMPANAS;
/** Para las consultas de métricas: el histórico empieza aquí (no hay datos antes). */
const PRINCIPIO = "2000-01-01";

const MES_CORTO = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" });
const MES_LARGO = new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" });
const DIA_LARGO = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function aFecha(dia: string): Date {
  const [anio, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, d));
}

function aTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000) + 1;
}

function mesCorto(fecha: Date): string {
  return MES_CORTO.format(fecha).replace(/\./g, "");
}

function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** El periodo en días de Tepic; `desde` es null en el histórico (lo resuelve quien consulta). */
export function limitesDelPeriodo(periodo: Periodo, hoy = hoyEnTepic()): { desde: string | null; hasta: string } {
  if (periodo.clave === "personalizado" && periodo.desde && periodo.hasta) {
    const hasta = periodo.hasta > hoy ? hoy : periodo.hasta;
    return { desde: periodo.desde > hasta ? hasta : periodo.desde, hasta };
  }
  const fecha = aFecha(hoy);
  if (periodo.clave === "hoy") return { desde: hoy, hasta: hoy };
  if (periodo.clave === "semana") {
    // De lunes (getUTCDay: 0 es domingo) a hoy.
    fecha.setUTCDate(fecha.getUTCDate() - ((fecha.getUTCDay() + 6) % 7));
    return { desde: aTexto(fecha), hasta: hoy };
  }
  if (periodo.clave === "mes") return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
  if (periodo.clave === "anio") return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
  return { desde: null, hasta: hoy };
}

/**
 * Para las métricas que acompañan una gráfica: los dos parámetros (desde y hasta, días de Tepic) que usa
 * condicionDePeriodo(). El histórico va desde PRINCIPIO.
 */
export function parametrosDelPeriodo(periodo: Periodo): [string, string] {
  const { desde, hasta } = limitesDelPeriodo(periodo);
  return [desde ?? PRINCIPIO, hasta];
}

/** `columna` (TIMESTAMPTZ) dentro del periodo: de las 00:00 de `desde` a las 24:00 de `hasta`, hora de Tepic. */
export function condicionDePeriodo(columna: string, parametroDesde: string, parametroHasta: string): string {
  return `${columna} >= (${parametroDesde}::date::timestamp AT TIME ZONE '${ZONA}')
          AND ${columna} < ((${parametroHasta}::date + 1)::timestamp AT TIME ZONE '${ZONA}')`;
}

function unidadPara(dias: number): UnidadDeTiempo {
  if (dias <= 1) return "hour";
  if (dias <= 45) return "day";
  if (dias <= 30 * 7) return "week";
  if (dias <= 3 * 366) return "month";
  return "year";
}

function finDeCubeta(inicio: string, unidad: UnidadDeTiempo): string {
  const fecha = aFecha(inicio);
  if (unidad === "week") fecha.setUTCDate(fecha.getUTCDate() + 6);
  if (unidad === "month") fecha.setUTCMonth(fecha.getUTCMonth() + 1, 0);
  if (unidad === "year") fecha.setUTCMonth(12, 0);
  return aTexto(fecha);
}

/** "Del 3 al 9 nov 2026", "Del 28 oct al 3 nov 2026" o "Del 29 dic 2025 al 4 ene 2026". */
function rangoEnTexto(desde: string, hasta: string): string {
  if (desde === hasta) return fechaCorta(desde);
  const a = aFecha(desde);
  const b = aFecha(hasta);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
  const anio = b.getUTCFullYear();
  if (a.getUTCMonth() === b.getUTCMonth()) return `Del ${a.getUTCDate()} al ${b.getUTCDate()} ${mesCorto(b)} ${anio}`;
  return `Del ${a.getUTCDate()} ${mesCorto(a)} al ${b.getUTCDate()} ${mesCorto(b)} ${anio}`;
}

function etiquetas(inicio: string, fin: string, unidad: Exclude<UnidadDeTiempo, "hour">, completa: boolean) {
  const fecha = aFecha(inicio);
  const anio = String(fecha.getUTCFullYear());
  if (unidad === "day") {
    return { eje: `${fecha.getUTCDate()} ${mesCorto(fecha)}`, anio, detalle: conMayuscula(DIA_LARGO.format(fecha)) };
  }
  if (unidad === "week") {
    return { eje: `${fecha.getUTCDate()} ${mesCorto(fecha)}`, anio, detalle: `Semana: ${rangoEnTexto(inicio, fin).replace(/^Del/, "del")}` };
  }
  if (unidad === "month") {
    return {
      eje: mesCorto(fecha),
      anio,
      detalle: completa ? `${conMayuscula(MES_LARGO.format(fecha))} de ${anio}` : rangoEnTexto(inicio, fin),
    };
  }
  return { eje: anio, anio: "", detalle: completa ? `Año ${anio}` : rangoEnTexto(inicio, fin) };
}

/**
 * Cuenta las filas de `fuente` por cubeta del periodo. `fuente` es un SELECT con las columnas `t` (TIMESTAMPTZ) y
 * `s` (la serie; con una sola serie basta una constante) que usa los parámetros `parametros` ($1, $2...). Con
 * varias `series`, cada valor de `s` va a la suya y los demás se ignoran. En el histórico empieza en
 * `inicioHistorico` ("AAAA-MM-DD"; p. ej. el inicio de la campaña) o, sin él, en el primer dato.
 */
export async function serieDeTiempo(opciones: {
  fuente: string;
  parametros?: unknown[];
  series: string[];
  periodo: Periodo;
  inicioHistorico?: string | null;
}): Promise<SerieDeTiempo> {
  const parametros = opciones.parametros ?? [];
  const hoy = hoyEnTepic();
  const limites = limitesDelPeriodo(opciones.periodo, hoy);
  let desde = limites.desde;
  if (!desde) {
    if (opciones.inicioHistorico) {
      desde = opciones.inicioHistorico.slice(0, 10);
    } else {
      const primero = await pool.query<{ dia: string | null }>(
        `SELECT to_char(MIN(f.t AT TIME ZONE '${ZONA}'), 'YYYY-MM-DD') AS dia FROM (${opciones.fuente}) f`,
        parametros,
      );
      desde = primero.rows[0]?.dia ?? limites.hasta;
    }
    if (desde > limites.hasta) desde = limites.hasta;
  }
  const hasta = limites.hasta;
  const unidad = unidadPara(diasEntre(desde, hasta));
  // Por hora, el día de hoy llega hasta la hora actual (las horas que faltan aún no pasan).
  const ultimaHora = unidad === "hour" && hasta === hoy ? ahoraEnZona().hour : 23;
  const primeraCubeta = `${desde} 00:00:00`;
  const ultimaCubeta = unidad === "hour" ? `${hasta} ${String(ultimaHora).padStart(2, "0")}:00:00` : `${hasta} 00:00:00`;

  const n = parametros.length;
  const u = `$${n + 1}::text`;
  const d = `$${n + 2}`;
  const h = `$${n + 3}`;
  const { rows } = await pool.query<{ inicio: string; s: string | null; n: number }>(
    `WITH cubetas AS (
       SELECT generate_series(date_trunc(${u}, $${n + 4}::timestamp), date_trunc(${u}, $${n + 5}::timestamp),
                              ('1 ' || ${u})::interval) AS inicio
     ),
     datos AS (
       SELECT date_trunc(${u}, f.t AT TIME ZONE '${ZONA}') AS inicio, f.s::text AS s
         FROM (${opciones.fuente}) f
        WHERE ${condicionDePeriodo("f.t", d, h)}
     )
     SELECT to_char(c.inicio, 'YYYY-MM-DD"T"HH24') AS inicio, d.s, COUNT(d.inicio)::int AS n
       FROM cubetas c LEFT JOIN datos d ON d.inicio = c.inicio
      GROUP BY c.inicio, d.s
      ORDER BY c.inicio`,
    [...parametros, unidad, desde, hasta, primeraCubeta, ultimaCubeta],
  );

  const porCubeta = new Map<string, number[]>();
  for (const fila of rows) {
    const valores = porCubeta.get(fila.inicio) ?? opciones.series.map(() => 0);
    if (fila.s !== null) {
      const i = opciones.series.length === 1 ? 0 : opciones.series.indexOf(fila.s);
      if (i >= 0) valores[i] += Number(fila.n);
    }
    porCubeta.set(fila.inicio, valores);
  }

  const cubetas: CubetaDeTiempo[] = [...porCubeta.entries()].map(([clave, valores]) => {
    const dia = clave.slice(0, 10);
    if (unidad === "hour") {
      const hora = Number(clave.slice(11, 13));
      return {
        inicio: clave,
        eje: `${hora}:00`,
        anio: fechaCorta(dia),
        detalle: `${conMayuscula(DIA_LARGO.format(aFecha(dia)))}, de ${hora}:00 a ${hora + 1}:00`,
        valores,
      };
    }
    const inicio = dia < desde! ? desde! : dia;
    const finReal = finDeCubeta(dia, unidad);
    const fin = finReal > hasta ? hasta : finReal;
    const completa = inicio === dia && fin === finReal;
    return { inicio, ...etiquetas(inicio, fin, unidad, completa), valores };
  });

  return { unidad, desde, hasta, cubetas };
}
