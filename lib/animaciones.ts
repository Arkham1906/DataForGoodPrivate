// Ayudantes de las animaciones de entrada de las páginas públicas (landing,
// /explorar, /datos, /entrar, y desde el 2026-11-03 las que usan EncabezadoPublico). Las clases viven en app/globals.css y solo se
// animan con prefers-reduced-motion: no-preference. Sin imports de servidor:
// lo usan también componentes cliente.

import type { CSSProperties } from "react";

/** Retraso de `.landing-entrada`, para escalonar elementos. */
export function retraso(ms: number): CSSProperties {
  return { "--retraso": `${ms}ms` } as CSSProperties;
}

/** Tarjetas que ya se ven al cargar: entran en cascada tras el encabezado. */
const TARJETAS_CON_ENTRADA = 6;

/**
 * Props del enlace que envuelve cada tarjeta de un listado: las primeras
 * entran escalonadas al cargar y las demás aparecen al llegar con el scroll.
 */
export function entradaDeTarjeta(indice: number): { className: string; style?: CSSProperties } {
  if (indice < TARJETAS_CON_ENTRADA) {
    return { className: "landing-entrada block rounded-lg", style: retraso(400 + indice * 70) };
  }
  return { className: "landing-revelar block rounded-lg" };
}
