// En qué municipio cae un punto (2026-10-31, a pedido del usuario: filtrar campañas y avisar al cambiar de
// zona según la ubicación real). Sin servicios de terceros: los límites municipales de INEGI (Marco
// Geoestadístico) se descargaron una vez y se simplificaron a ~200 m en lib/datos/limites-municipales.json
// (2478 municipios, ~4 MB; nombres como en lib/mexico-geo.ts). Las coordenadas que manda el navegador solo
// se usan aquí para saber la zona: no se guardan ni salen del servidor.
// Solo servidor (el JSON es grande, no lo importes en un componente cliente): lo usa POST /api/ubicacion.

import limites from "@/lib/datos/limites-municipales.json";

export type Zona = { estado: string; municipio: string };

type Municipio = { e: string; m: string; b: number[]; p: number[][][] };

const MUNICIPIOS = (limites as { municipios: Municipio[] }).municipios;

/** Regla par-impar sobre un anillo plano [x0, y0, x1, y1, ...]. */
function dentroDelAnillo(x: number, y: number, anillo: number[]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 2; i < anillo.length; j = i, i += 2) {
    const xi = anillo[i], yi = anillo[i + 1], xj = anillo[j], yj = anillo[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Dentro de un polígono: en su contorno y fuera de sus huecos. */
function dentroDelPoligono(x: number, y: number, anillos: number[][]): boolean {
  if (!dentroDelAnillo(x, y, anillos[0])) return false;
  return !anillos.slice(1).some((hueco) => dentroDelAnillo(x, y, hueco));
}

/**
 * Municipio que contiene el punto (latitud, longitud en grados), o null si cae fuera de México (en el mar,
 * en otro país). Con la simplificación, a menos de ~200 m de un límite puede salir el municipio vecino.
 */
export function zonaPorCoordenadas(latitud: number, longitud: number): Zona | null {
  for (const m of MUNICIPIOS) {
    const [minx, miny, maxx, maxy] = m.b;
    if (longitud < minx || longitud > maxx || latitud < miny || latitud > maxy) continue;
    if (m.p.some((poligono) => dentroDelPoligono(longitud, latitud, poligono))) return { estado: m.e, municipio: m.m };
  }
  return null;
}
