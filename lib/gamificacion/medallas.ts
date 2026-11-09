/** Días que debía tener la racha perdida para que reavivarla cuente en Fénix (decisión del 2026-11-09: cualquiera). */
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
] as const;
export type MedidaDeMedalla = (typeof MEDIDAS_DE_MEDALLA)[number];

/** Secciones de la pantalla de medallas (diseño v10): de hitos y adicionales. */
export const GRUPOS_DE_MEDALLA = ["hitos", "adicionales"] as const;
export type GrupoDeMedalla = (typeof GRUPOS_DE_MEDALLA)[number];

/** Texto de lo que mide cada medalla (columna `medallas.mide`, tabla 4.4). */
const QUE_MIDE: Record<string, string> = {
  aportes_aceptados: "Mide tus aportes aceptados.",
  aportes_excepcionales: "Mide tus aportes de 5★ (Excepcionales).",
  racha_maxima: "Mide tu racha máxima, en días.",
  campanas_completadas: "Mide las campañas en las que completaste tu cuota.",
  campanas_distintas: "Mide las campañas distintas con un aporte tuyo aceptado.",
  exp_total: "Mide tu EXP total.",
  tipos_distintos: "Mide los tipos de dato con un aporte tuyo aceptado.",
  rachas_recuperadas: "Mide las veces que reavivaste tu racha después de perderla.",
  aceptados_consecutivos: "Mide tus aportes aceptados seguidos, sin un rechazo entre ellos, por hora de envío.",
  aportes_en_potenciador: "Mide tus aportes aceptados enviados durante un solo potenciador.",
  tematicas_distintas: "Mide las temáticas distintas con un aporte tuyo aceptado.",
};

export type NivelDeMedalla = { nivel: number; nombre: string; umbral: number };

export type MedallaConAvance = {
  clave: string;
  nombre: string;
  mide: string | null;
  /** Último nivel registrado; 0 si no hay. Un nivel alcanzado no se retira (RF-GAM-47). */
  nivelActual: number;
  /** Lo que mide la medalla, hoy. */
  valor: number;
  /** En orden de nivel. */
  niveles: NivelDeMedalla[];
};

export type MedallaCercaDeSubir = {
  clave: string;
  nombre: string;
  /** Nombre del nivel actual; null si aún no tiene ninguno. */
  nivelActual: string | null;
  nivelSiguiente: string;
  valor: number;
  umbral: number;
  /** 0 a 100. */
  porcentaje: number;
  queMide: string;
};

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
    const nivel = Math.max(m.nivelActual, ...m.niveles.filter((n) => m.valor >= n.umbral).map((n) => n.nivel));
    const siguiente = m.niveles.find((n) => n.nivel > nivel);
    if (!siguiente) continue;
    const valor = m.valor;
    candidatas.push({
      clave: m.clave,
      nombre: m.nombre,
      nivelActual: m.niveles.find((n) => n.nivel === nivel)?.nombre ?? null,
      nivelSiguiente: siguiente.nombre,
      valor,
      umbral: siguiente.umbral,
      porcentaje: Math.round((valor / siguiente.umbral) * 100),
      queMide: (m.mide && QUE_MIDE[m.mide]) || "",
    });
  }
  // sort es estable: a igualdad queda el orden en que llegan (el del catálogo).
  candidatas.sort((a, b) => b.porcentaje - a.porcentaje || a.umbral - a.valor - (b.umbral - b.valor));
  return candidatas.slice(0, limite);
}
