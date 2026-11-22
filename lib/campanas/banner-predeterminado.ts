// Imagen predeterminada del banner de una campaña (2026-11-21, a pedido del usuario): si el creador no sube
// banner, la campaña muestra una imagen de su temática en todas las pantallas y al compartir el enlace.
// Decisiones del usuario: una imagen por temática (no una genérica) y para todas las campañas sin banner,
// también las que ya existían. Si después el creador sube el suyo, se usa el suyo.
//
// Aquí solo se arma el SVG (sin imports de servidor: el formulario de campaña lo enseña como vista previa
// con un data: URL). El JPEG que sirven /api/campanas/[id]/banner y .../vista-previa lo hace
// lib/campanas/banner-predeterminado-imagen.ts con sharp.
//
// Dibujo: fondo con el color de la familia de la temática, curvas de nivel y puntos de campo (la idea de
// landing/IlustracionDeCampo) y al centro un círculo con el ícono de la temática (lib/tematicas/dibujos.ts).
// Todo lo importante va al centro, porque cada pantalla lo recorta distinto (16:10, 4:3, 1200 × 630).
// Sin texto: el contenedor no tiene fuentes y el nombre ya va junto a la imagen en todas las tarjetas.

import { claveDeTematica } from "@/lib/tematicas/analizar";
import { dibujoDeTematica } from "@/lib/tematicas/dibujos";

/** Medidas del banner predeterminado (16:10, la proporción de las tarjetas). */
export const ANCHO_DEL_BANNER_PREDETERMINADO = 1600;
export const ALTO_DEL_BANNER_PREDETERMINADO = 1000;

type Familia = { claro: string; medio: string; linea: string; punto: string; fuerte: string };

// Valores de app/globals.css (@theme): el SVG lo pinta sharp, que no conoce las variables CSS.
// Si cambia la paleta, cambiar aquí también.
const FAMILIAS = {
  success: { claro: "#e4f4ec", medio: "#c1e4d3", linea: "#a1d5bc", punto: "#4aa37e", fuerte: "#0e7a55" },
  brand: { claro: "#eaf0fa", medio: "#c1d7fb", linea: "#9fbff4", punto: "#4b77c8", fuerte: "#2e5aac" },
  warning: { claro: "#fefce8", medio: "#fef08a", linea: "#fde047", punto: "#ca8a04", fuerte: "#a16207" },
  system: { claro: "#fbfaf8", medio: "#e9e6e1", linea: "#d8d4cd", punto: "#686c77", fuerte: "#43464f" },
} satisfies Record<string, Familia>;

// Color por temática (claves de claveDeTematica): verde naturaleza, ámbar seguridad, comida, arte y
// juego, azul lo demás (sociedad, servicios, tecnología). Las que no están aquí (propuestas o nuevas)
// van en gris, con el dibujo genérico salvo que tengan uno propio.
const FAMILIA_POR_TEMATICA: Record<string, keyof typeof FAMILIAS> = {
  "medio ambiente": "success",
  "proteccion animal": "success",
  animales: "success",
  "calidad del aire": "success",
  "residuos y reciclaje": "success",
  biodiversidad: "success",
  "plantas y jardineria": "success",
  agricultura: "success",
  "aire libre": "success",
  salud: "brand",
  educacion: "brand",
  infraestructura: "brand",
  movilidad: "brand",
  "agua y saneamiento": "brand",
  "espacios publicos": "brand",
  "accesibilidad e inclusion": "brand",
  "igualdad de genero": "brand",
  "derechos humanos": "brand",
  "gobierno y participacion ciudadana": "brand",
  vivienda: "brand",
  "trabajo y economia": "brand",
  tecnologia: "brand",
  seguridad: "warning",
  "proteccion civil": "warning",
  "arte y cultura": "warning",
  entretenimiento: "warning",
  "cocina y alimentacion": "warning",
  deporte: "warning",
  videojuegos: "warning",
};

/** Número estable a partir de un texto: la misma temática sale siempre con el mismo dibujo. */
function semillaDe(texto: string): number {
  let h = 7;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) % 100_003;
  return h;
}

/** Curva cerrada irregular alrededor de (x, y), como las de landing/IlustracionDeCampo. */
function curva(x: number, y: number, rx: number, ry: number, semilla: number): string {
  const lados = 64;
  const puntos: string[] = [];
  for (let i = 0; i < lados; i += 1) {
    const angulo = (i / lados) * Math.PI * 2;
    const ondulacion = 1 + 0.08 * Math.sin(3 * angulo + semilla) + 0.04 * Math.sin(7 * angulo + semilla * 2);
    puntos.push(`${(x + Math.cos(angulo) * rx * ondulacion).toFixed(1)} ${(y + Math.sin(angulo) * ry * ondulacion).toFixed(1)}`);
  }
  return `M${puntos.join("L")}Z`;
}

/** SVG del banner predeterminado de una temática, del tamaño pedido (el dibujo se acomoda a la proporción). */
export function svgDelBannerPredeterminado(
  tematica: string,
  ancho = ANCHO_DEL_BANNER_PREDETERMINADO,
  alto = ALTO_DEL_BANNER_PREDETERMINADO,
): string {
  const clave = claveDeTematica(tematica);
  const familia = FAMILIAS[FAMILIA_POR_TEMATICA[clave] ?? "system"];
  const semilla = semillaDe(clave || "general");
  const base = Math.min(ancho, alto);
  const cx = ancho / 2;
  const cy = alto / 2;

  // Dos cerros a los lados, a una altura que cambia con la temática.
  const cerros = [
    { x: ancho * 0.16, y: alto * (0.3 + (semilla % 40) / 100), s: (semilla % 17) / 3 },
    { x: ancho * 0.84, y: alto * (0.7 - (semilla % 30) / 100), s: (semilla % 23) / 4 },
  ];
  const anillos = cerros
    .flatMap((c) =>
      [1, 0.82, 0.64, 0.46, 0.3, 0.16].map(
        (k) => `<path d="${curva(c.x, c.y, base * 0.62 * k, base * 0.42 * k, c.s)}" />`,
      ),
    )
    .join("");

  // Puntos de campo unidos al centro.
  const puntos = [0, 1, 2, 3, 4, 5].map((i) => {
    const angulo = ((semilla % 360) * Math.PI) / 180 + (i * Math.PI) / 3;
    const distancia = base * (0.36 + ((semilla >> i) % 9) / 100);
    return { x: cx + Math.cos(angulo) * distancia * (ancho / alto), y: cy + Math.sin(angulo) * distancia };
  });
  const lineas = puntos.map((p) => `<path d="M${cx} ${cy}L${p.x.toFixed(1)} ${p.y.toFixed(1)}" />`).join("");
  const circulos = puntos.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(base * 0.014).toFixed(1)}" />`).join("");

  const radio = base * 0.2;
  const lado = radio * 1.25;
  const escala = lado / 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
<defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${familia.claro}"/><stop offset="1" stop-color="${familia.medio}"/></linearGradient></defs>
<rect width="${ancho}" height="${alto}" fill="url(#f)"/>
<g fill="none" stroke="${familia.linea}" stroke-width="${(base * 0.004).toFixed(1)}" opacity="0.8">${anillos}</g>
<g stroke="${familia.punto}" stroke-width="${(base * 0.003).toFixed(1)}" stroke-dasharray="${(base * 0.012).toFixed(1)} ${(base * 0.012).toFixed(1)}" opacity="0.45">${lineas}</g>
<g fill="${familia.punto}" opacity="0.7">${circulos}</g>
<circle cx="${cx}" cy="${cy}" r="${(radio * 1.22).toFixed(1)}" fill="${familia.claro}" opacity="0.9"/>
<circle cx="${cx}" cy="${cy}" r="${radio.toFixed(1)}" fill="${familia.fuerte}"/>
<g transform="translate(${(cx - lado / 2).toFixed(1)} ${(cy - lado / 2).toFixed(1)}) scale(${escala.toFixed(3)})" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${dibujoDeTematica(tematica)}</g>
</svg>`;
}

/** data: URL del SVG, para enseñarlo en el navegador (CSP: img-src acepta data:). */
export function urlDelBannerPredeterminado(tematica: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDelBannerPredeterminado(tematica))}`;
}

/**
 * Campos del banner que mandan las consultas a las pantallas (2026-11-21). `hasBanner` es siempre true: toda
 * campaña tiene imagen, la suya o la de su temática, y /api/campanas/[id]/banner entrega la que toque.
 * `bannerPropio` dice si la subió el creador (el formulario lo usa para "Cambiar banner"). Sin banner propio,
 * el encuadre va en su valor inicial, para que la imagen predeterminada no salga con el zoom de uno anterior.
 */
export function camposDelBanner(row: {
  banner_path?: unknown;
  updated_at?: unknown;
  banner_scale?: unknown;
  banner_position_x?: unknown;
  banner_position_y?: unknown;
}) {
  const propio = Boolean(row.banner_path);
  return {
    hasBanner: true,
    bannerPropio: propio,
    bannerVersion: row.updated_at ? String(row.updated_at) : undefined,
    bannerScale: propio ? Number(row.banner_scale ?? 1) : 1,
    bannerPositionX: propio ? Number(row.banner_position_x ?? 50) : 50,
    bannerPositionY: propio ? Number(row.banner_position_y ?? 50) : 50,
  };
}
