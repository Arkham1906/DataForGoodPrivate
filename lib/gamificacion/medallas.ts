// Medallas cerca de subir (2026-11-04; SRS v1.2: RF-GAM-46 a 49, tabla 4.4). Lógica pura que usa
// lib/gamificacion/mi-progreso.ts; sin imports de servidor. Los umbrales NO se escriben aquí: salen de
// medalla_niveles (RNF-GAM-05). Esto solo elige qué medallas mostrar: no concede niveles (RNF-GAM-06).

/** Texto de lo que mide cada medalla (columna `medallas.mide`, tabla 4.4). */
const QUE_MIDE: Record<string, string> = {
  aportes_aceptados: "Mide tus aportes aceptados.",
  aportes_excepcionales: "Mide tus aportes de 5★ (Excepcionales).",
  racha_maxima: "Mide tu racha máxima, en días.",
  campanas_completadas: "Mide las campañas en las que completaste tu cuota.",
  campanas_distintas: "Mide las campañas distintas con un aporte tuyo aceptado.",
  exp_total: "Mide tu EXP total.",
  tipos_distintos: "Mide los tipos de dato con un aporte tuyo aceptado.",
  rachas_recuperadas: "Mide las rachas de 7 días o más que recuperaste tras perderlas.",
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
