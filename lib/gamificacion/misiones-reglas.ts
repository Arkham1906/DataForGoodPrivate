// Reglas de las misiones (2026-11-04; SRS v1.3: RF-GAM-40 a 45). Lógica pura, sin base de datos ni reloj propio:
// tipos del catálogo, periodo de cada cuenta y avance de una misión. La usan el servidor y los componentes.

export type Periodicidad = "diaria" | "semanal";

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

/**
 * Opcional: las recompensas se definen después. Una misión sin recompensa se completa y cuenta para los rangos.
 * Solo EXP por ahora: los potenciadores dependen de DA-GAM-13 y los protectores aún no existen.
 */
export type RecompensaDeMision = { tipo: "exp"; cantidad: number } | null;

export const DURACION_MS: Record<Periodicidad, number> = { diaria: 86_400_000, semanal: 604_800_000 };

export type Periodo = { inicio: number; fin: number };

/**
 * Bloques consecutivos de 24 horas o 7 días desde el primer inicio de sesión (propuesta de RF-GAM-41, DA-GAM-17).
 * null si el instante es anterior al ancla: ese aporte no pertenece a ningún periodo.
 */
export function periodoEn(ancla: number, instante: number, periodicidad: Periodicidad): Periodo | null {
  if (instante < ancla) return null;
  const duracion = DURACION_MS[periodicidad];
  const inicio = ancla + Math.floor((instante - ancla) / duracion) * duracion;
  return { inicio, fin: inicio + duracion };
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
  return r?.tipo === "exp" && typeof r.cantidad === "number" ? { tipo: "exp", cantidad: r.cantidad } : null;
}

/** «15 EXP»; null sin recompensa. */
export function textoDeRecompensa(recompensa: RecompensaDeMision): string | null {
  return recompensa ? `${recompensa.cantidad} EXP` : null;
}

// ---------------------------------------------------------------------------------------------------
// Selección aleatoria de cada periodo.
// ---------------------------------------------------------------------------------------------------

export type MisionParaElegir = { clave: string; grupo: string | null; condicion: CondicionDeMision };

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
 * alcanza, completa con lo que quede.
 */
export function elegirMisiones<T extends MisionParaElegir>(
  misiones: T[],
  entrada: { semilla: string; cuantas: number; contexto: ContextoDeSeleccion; anteriores: ReadonlySet<string> },
): T[] {
  const { semilla, cuantas, contexto, anteriores } = entrada;
  const barajadas = misiones
    .filter((m) => misionPosible(m.condicion, contexto))
    .map((mision) => ({ mision, orden: hash(`${semilla}:${mision.clave}`) }))
    .sort((a, b) => Number(anteriores.has(a.mision.clave)) - Number(anteriores.has(b.mision.clave)) || a.orden - b.orden)
    .map((x) => x.mision);

  const elegidas: T[] = [];
  const grupos = new Set<string>();
  for (const m of barajadas) {
    if (elegidas.length === cuantas) break;
    if (m.grupo && grupos.has(m.grupo)) continue;
    elegidas.push(m);
    if (m.grupo) grupos.add(m.grupo);
  }
  for (const m of barajadas) {
    if (elegidas.length === cuantas) break;
    if (!elegidas.includes(m)) elegidas.push(m);
  }
  return elegidas;
}
