// Pantallas de «Mi progreso», en el orden de sus pestañas. Mientras una pantalla no exista su `href` es null: la
// pestaña se ve deshabilitada y ningún enlace apunta a ella (p. ej. «Ver tus medallas»). Al construir una pantalla,
// basta con poner aquí su ruta. La primera es la de entrada. Sin imports de servidor.

export type PantallaDeProgreso = "resumen" | "trayectoria" | "misiones" | "medallas" | "avatar" | "historial" | "leaderboard";

export const PANTALLAS_DE_PROGRESO: readonly { clave: PantallaDeProgreso; etiqueta: string; href: string | null }[] = [
  { clave: "resumen", etiqueta: "Resumen", href: "/progreso" },
  { clave: "avatar", etiqueta: "Avatar", href: null },
  { clave: "trayectoria", etiqueta: "Rangos", href: "/progreso/trayectoria" },
  { clave: "medallas", etiqueta: "Logros", href: "/progreso/medallas" },
  { clave: "misiones", etiqueta: "Misiones", href: "/progreso/misiones" },
  { clave: "historial", etiqueta: "Historial de EXP", href: "/progreso/historial" },
  { clave: "leaderboard", etiqueta: "Clasificación global", href: "/progreso/leaderboard" },
];

export function rutaDePantalla(clave: PantallaDeProgreso): string | null {
  return PANTALLAS_DE_PROGRESO.find((p) => p.clave === clave)?.href ?? null;
}
