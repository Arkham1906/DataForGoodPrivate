// Vista previa ligera del banner para compartir (2026-11-13, a pedido del usuario: WhatsApp ignora imágenes pesadas
// y hay banners PNG de 2 MB). Un JPEG de 1200 × 630 (la proporción que usan WhatsApp, Facebook, X y LinkedIn) de
// menos de 300 KB, recortado como se ve el banner en las tarjetas: object-fit cover con banner_position_x/y y
// después el zoom banner_scale, centrado.
//
// Se genera la primera vez que alguien la pide y se guarda en MinIO con una clave que depende del archivo del
// banner y de su encuadre (vistas-previas/campanas/<id>/<huella>.jpg): las siguientes veces solo se lee. Si el
// creador cambia el banner o su encuadre, la huella cambia y se genera otra (la vieja queda en el bucket; pesa poco).
// Cuidado con la memoria (sharp tumbó producción el 2026-10-05): se procesa un banner a la vez, sin mozjpeg y con
// tope de megapíxeles, y dos pedidos del mismo banner comparten el trabajo.

import { createHash } from "crypto";
import sharp from "sharp";
import { guardarArchivoEnClave, readUploadedFile } from "@/lib/minio";

const ANCHO = 1200;
const ALTO = 630;
/** WhatsApp suele descartar imágenes de más de ~300 KB en la vista previa. */
const PESO_MAXIMO = 300 * 1024;
const CALIDADES = [80, 65, 50];
const MAXIMO_DE_MEGAPIXELES = 50;

export type BannerParaVistaPrevia = {
  campanaId: number;
  /** Clave del banner original en MinIO (campanas.banner_path). */
  ruta: string;
  escala: number;
  /** Encuadre en % (0 a 100), como object-position. */
  x: number;
  y: number;
};

function claveDeLaVistaPrevia(b: BannerParaVistaPrevia): string {
  const huella = createHash("sha256").update(`${b.ruta}|${b.escala}|${b.x}|${b.y}`).digest("hex").slice(0, 20);
  return `vistas-previas/campanas/${b.campanaId}/${huella}.jpg`;
}

/** Zona del original que se ve en un recuadro 1200 × 630 con cover, posición y zoom centrado. */
function recorte(ancho: number, alto: number, b: BannerParaVistaPrevia) {
  const proporcion = ANCHO / ALTO;
  const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const px = limitar(Number.isFinite(b.x) ? b.x : 50, 0, 100) / 100;
  const py = limitar(Number.isFinite(b.y) ? b.y : 50, 0, 100) / 100;
  const escala = limitar(Number.isFinite(b.escala) && b.escala > 0 ? b.escala : 1, 1, 4);
  // Cover: el recorte más grande con la proporción de la vista previa, movido según la posición.
  let w = ancho;
  let h = Math.round(ancho / proporcion);
  if (h > alto) {
    h = alto;
    w = Math.round(alto * proporcion);
  }
  let left = (ancho - w) * px;
  let top = (alto - h) * py;
  // Zoom centrado en ese recuadro, como transform: scale().
  const wz = w / escala;
  const hz = h / escala;
  left += (w - wz) / 2;
  top += (h - hz) / 2;
  return {
    left: Math.max(0, Math.round(left)),
    top: Math.max(0, Math.round(top)),
    width: Math.max(1, Math.min(ancho, Math.round(wz))),
    height: Math.max(1, Math.min(alto, Math.round(hz))),
  };
}

async function generar(b: BannerParaVistaPrevia): Promise<Buffer> {
  const original = await readUploadedFile(b.ruta);
  const opciones = { failOn: "error" as const, limitInputPixels: MAXIMO_DE_MEGAPIXELES * 1_000_000 };
  const meta = await sharp(original, opciones).metadata();
  // Medidas ya giradas según el EXIF, que es como se ve la foto.
  const ancho = meta.autoOrient?.width ?? meta.width ?? 0;
  const alto = meta.autoOrient?.height ?? meta.height ?? 0;
  if (!ancho || !alto) throw new Error("Banner sin medidas");
  const zona = recorte(ancho, alto, b);
  let salida = Buffer.alloc(0);
  for (const calidad of CALIDADES) {
    salida = await sharp(original, opciones)
      .autoOrient()
      .extract({ left: zona.left, top: zona.top, width: Math.min(zona.width, ancho - zona.left), height: Math.min(zona.height, alto - zona.top) })
      .resize(ANCHO, ALTO, { fit: "cover" })
      // Un PNG con transparencia queda sobre blanco.
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: calidad, progressive: true })
      .toBuffer();
    if (salida.byteLength <= PESO_MAXIMO) break;
  }
  return salida;
}

// Un banner a la vez (cola) y un solo trabajo por clave aunque lleguen varios pedidos juntos.
let cola: Promise<unknown> = Promise.resolve();
const enCurso = new Map<string, Promise<Buffer>>();

/** La vista previa (JPEG) del banner: la guardada en MinIO o, si aún no existe, la genera y la guarda. */
export async function vistaPreviaDelBanner(b: BannerParaVistaPrevia): Promise<Buffer> {
  const clave = claveDeLaVistaPrevia(b);
  try {
    return await readUploadedFile(clave);
  } catch {
    // Aún no existe: se genera.
  }
  const pendiente = enCurso.get(clave);
  if (pendiente) return pendiente;
  const trabajo = cola.then(async () => {
    const contenido = await generar(b);
    await guardarArchivoEnClave(clave, contenido, "image/jpeg");
    return contenido;
  });
  cola = trabajo.catch(() => undefined);
  enCurso.set(clave, trabajo);
  try {
    return await trabajo;
  } finally {
    enCurso.delete(clave);
  }
}

export const MEDIDAS_DE_LA_VISTA_PREVIA = { ancho: ANCHO, alto: ALTO };
