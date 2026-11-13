// Texto breve para indicar cuánto falta para el cierre de una campaña.
export function etiquetaDeCierre(diasRestantes: number | null): string {
  if (diasRestantes === null) return "Sin fecha de cierre";
  if (diasRestantes === 0) return "Cierra hoy";
  return diasRestantes === 1 ? "Queda 1 día" : `Quedan ${diasRestantes} días`;
}
