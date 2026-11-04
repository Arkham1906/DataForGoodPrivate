// Calificación que quien revisa asigna al aporte al tomar una decisión (obligatoria al aceptar y al
// rechazar). Desde el 2026-10-31 (a pedido del usuario) es un rating de 1 a 5 estrellas, guardado como
// SMALLINT en aportes.calificacion; antes eran tres textos, que se pasaron así: bien → 3,
// muy_bueno → 4, excelente → 5 (ensureAportesTable). Sin imports de servidor.

export const ESTRELLAS_MAXIMAS = 5;

export type CalificacionDeAporte = 1 | 2 | 3 | 4 | 5;

/** Nombre de cada número de estrellas (SRS v1.2, RF-GAM-99 y RA-GAM-25): solo de interfaz; los datos usan el número. */
export const NOMBRES_DE_ESTRELLAS: Record<CalificacionDeAporte, string> = {
  1: "Suficiente",
  2: "Bueno",
  3: "Muy bueno",
  4: "Sobresaliente",
  5: "Excepcional",
};

export function esCalificacion(valor: unknown): valor is CalificacionDeAporte {
  return Number.isInteger(valor) && Number(valor) >= 1 && Number(valor) <= ESTRELLAS_MAXIMAS;
}

/** La calificación de una fila o del body (número o texto "4"); null si no hay o no es válida. */
export function calificacionDesde(valor: unknown): CalificacionDeAporte | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return esCalificacion(n) ? n : null;
}

/** "4 de 5 estrellas (Sobresaliente)", o null sin calificación. */
export function textoDeCalificacion(valor: unknown): string | null {
  const n = calificacionDesde(valor);
  if (n === null) return null;
  return `${n} de ${ESTRELLAS_MAXIMAS} ${n === 1 ? "estrella" : "estrellas"} (${NOMBRES_DE_ESTRELLAS[n]})`;
}
