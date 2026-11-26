// Reglas de las misiones (2026-11-04; SRS v1.3: RF-GAM-40 a 45). Lógica pura, sin base de datos ni reloj propio:
// tipos del catálogo, periodo de cada cuenta y avance de una misión. La usan el servidor y los componentes.
//
// Misiones de inicio (2026-11-18; SRS v1.4: RF-GAM-103, RN-GAM-41): periodicidad «inicio», un solo periodo por cuenta,
// los 7 días de la semana de bienvenida desde el primer inicio de sesión. No se sortean: salen todas las activas.
//
// «Envía…» y «Logra…», dificultad y recompensas (2026-11-19; SRS v1.4: RF-GAM-43, 44, 122, RN-GAM-40, tabla 4.6, con la
// decisión del responsable del 19 nov): cuándo cuenta una misión se deduce de su condición (cuandoCuenta). Las difíciles
// tienen recompensa «sorteo»: al asignarse la misión sale un potenciador o un protector, 50/50 según los pesos de
// misiones.json, y como máximo una difícil por periodo.
//
// Periodos: las diarias van de 00:00 a 24:00 y las semanales de lunes a domingo, en hora de Tepic, como la racha
// (decisión del responsable; cierra DA-GAM-17). Antes eran bloques de 24 horas y 7 días desde el primer inicio de sesión.

import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";

export type Periodicidad = "diaria" | "semanal" | "inicio";
/** Las que se sortean en cada periodo (seleccion de misiones.json). */
export type PeriodicidadSorteada = Exclude<Periodicidad, "inicio">;

export const TIPOS_DE_APORTE = ["texto", "foto", "video", "audio", "documento"] as const;

export const MEDIDAS_DE_MISION = [
  "aportes",
  "dias_distintos",
  "dias_seguidos",
  "tipos_distintos",
  "campanas_distintas",
  "campanas_nuevas",
  "tematicas_distintas",
  "tematicas_nuevas",
  "cuotas_completadas",
  "campanas_guardadas",
  "inscripciones",
] as const;
export type MedidaDeMision = (typeof MEDIDAS_DE_MISION)[number];

/** Condición de lib/datos/misiones.json. Los campos opcionales filtran los aportes que entran a la medida. */
export type CondicionDeMision = {
  mide: MedidaDeMision;
  objetivo: number;
  tipos?: string[];
  soloAceptados?: boolean;
  /** Calificación mínima; requiere soloAceptados. */
  minEstrellas?: number;
  /** Largo mínimo de la descripción. */
  minCaracteres?: number;
  soloDeInteres?: boolean;
  soloEspeciales?: boolean;
};

export type Dificultad = "normal" | "dificil";

export const OBJETOS_DE_MISION = ["potenciador", "protector"] as const;
export type ObjetoDeMision = (typeof OBJETOS_DE_MISION)[number];

/**
 * EXP o un objeto. «sorteo» solo vive en el catálogo: al asignar la misión se cambia por el objeto que salió
 * (sortearObjeto) y eso se guarda en la instancia. Una misión sin recompensa se completa y cuenta para los rangos.
 */
export type RecompensaDeMision = { tipo: "exp"; cantidad: number } | { tipo: ObjetoDeMision } | { tipo: "sorteo" } | null;

/** Cuándo avanza una misión: al enviar («Envía…»), al aceptarse el aporte («Logra…») o al hacer la acción (RN-GAM-40). */
export type CuandoCuenta = "envio" | "aceptacion" | "accion";

export function cuandoCuenta(c: CondicionDeMision): CuandoCuenta {
  if (c.mide === "campanas_guardadas" || c.mide === "inscripciones") return "accion";
  // Una cuota solo se completa con aportes aceptados.
  return c.soloAceptados || c.mide === "cuotas_completadas" ? "aceptacion" : "envio";
}

/** Duración de cada periodicidad. Las diarias y semanales son de calendario (periodoDeCalendario); «inicio» dura la
 * semana de bienvenida: los primeros 7 días desde el primer inicio de sesión (RF-GAM-103, 106). */
export const DURACION_MS: Record<Periodicidad, number> = { diaria: 86_400_000, semanal: 604_800_000, inicio: 604_800_000 };

export type Periodo = { inicio: number; fin: number };

const UN_DIA_MS = 86_400_000;
const PARTES_EN_TEPIC = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_DE_CAMPANAS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Las 00:00 del día de Tepic en que cae el instante, en milisegundos UTC, y el día de la semana (0 domingo). */
function diaEnTepic(instante: number): { inicio: number; diaDeLaSemana: number } {
  const p = Object.fromEntries(PARTES_EN_TEPIC.formatToParts(new Date(instante)).map((x) => [x.type, Number(x.value)]));
  const medianoche = Date.UTC(p.year, p.month - 1, p.day);
  // Diferencia entre la hora de Tepic y UTC en ese instante (sin milisegundos).
  const desfase = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instante / 1000) * 1000;
  return { inicio: medianoche - desfase, diaDeLaSemana: new Date(medianoche).getUTCDay() };
}

/** El día (00:00 a 24:00) o la semana (lunes a domingo) de calendario de Tepic, como la racha (decisión del responsable). */
export function periodoDeCalendario(instante: number, periodicidad: "diaria" | "semanal"): Periodo {
  const { inicio, diaDeLaSemana } = diaEnTepic(instante);
  if (periodicidad === "diaria") return { inicio, fin: inicio + UN_DIA_MS };
  const lunes = inicio - ((diaDeLaSemana + 6) % 7) * UN_DIA_MS;
  return { inicio: lunes, fin: lunes + 7 * UN_DIA_MS };
}

/**
 * Periodo de misión al que pertenece un instante. Diarias y semanales son de calendario en Tepic (periodoDeCalendario);
 * «inicio» es la semana de bienvenida, los primeros 7 días desde el primer inicio de sesión (RF-GAM-103, 106). null si el
 * instante es anterior al ancla, o si es «inicio» y ya pasó la semana (RN-GAM-41).
 * `existentes`: periodos que la persona ya tiene de esa periodicidad. Uno que contiene el instante se respeta tal cual
 * (así las misiones en curso de antes del cambio terminan su periodo), y uno nuevo empieza donde terminó el anterior si
 * este se metía en el día o la semana de calendario: nunca se encimen dos periodos.
 */
export function periodoEn(ancla: number, instante: number, periodicidad: Periodicidad, existentes: readonly Periodo[] = []): Periodo | null {
  if (instante < ancla) return null;
  if (periodicidad === "inicio") {
    const duracion = DURACION_MS.inicio;
    return instante < ancla + duracion ? { inicio: ancla, fin: ancla + duracion } : null;
  }
  const vigente = existentes.find((p) => p.inicio <= instante && instante < p.fin);
  if (vigente) return { inicio: vigente.inicio, fin: vigente.fin };
  const calendario = periodoDeCalendario(instante, periodicidad);
  const inicio = Math.max(calendario.inicio, ...existentes.filter((p) => p.fin > calendario.inicio && p.fin <= instante).map((p) => p.fin));
  return { inicio, fin: calendario.fin };
}

export type AporteParaMision = {
  tipo: string;
  aceptado: boolean;
  enviadoEn: number;
  /** YYYY-MM-DD en la zona de las campañas. */
  dia: string;
  campanaId: number;
  tematica: string;
  cuota: number;
  estrellas: number | null;
  caracteres: number;
  deInteres: boolean;
  /** La campaña era especial cuando se envió. */
  especial: boolean;
};

export type DatosParaMisiones = {
  /** Todos los aportes de la persona, sin anónimos. */
  aportes: AporteParaMision[];
  /** Cuándo guardó cada campaña. */
  guardadas: number[];
  /** Cuándo se inscribió en cada campaña. */
  inscripciones: number[];
};

const enPeriodo = (instante: number, p: Periodo) => instante >= p.inicio && instante < p.fin;

/** Campañas cuya cuota se alcanzó con un aporte enviado en el periodo. */
function cuotasCompletadas(aportes: AporteParaMision[], periodo: Periodo): number {
  const porCampana = new Map<number, AporteParaMision[]>();
  for (const a of aportes) {
    if (a.aceptado) porCampana.set(a.campanaId, [...(porCampana.get(a.campanaId) ?? []), a]);
  }
  let cuantas = 0;
  for (const lista of porCampana.values()) {
    const ultimo = lista.sort((x, y) => x.enviadoEn - y.enviadoEn)[lista[0].cuota - 1];
    if (ultimo && enPeriodo(ultimo.enviadoEn, periodo)) cuantas++;
  }
  return cuantas;
}

function diasSeguidos(dias: string[]): number {
  const ordenados = [...new Set(dias)].sort();
  let mayor = 0;
  let tramo = 0;
  ordenados.forEach((dia, i) => {
    const siguiente = i > 0 ? new Date(Date.parse(`${ordenados[i - 1]}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : "";
    tramo = siguiente === dia ? tramo + 1 : 1;
    mayor = Math.max(mayor, tramo);
  });
  return mayor;
}

/**
 * Avance de una misión en su periodo. Los aportes cuentan por su fecha de envío (RF-GAM-41), así que un aporte aceptado
 * tarde suma al periodo en que se envió. El resultado nunca pasa del objetivo.
 */
export function avanceDeMision(condicion: CondicionDeMision, datos: DatosParaMisiones, periodo: Periodo): number {
  const { mide, objetivo, tipos, soloAceptados, minEstrellas, minCaracteres, soloDeInteres, soloEspeciales } = condicion;
  const validos = datos.aportes.filter(
    (a) =>
      (!soloAceptados || a.aceptado) &&
      (!tipos || tipos.includes(a.tipo)) &&
      (!minEstrellas || (a.estrellas ?? 0) >= minEstrellas) &&
      (!minCaracteres || a.caracteres >= minCaracteres) &&
      (!soloDeInteres || a.deInteres) &&
      (!soloEspeciales || a.especial),
  );
  const delPeriodo = validos.filter((a) => enPeriodo(a.enviadoEn, periodo));

  let avance = 0;
  if (mide === "aportes") avance = delPeriodo.length;
  if (mide === "tipos_distintos") avance = new Set(delPeriodo.map((a) => a.tipo)).size;
  if (mide === "dias_distintos") avance = new Set(delPeriodo.map((a) => a.dia)).size;
  if (mide === "dias_seguidos") avance = diasSeguidos(delPeriodo.map((a) => a.dia));
  if (mide === "campanas_distintas") avance = new Set(delPeriodo.map((a) => a.campanaId)).size;
  if (mide === "tematicas_distintas") avance = new Set(delPeriodo.map((a) => a.tematica)).size;
  if (mide === "campanas_guardadas") avance = datos.guardadas.filter((g) => enPeriodo(g, periodo)).length;
  if (mide === "inscripciones") avance = datos.inscripciones.filter((i) => enPeriodo(i, periodo)).length;
  if (mide === "cuotas_completadas") avance = cuotasCompletadas(datos.aportes, periodo);
  if (mide === "campanas_nuevas") {
    const anteriores = new Set(validos.filter((a) => a.enviadoEn < periodo.inicio).map((a) => a.campanaId));
    avance = new Set(delPeriodo.map((a) => a.campanaId).filter((c) => !anteriores.has(c))).size;
  }
  if (mide === "tematicas_nuevas") {
    const anteriores = new Set(validos.filter((a) => a.enviadoEn < periodo.inicio).map((a) => a.tematica));
    avance = new Set(delPeriodo.map((a) => a.tematica).filter((t) => !anteriores.has(t))).size;
  }
  return Math.min(avance, objetivo);
}

/** Las tablas guardan «sin recompensa» como {}. */
export function recompensaDesde(valor: unknown): RecompensaDeMision {
  const r = valor as { tipo?: string; cantidad?: number } | null;
  if (r?.tipo === "exp" && typeof r.cantidad === "number") return { tipo: "exp", cantidad: r.cantidad };
  if (r?.tipo === "potenciador" || r?.tipo === "protector" || r?.tipo === "sorteo") return { tipo: r.tipo };
  return null;
}

/** «15 EXP», «1 protector», «1 potenciador o 1 protector»; null sin recompensa. */
export function textoDeRecompensa(recompensa: RecompensaDeMision): string | null {
  if (!recompensa) return null;
  if (recompensa.tipo === "exp") return `${recompensa.cantidad} EXP`;
  if (recompensa.tipo === "sorteo") return "1 potenciador o 1 protector";
  return `1 ${recompensa.tipo}`;
}

/** Tipo para el ícono de la tarjeta; null sin recompensa. */
export function tipoDeRecompensa(recompensa: RecompensaDeMision): "exp" | ObjetoDeMision | null {
  return recompensa && recompensa.tipo !== "sorteo" ? recompensa.tipo : null;
}

/** Semilla del sorteo de una instancia: persona, misión y periodo. La misma al asignarla y al completarla. */
export function semillaDelObjeto(usuarioId: number | string, clave: string, inicioDelPeriodo: number): string {
  return `${usuarioId}:${clave}:${Math.round(inicioDelPeriodo)}`;
}

/**
 * Objeto de una misión difícil. Repetible con la misma semilla (persona, misión y periodo): un reintento no lo cambia.
 * Con los pesos de misiones.json (1 y 1) es 50/50.
 */
export function sortearObjeto(semilla: string, pesos: Record<ObjetoDeMision, number>): ObjetoDeMision {
  const total = OBJETOS_DE_MISION.reduce((suma, o) => suma + pesos[o], 0);
  let punto = (hash(semilla) / 0x1_0000_0000) * total;
  for (const objeto of OBJETOS_DE_MISION) {
    punto -= pesos[objeto];
    if (punto < 0) return objeto;
  }
  return OBJETOS_DE_MISION[OBJETOS_DE_MISION.length - 1];
}

// ---------------------------------------------------------------------------------------------------
// Selección aleatoria de cada periodo.
// ---------------------------------------------------------------------------------------------------

export type MisionParaElegir = { clave: string; grupo: string | null; condicion: CondicionDeMision; dificultad?: Dificultad };

/** Lo que hay en la app ahora, para no pedir algo imposible. */
export type ContextoDeSeleccion = {
  tiposDisponibles: ReadonlySet<string>;
  hayCampanasDeInteres: boolean;
  hayCampanasEspeciales: boolean;
};

export function misionPosible(c: CondicionDeMision, contexto: ContextoDeSeleccion): boolean {
  const usaAportes = !["campanas_guardadas", "inscripciones"].includes(c.mide);
  const tipos = c.tipos?.filter((t) => contexto.tiposDisponibles.has(t)) ?? [...contexto.tiposDisponibles];
  if (contexto.tiposDisponibles.size === 0) return false;
  if (usaAportes && tipos.length === 0) return false;
  if (c.mide === "tipos_distintos" && tipos.length < c.objetivo) return false;
  if (c.soloDeInteres && !contexto.hayCampanasDeInteres) return false;
  return !c.soloEspeciales || contexto.hayCampanasEspeciales;
}

/** FNV-1a: el mismo texto da siempre el mismo número. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Elige las misiones de un periodo. Es aleatorio para cada persona y periodo, pero repetible: la semilla decide, así un
 * reintento no cambia el resultado. Evita lo del periodo anterior y prefiere un grupo distinto para cada misión; si no
 * alcanza, completa con lo que quede. Nunca pasa de `maximoDificiles` misiones difíciles (RF-GAM-44, CA-GAM-112).
 */
export function elegirMisiones<T extends MisionParaElegir>(
  misiones: T[],
  entrada: { semilla: string; cuantas: number; contexto: ContextoDeSeleccion; anteriores: ReadonlySet<string>; maximoDificiles?: number },
): T[] {
  const { semilla, cuantas, contexto, anteriores, maximoDificiles = Infinity } = entrada;
  const barajadas = misiones
    .filter((m) => misionPosible(m.condicion, contexto))
    .map((mision) => ({ mision, orden: hash(`${semilla}:${mision.clave}`) }))
    .sort((a, b) => Number(anteriores.has(a.mision.clave)) - Number(anteriores.has(b.mision.clave)) || a.orden - b.orden)
    .map((x) => x.mision);

  const elegidas: T[] = [];
  const grupos = new Set<string>();
  const cabe = (m: T) => m.dificultad !== "dificil" || elegidas.filter((e) => e.dificultad === "dificil").length < maximoDificiles;
  for (const m of barajadas) {
    if (elegidas.length === cuantas) break;
    if ((m.grupo && grupos.has(m.grupo)) || !cabe(m)) continue;
    elegidas.push(m);
    if (m.grupo) grupos.add(m.grupo);
  }
  for (const m of barajadas) {
    if (elegidas.length === cuantas) break;
    if (!elegidas.includes(m) && cabe(m)) elegidas.push(m);
  }
  return elegidas;
}
