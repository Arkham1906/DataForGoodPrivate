// ¿El aporte ya tiene decisión? Regla única (dominio.md § 5): la decisión (aceptado o rechazado) ya no
// se cambia, la haya tomado el creador o el revisor, y el aporte ya no se edita, no se marca inapropiado
// ni se borra su archivo. (Quien aportó sí puede borrar uno rechazado; banear se puede siempre.)
// Sin imports de servidor: lo usan route handlers, lib/aportes/sanciones-anonimas.ts y las pantallas cliente.

/**
 * Estados de un aporte que aún espera decisión. espera_final viene de la revisión en dos
 * instancias que se quitó el 2026-10-06: si queda alguno, se decide como un pendiente.
 */
export const ESTADOS_SIN_DECISION = ["pendiente", "espera_final"];

/** true si el aporte ya está aceptado o rechazado. */
export function tieneDecision(status: string): boolean {
  return !ESTADOS_SIN_DECISION.includes(status);
}
