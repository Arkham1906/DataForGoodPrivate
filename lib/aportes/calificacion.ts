/** Calificación que quien revisa asigna al aporte al tomar una decisión. */
export const CALIFICACIONES_DE_APORTE = [
  { valor: "bien", etiqueta: "Bien" },
  { valor: "muy_bueno", etiqueta: "Muy bueno" },
  { valor: "excelente", etiqueta: "Excelente" },
] as const;

export type CalificacionDeAporte = (typeof CALIFICACIONES_DE_APORTE)[number]["valor"];

export function etiquetaDeCalificacion(valor: string | null | undefined): string | null {
  return CALIFICACIONES_DE_APORTE.find((calificacion) => calificacion.valor === valor)?.etiqueta ?? null;
}
