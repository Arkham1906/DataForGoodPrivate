// Avance de una campaña hacia su meta. Sin imports de servidor: lo usan pantallas cliente y del panel.
// Decisión del usuario (2026-10-20): la meta cuenta solo los aportes aprobados; los pendientes y
// rechazados no la llenan. Antes casi todas las pantallas usaban los recibidos y el cierre del panel
// del creador los aprobados. Ninguna regla del servidor depende de la meta: solo se muestra.

/** Porcentaje entero de 0 a 100 (no pasa de 100 aunque haya más aprobados que la meta). */
export function porcentajeDeMeta(aprobados: number, meta: number): number {
  if (meta <= 0) return 0;
  return Math.min(100, Math.round((aprobados / meta) * 100));
}

/**
 * Pronóstico del panel del creador: al ritmo de aprobados por día desde el inicio, ¿se llega a la
 * meta antes del cierre? "sin_datos" cuando no hay con qué calcularlo (sin meta, sin días
 * transcurridos o sin ningún aprobado todavía).
 */
export function pronosticoDeMeta(c: {
  aprobados: number;
  meta: number;
  diasTranscurridos: number;
  diasRestantes: number;
}): "alcanzada" | "a_tiempo" | "no_alcanza" | "sin_datos" {
  if (c.meta <= 0) return "sin_datos";
  if (c.aprobados >= c.meta) return "alcanzada";
  if (c.diasTranscurridos <= 0 || c.aprobados === 0) return "sin_datos";
  const ritmo = c.aprobados / c.diasTranscurridos;
  return c.aprobados + ritmo * c.diasRestantes >= c.meta ? "a_tiempo" : "no_alcanza";
}
