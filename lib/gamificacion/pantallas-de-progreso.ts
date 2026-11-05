// Pantallas de «Mi progreso» (2026-11-04; diseño v10): las seis pestañas y, en un solo lugar, cuáles ya existen.
// Mientras una pantalla no exista su `href` es null: la pestaña se ve deshabilitada y ningún enlace del Resumen
// apunta a ella (se ocultan «Ver tu trayectoria», «Ver tu historial de EXP» y «Ver tus medallas»). Al construir
// una pantalla, basta con poner aquí su ruta. Sin imports de servidor.

export type PantallaDeProgreso = "resumen" | "trayectoria" | "misiones" | "medallas" | "avatar" | "historial";

export const PANTALLAS_DE_PROGRESO: readonly { clave: PantallaDeProgreso; etiqueta: string; href: string | null }[] = [
  { clave: "resumen", etiqueta: "Resumen", href: "/progreso" },
  { clave: "trayectoria", etiqueta: "Trayectoria", href: null },
  { clave: "misiones", etiqueta: "Misiones", href: "/progreso/misiones" },
  { clave: "medallas", etiqueta: "Medallas", href: null },
  { clave: "avatar", etiqueta: "Avatar e inventario", href: null },
  { clave: "historial", etiqueta: "Historial de EXP", href: null },
];

export function rutaDePantalla(clave: PantallaDeProgreso): string | null {
  return PANTALLAS_DE_PROGRESO.find((p) => p.clave === clave)?.href ?? null;
}
