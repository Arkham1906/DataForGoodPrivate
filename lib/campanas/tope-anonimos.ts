// Tope de aportes sin cuenta de una campaña. Sin imports de servidor: lo usan la API, el envío anónimo y el
// campo del creador en Compartir y en /mis-campanas/[id].
//
// Reglas (decisiones del usuario):
// - 2026-11-10: el 10% de la meta, redondeado hacia abajo. No limita los aportes con cuenta.
// - 2026-11-13: el creador escribía cuántos aceptaba (un número entero desde 1, sin tope); vacío = el 10%.
// - 2026-11-24: el creador elige un PORCENTAJE de la meta (campanas.porcentaje_anonimos), un entero de 1 a 100;
//   sin elegir (NULL) vale el 10%. El número de aportes se calcula de la meta, hacia abajo, y sigue a la meta si
//   esta cambia. Los números que ya había se pasaron a su porcentaje al arrancar (lib/db-schema.ts).
// Esta es la única copia de la regla.

/** El porcentaje que vale si el creador no elige otro. */
export const PORCENTAJE_ANONIMOS_POR_DEFECTO = 10;
export const PORCENTAJE_ANONIMOS_MINIMO = 1;
export const PORCENTAJE_ANONIMOS_MAXIMO = 100;

/** El porcentaje que se aplica: el que eligió el creador o, sin él, el 10%. */
export function porcentajeDeAnonimos(elegido: number | null | undefined): number {
  return elegido == null ? PORCENTAJE_ANONIMOS_POR_DEFECTO : elegido;
}

/**
 * Cuántos aportes sin cuenta acepta la campaña: el porcentaje de la meta, hacia abajo
 * (meta 50 al 10% → 5; meta 9 al 10% → 0; meta 9 al 20% → 1).
 */
export function limiteDeAportesAnonimos(meta: number, elegido: number | null | undefined): number {
  const porcentaje = porcentajeDeAnonimos(elegido);
  // Entero por entero para no arrastrar errores de punto flotante (p. ej. 0.07 * 100).
  return Math.max(0, Math.floor((Math.max(0, meta) * porcentaje) / 100));
}

/** Por qué no sirve el porcentaje que mandó el creador, o null si sirve. `null` (volver al 10%) siempre sirve. */
export function problemaDelPorcentajeElegido(elegido: unknown): string | null {
  if (elegido === null) return null;
  if (
    typeof elegido !== "number" ||
    !Number.isInteger(elegido) ||
    elegido < PORCENTAJE_ANONIMOS_MINIMO ||
    elegido > PORCENTAJE_ANONIMOS_MAXIMO
  ) {
    return `Escribe un porcentaje entero del ${PORCENTAJE_ANONIMOS_MINIMO} al ${PORCENTAJE_ANONIMOS_MAXIMO}, o déjalo vacío para usar el ${PORCENTAJE_ANONIMOS_POR_DEFECTO}%.`;
  }
  return null;
}
