// JPEG del banner predeterminado (2026-11-21): rasteriza con sharp el SVG de lib/campanas/banner-predeterminado.ts.
// Lo usan GET /api/campanas/[id]/banner (1600 × 1000, para las pantallas) y .../banner/vista-previa
// (1200 × 630 y menos de 300 KB, para WhatsApp y las demás redes, que no aceptan SVG).
// El dibujo depende solo de la temática y del tamaño, así que se guarda en memoria: cada temática se pinta
// una vez por proceso (son ~30 imágenes de decenas de KB). Dos pedidos a la vez comparten el trabajo.

import sharp from "sharp";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import {
  ALTO_DEL_BANNER_PREDETERMINADO,
  ANCHO_DEL_BANNER_PREDETERMINADO,
  svgDelBannerPredeterminado,
} from "@/lib/campanas/banner-predeterminado";

export type TamanoDelBannerPredeterminado = "banner" | "vista-previa";

const MEDIDAS: Record<TamanoDelBannerPredeterminado, { ancho: number; alto: number; calidad: number }> = {
  banner: { ancho: ANCHO_DEL_BANNER_PREDETERMINADO, alto: ALTO_DEL_BANNER_PREDETERMINADO, calidad: 85 },
  "vista-previa": { ancho: 1200, alto: 630, calidad: 80 },
};

const enMemoria = new Map<string, Promise<Buffer>>();

/** JPEG del banner predeterminado de la temática. */
export function bannerPredeterminado(tematica: string, tamano: TamanoDelBannerPredeterminado = "banner"): Promise<Buffer> {
  const llave = `${tamano}|${claveDeTematica(tematica)}`;
  let trabajo = enMemoria.get(llave);
  if (!trabajo) {
    const { ancho, alto, calidad } = MEDIDAS[tamano];
    trabajo = sharp(Buffer.from(svgDelBannerPredeterminado(tematica, ancho, alto)))
      .jpeg({ quality: calidad })
      .toBuffer();
    enMemoria.set(llave, trabajo);
    // Si falla, que el siguiente pedido lo intente otra vez.
    trabajo.catch(() => enMemoria.delete(llave));
  }
  return trabajo;
}
