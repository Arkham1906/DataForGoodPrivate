// Periodo de las gráficas de tiempo (2026-11-22, a pedido del usuario). Sin imports de servidor: lo usan el
// selector (components/ui/SelectorDePeriodo, cliente) y las consultas (lib/series-de-tiempo.ts).
// Periodos de calendario en días de Tepic (decisión del usuario, mismo día: "por hoy, semana, mes y año"): Hoy (por
// hora), Esta semana (de lunes a hoy), Este mes y Este año (del día 1 a hoy), más Todo el histórico y Fechas
// específicas. Vive en la URL: ?periodo=hoy|semana|mes|anio|historico, o ?desde=AAAA-MM-DD y ?hasta=AAAA-MM-DD
// (periodo=personalizado). Cada pantalla elige su periodo por defecto; un valor que no se reconoce cae en él.
// *Historia:* del mismo día por la tarde a la noche, los atajos fueron últimos 7, 14, 30, 90 días y 12 meses.

export type ClaveDePeriodo = "hoy" | "semana" | "mes" | "anio" | "historico" | "personalizado";

/** `desde` y `hasta` solo en "personalizado" (AAAA-MM-DD, ya validados y en orden). */
export type Periodo = { clave: ClaveDePeriodo; desde: string | null; hasta: string | null };

export const OPCIONES_DE_PERIODO: { clave: ClaveDePeriodo; etiqueta: string }[] = [
  { clave: "hoy", etiqueta: "Hoy" },
  { clave: "semana", etiqueta: "Esta semana" },
  { clave: "mes", etiqueta: "Este mes" },
  { clave: "anio", etiqueta: "Este año" },
  { clave: "historico", etiqueta: "Todo el histórico" },
  { clave: "personalizado", etiqueta: "Fechas específicas" },
];

/** Valores de antes en la URL (?periodo= de los atajos y ?rango= de los dashboards), para que los enlaces sirvan. */
const EQUIVALENTES: Record<string, ClaveDePeriodo> = {
  "7d": "semana",
  "14d": "mes",
  "30d": "mes",
  "90d": "anio",
  "12m": "anio",
};

/* ── Series de tiempo: lo que arma lib/series-de-tiempo.ts y pinta ui/GraficaDeTiempo ── */

export type UnidadDeTiempo = "hour" | "day" | "week" | "month" | "year";

export type CubetaDeTiempo = {
  /** Clave única de la cubeta: "AAAA-MM-DD" o, por hora, "AAAA-MM-DDTHH". */
  inicio: string;
  /** Texto bajo la columna: "9:00", "9 nov", "nov" o "2026". */
  eje: string;
  /**
   * Segunda línea bajo el eje, que se muestra en la primera fecha visible y donde cambia: el año, o la fecha
   * ("22 nov 2026") en una gráfica por hora; "" si la unidad es el año.
   */
  anio: string;
  /** Texto completo del detalle y de la tabla: "Domingo 9 de noviembre de 2026", "Del 3 al 9 nov 2026"... */
  detalle: string;
  /** Un valor por serie, en el orden de `series`. */
  valores: number[];
};

export type SerieDeTiempo = {
  unidad: UnidadDeTiempo;
  /** Periodo real que cubre ("AAAA-MM-DD"), ya con el inicio del histórico resuelto. */
  desde: string;
  hasta: string;
  cubetas: CubetaDeTiempo[];
};

/** "por hora", "por día"... para los títulos. */
export const NOMBRE_DE_UNIDAD: Record<UnidadDeTiempo, string> = {
  hour: "por hora",
  day: "por día",
  week: "por semana",
  month: "por mes",
  year: "por año",
};

const CLAVES = new Set<string>(OPCIONES_DE_PERIODO.map((o) => o.clave));

/** "AAAA-MM-DD" de un día que existe (no 2026-02-30), o null. */
export function fechaValida(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia && anio >= 2000
    ? valor
    : null;
}

type Parametros = { periodo?: string | string[]; desde?: string | string[]; hasta?: string | string[]; rango?: string | string[] };

function uno(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * El periodo pedido en la URL. Con `desde` o `hasta` válidos es "personalizado" (si falta uno, el otro día
 * solo; si vienen al revés, se ordenan). `rango` es el parámetro viejo de /usuarios/dashboard y
 * /aportes/dashboard; los valores de antes (30d, 12m...) se cambian por su equivalente de calendario.
 */
export function periodoDesde(parametros: Parametros, defecto: ClaveDePeriodo): Periodo {
  let desde = fechaValida(uno(parametros.desde));
  let hasta = fechaValida(uno(parametros.hasta));
  if (desde || hasta) {
    desde ??= hasta;
    hasta ??= desde;
    if (desde! > hasta!) [desde, hasta] = [hasta, desde];
    return { clave: "personalizado", desde, hasta };
  }
  const pedido = uno(parametros.periodo) ?? uno(parametros.rango);
  const clave =
    pedido && CLAVES.has(pedido) && pedido !== "personalizado"
      ? (pedido as ClaveDePeriodo)
      : (pedido && EQUIVALENTES[pedido]) || defecto;
  return { clave, desde: null, hasta: null };
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "3 nov 2026" de un "AAAA-MM-DD". */
export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return FECHA_CORTA.format(new Date(Date.UTC(anio, mes - 1, dia))).replace(/\./g, "");
}

/** Para títulos: "hoy", "esta semana", "todo el histórico", "del 1 ene 2026 al 15 mar 2026". */
export function textoDelPeriodo(periodo: Periodo): string {
  if (periodo.clave === "personalizado" && periodo.desde && periodo.hasta) {
    return periodo.desde === periodo.hasta
      ? `el ${fechaCorta(periodo.desde)}`
      : `del ${fechaCorta(periodo.desde)} al ${fechaCorta(periodo.hasta)}`;
  }
  const opcion = OPCIONES_DE_PERIODO.find((o) => o.clave === periodo.clave);
  return (opcion?.etiqueta ?? "").toLowerCase();
}
