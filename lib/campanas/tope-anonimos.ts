// Tope de aportes sin cuenta de una campaña. Sin imports de servidor: lo usan la API, el envío anónimo y el
// campo del creador en Compartir y en /mis-campanas/[id].
//
// Reglas (decisiones del usuario):
// - 2026-11-10: el 10% de la meta, redondeado hacia abajo. No limita los aportes con cuenta.
// - 2026-11-13: el creador escribe cuántos acepta (campanas.limite_anonimos), un número entero desde 1, sin
//   tope superior (ese mismo día se probó "de 1 al 10%" y el usuario lo cambió). Si no escribe nada (NULL),
//   vale el 10% de la meta, que sigue a la meta si esta cambia.
// Esta es la única copia de la regla.

const PORCENTAJE_POR_DEFECTO = 0.1;
/** Lo más que cabe en la columna INTEGER; nadie lo escribe a mano, pero así no truena el UPDATE. */
const MAXIMO_TECNICO = 2_147_483_647;

/** Lo que vale sin número del creador: el 10% de la meta, hacia abajo (meta 50 → 5; meta 9 → 0). */
export function anonimosPorDefecto(meta: number): number {
  return Math.max(0, Math.floor(meta * PORCENTAJE_POR_DEFECTO));
}

/** El tope que se aplica: el número que eligió el creador o, sin él, el 10% de la meta. */
export function limiteDeAportesAnonimos(meta: number, elegido: number | null | undefined): number {
  return elegido == null ? anonimosPorDefecto(meta) : Math.max(0, elegido);
}

/** Por qué no sirve el número que mandó el creador, o null si sirve. `null` (volver al 10%) siempre sirve. */
export function problemaDelLimiteElegido(elegido: unknown): string | null {
  if (elegido === null) return null;
  if (typeof elegido !== "number" || !Number.isInteger(elegido) || elegido < 1 || elegido > MAXIMO_TECNICO) {
    return "Escribe un número entero mayor que 0, o déjalo vacío para usar el 10% de la meta.";
  }
  return null;
}
