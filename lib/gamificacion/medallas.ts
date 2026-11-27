// Reglas de las medallas (2026-11-04; SRS v1.3: RF-GAM-46 a 49, tabla 4.4). Lógica pura que usan
// lib/gamificacion/mi-progreso.ts (medallas cerca de subir) y lib/gamificacion/evaluacion.ts (qué nivel toca);
// sin imports de servidor. Los umbrales NO se escriben aquí: salen de medalla_niveles (RNF-GAM-05). Conceder un
// nivel lo hace solo el servidor, en evaluacion.ts (RNF-GAM-06).

/** Días que debía tener la racha perdida para que reavivarla cuente en Fénix (decisión del 2026-11-09: cualquiera). */
export const RACHA_PERDIDA_MINIMA_PARA_FENIX = 1;

/**
 * Lo que puede medir una medalla de lib/datos/medallas.json (campo `mide`). Cada una tiene su cálculo en
 * valoresDeMedallas() (evaluacion.ts): una medalla nueva con una de estas se agrega solo en el JSON; una medida
 * nueva necesita su cálculo allí y su entrada aquí.
 */
export const MEDIDAS_DE_MEDALLA = [
  "aportes_aceptados",
  "aportes_excepcionales",
  "racha_maxima",
  "campanas_completadas",
  "campanas_distintas",
  "exp_total",
  "tipos_distintos",
  "aceptados_consecutivos",
  "rachas_recuperadas",
  "aportes_en_potenciador",
  "tematicas_distintas",
  // Logros de enfoque (RF-GAM-118, decisiones del 26 nov): solo cuentan los aportes enviados con el enfoque del logro
  // (campo `enfoque` del catálogo). logros_de_enfoque: cuántos logros de enfoque tienen al menos el nivel 1.
  "multimedia_en_su_enfoque",
  "textos_descritos_en_su_enfoque",
  "campanas_pioneras_en_su_enfoque",
  "logros_de_enfoque",
] as const;
export type MedidaDeMedalla = (typeof MEDIDAS_DE_MEDALLA)[number];

/** Secciones de la pantalla de medallas (diseño v10): de hitos, adicionales y, desde el 26 nov, de enfoque. */
export const GRUPOS_DE_MEDALLA = ["hitos", "adicionales", "enfoque"] as const;
export type GrupoDeMedalla = (typeof GRUPOS_DE_MEDALLA)[number];

/** Texto de lo que mide cada medalla (columna `medallas.mide`, tabla 4.4). */
const QUE_MIDE: Record<string, string> = {
  aportes_aceptados: "Crece con cada aporte que te aceptan.",
  aportes_excepcionales: "Crece con cada aporte que recibe 5 estrellas.",
  racha_maxima: "Crece con tu racha más larga.",
  campanas_completadas: "Crece cada vez que completas la meta de aportes de una campaña.",
  campanas_distintas: "Crece con cada campaña nueva en la que te aceptan un aporte.",
  exp_total: "Crece con toda la EXP que ganas.",
  tipos_distintos: "Crece con cada tipo de dato distinto que te aceptan: texto, foto, documento, audio o video.",
  rachas_recuperadas: "Crece cada vez que vuelves a empezar una racha después de perderla.",
  aceptados_consecutivos: "Crece con tu mejor serie de aportes aceptados sin un rechazo en medio.",
  aportes_en_potenciador: "Crece con los aportes aceptados que envías durante un mismo potenciador.",
  tematicas_distintas: "Crece con cada temática distinta en la que te aceptan un aporte.",
  multimedia_en_su_enfoque: "Crece con cada foto, video o audio que te aceptan. Solo cuenta lo que envías con el enfoque DataTracker.",
  textos_descritos_en_su_enfoque:
    "Crece con cada texto o documento que te aceptan con una descripción de 120 caracteres o más. Solo cuenta lo que envías con el enfoque DataCollector.",
  campanas_pioneras_en_su_enfoque:
    "Crece cada vez que tu aporte queda entre los 10 primeros aceptados de una campaña. Solo cuenta lo que envías con el enfoque DataExplorer.",
  logros_de_enfoque: "Se consigue al llegar al primer nivel de los tres logros de enfoque.",
};

/** Lo que decide si un logro se muestra: los de enfoque están ocultos hasta que la persona elige ese enfoque. */
export type VisibilidadDeMedalla = { grupo: string | null; enfoque: string | null };

/**
 * Logros de enfoque (decisiones del 26 nov, «easter egg»): el de un enfoque aparece cuando la persona lo elige por
 * primera vez; uno de grupo «enfoque» sin enfoque propio (Tres Caminos) aparece cuando ya eligió todos los enfoques que
 * tienen logro. Los demás se ven siempre. `elegidos`: enfoques que la persona ha tenido alguna vez.
 */
export function medallaVisible(m: VisibilidadDeMedalla, elegidos: ReadonlySet<string>, enfoquesConLogro: ReadonlySet<string>): boolean {
  if (m.enfoque) return elegidos.has(m.enfoque);
  if (m.grupo === "enfoque") return enfoquesConLogro.size > 0 && [...enfoquesConLogro].every((e) => elegidos.has(e));
  return true;
}

/** `ilustracion`: archivo de la ilustración cuando no sigue «<nivel>-<nombre>» (medalla_niveles.ilustracion_path). */
export type NivelDeMedalla = { nivel: number; nombre: string; umbral: number; ilustracion?: string | null };

export type MedallaConAvance = {
  clave: string;
  nombre: string;
  mide: string | null;
  nivelActual: number;
  valor: number;
  niveles: NivelDeMedalla[];
};

export type MedallaCercaDeSubir = {
  clave: string;
  nombre: string;
  nivelActual: string | null;
  nivelSiguiente: string;
  valor: number;
  umbral: number;
  porcentaje: number;
  queMide: string;
  /** Medida del catálogo (campo `mide`), para decir en qué unidad falta: «Faltan 2 aportes aceptados». */
  mide: string | null;
  imagen: { nivel: number; nombre: string; ilustracion: string | null };
  bloqueada: boolean;
};

/** Texto de lo que mide una medalla («Mide tus aportes aceptados.»); cadena vacía si la medida no tiene texto. */
export function queMideMedalla(mide: string | null): string {
  return (mide && QUE_MIDE[mide]) || "";
}

/**
 * Nivel que se muestra: el registrado (no baja, RF-GAM-47) o uno mayor si el valor de hoy ya pasó su umbral y la
 * evaluación aún no lo registra (evaluacion.ts lo concede en el siguiente evento). Misma regla que medallasMasCercanas.
 */
export function nivelVisible(m: Pick<MedallaConAvance, "nivelActual" | "valor" | "niveles">): number {
  return Math.max(m.nivelActual, nivelPorValor(m.valor, m.niveles));
}

/** El nivel más alto cuyo umbral ya alcanza `valor`; 0 si ninguno. */
export function nivelPorValor(valor: number, niveles: readonly NivelDeMedalla[]): number {
  return niveles.reduce((mayor, n) => (valor >= n.umbral && n.nivel > mayor ? n.nivel : mayor), 0);
}

/**
 * Pulso Firme: la secuencia más larga de aportes aceptados seguidos sin un rechazo entre ellos. `decisiones` va
 * en orden de envío; un pendiente no entra (aún no tiene decisión). Se recalcula entera cada vez, así una decisión
 * tardía o fuera de orden queda en su lugar; el nivel ya alcanzado no se retira aunque la cifra baje (RF-GAM-47).
 */
export function mayorSecuenciaSinRechazo(decisiones: readonly ("aceptado" | "rechazado")[]): number {
  let mayor = 0;
  let actual = 0;
  for (const d of decisiones) {
    actual = d === "aceptado" ? actual + 1 : 0;
    mayor = Math.max(mayor, actual);
  }
  return mayor;
}

/**
 * Las medallas con menos camino por recorrer: mayor porcentaje hacia su siguiente nivel y, a igual porcentaje,
 * lo que falte en menos unidades. Las que ya están en su último nivel no entran: no tienen a dónde subir.
 */
export function medallasMasCercanas(medallas: MedallaConAvance[], limite: number): MedallaCercaDeSubir[] {
  const candidatas: MedallaCercaDeSubir[] = [];
  for (const m of medallas) {
    // El valor ya superó un umbral aunque su nivel aún no se haya registrado: se mira el nivel que sigue a ese.
    const nivel = nivelVisible(m);
    const siguiente = m.niveles.find((n) => n.nivel > nivel);
    if (!siguiente) continue;
    const valor = m.valor;
    const nivelDeImagen = m.niveles.find((n) => n.nivel === nivel) ?? m.niveles[0];
    candidatas.push({
      clave: m.clave,
      nombre: m.nombre,
      nivelActual: m.niveles.find((n) => n.nivel === nivel)?.nombre ?? null,
      nivelSiguiente: siguiente.nombre,
      valor,
      umbral: siguiente.umbral,
      porcentaje: Math.round((valor / siguiente.umbral) * 100),
      queMide: queMideMedalla(m.mide),
      mide: m.mide,
      imagen: { nivel: nivelDeImagen.nivel, nombre: nivelDeImagen.nombre, ilustracion: nivelDeImagen.ilustracion ?? null },
      bloqueada: nivel === 0,
    });
  }
  // sort es estable: a igualdad queda el orden en que llegan (el del catálogo).
  candidatas.sort((a, b) => b.porcentaje - a.porcentaje || a.umbral - a.valor - (b.umbral - b.valor));
  return candidatas.slice(0, limite);
}

// ---- Pestaña Medallas de Mi progreso (2026-11-15; lienzo aprobado el mismo día) ----

export type NivelEnPantalla = NivelDeMedalla & {
  /** ISO de medalla_ascensos; null si no se ha alcanzado o si el valor lo alcanzó y aún no se registra. */
  alcanzadoEn: string | null;
};

export type MedallaEnPantalla = {
  clave: string;
  nombre: string;
  grupo: GrupoDeMedalla;
  mide: string | null;
  queMide: string;
  valor: number;
  nivel: number;
  niveles: NivelEnPantalla[];
};

export type PantallaDeMedallas = {
  medallas: MedallaEnPantalla[];
  cerca: MedallaCercaDeSubir[];
};
