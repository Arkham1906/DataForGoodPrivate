// Color de las barras de avance.

export type FondoDeLaBarra = "claro" | "oscuro";

const PALETAS = {
  claro: ["var(--color-avance-1)", "var(--color-avance-2)", "var(--color-avance-3)", "var(--color-success-700)"],
  oscuro: ["var(--color-avance-claro-1)", "var(--color-avance-claro-2)", "var(--color-avance-claro-3)", "var(--color-success-300)"],
} as const;

function fraccionValida(fraccion: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(fraccion) ? fraccion : 0));
}

export function colorDeAvance(fraccion: number, fondo: FondoDeLaBarra = "claro"): string {
  const [inicio, medio, final, completo] = PALETAS[fondo];
  const t = fraccionValida(fraccion);
  if (t >= 1) return completo;
  if (t <= 0) return inicio;
  if (t <= 0.5) return `color-mix(in oklch, ${medio} ${Math.round(t * 200)}%, ${inicio})`;
  return `color-mix(in oklch, ${final} ${Math.round((t - 0.5) * 200)}%, ${medio})`;
}

export function fondoDeAvance(fraccion: number, fondo: FondoDeLaBarra = "claro"): string {
  const t = fraccionValida(fraccion);
  if (t >= 1) return colorDeAvance(1, fondo);
  return `linear-gradient(90deg, ${PALETAS[fondo][0]}, ${colorDeAvance(t, fondo)})`;
}
