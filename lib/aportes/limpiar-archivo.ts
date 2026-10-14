// Validación real y limpieza del archivo de un aporte, antes de guardarlo en MinIO
// (2026-10-14). La usan los dos caminos para aportar: POST /api/aportes y
// POST /api/c/[token]/aportes, a través de guardarArchivoDelAporte() (./comun.ts).
//
// El tipo lo decide el CONTENIDO (firma de los primeros bytes), no el nombre ni file.type;
// el nombre solo desempata audio y video dentro del mismo contenedor MP4.
//   - Foto: lib/aportes/imagen.ts (re-codifica con sharp, sin EXIF/GPS).
//   - Documento: .pdf y .docx sin autor, fechas ni propiedades; se rechazan PDF cifrados y
//     Word con macros.
//   - Texto (.txt): UTF-8 válido sin bytes nulos; si viene en Windows-1252, se pasa a UTF-8.
//   - Video y audio: solo se comprueba la firma y se guardan tal cual (limpiarlos exige
//     ffmpeg). La pantalla de aportar avisa que pueden llevar la ubicación.

import JSZip from "jszip";
import { PDFDocument, PDFName } from "pdf-lib";
import { limpiarImagen } from "@/lib/aportes/imagen";
import { FORMATOS, tipoPorNombre, textoDeExtensiones, textoDeTamano, type TipoDeArchivo } from "@/lib/aportes/archivo";

export type ArchivoLimpio = { tipo: TipoDeArchivo; contenido: Buffer; extension: string; mimeType: string };
type Resultado = { ok: true; archivo: ArchivoLimpio } | { ok: false; error: string };

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function empiezaCon(contenido: Buffer, bytes: number[] | string, desde = 0): boolean {
  const firma = typeof bytes === "string" ? Buffer.from(bytes, "latin1") : Buffer.from(bytes);
  return contenido.subarray(desde, desde + firma.length).equals(firma);
}

/** Contenedor y formato según los primeros bytes. */
function formatoPorFirma(c: Buffer): "jpeg" | "png" | "mp4" | "mov" | "webm" | "mp3" | "wav" | "ogg" | "pdf" | "zip" | null {
  if (empiezaCon(c, [0xff, 0xd8, 0xff])) return "jpeg";
  if (empiezaCon(c, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // ISO BMFF (MP4, MOV, M4A): "ftyp" en el byte 4; la marca principal va en los bytes 8–11.
  if (empiezaCon(c, "ftyp", 4)) return empiezaCon(c, "qt  ", 8) ? "mov" : "mp4";
  if (empiezaCon(c, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (empiezaCon(c, "ID3") || (c[0] === 0xff && c.length > 1 && (c[1] & 0xe0) === 0xe0)) return "mp3";
  if (empiezaCon(c, "RIFF") && empiezaCon(c, "WAVE", 8)) return "wav";
  if (empiezaCon(c, "OggS")) return "ogg";
  // La especificación permite basura antes de "%PDF-"; se busca en el primer KB.
  if (c.subarray(0, 1024).includes(Buffer.from("%PDF-", "latin1"))) return "pdf";
  if (empiezaCon(c, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  return null;
}

/**
 * Comprueba y limpia el archivo. `tipos` son los que acepta la campaña: un archivo de otro
 * tipo se rechaza aunque sea válido.
 */
export async function limpiarArchivo(archivo: File, tipos: TipoDeArchivo[]): Promise<Resultado> {
  const noValido: Resultado = { ok: false, error: `El archivo no es válido. Esta campaña acepta ${textoDeExtensiones(tipos)}.` };
  const declarado = tipoPorNombre(archivo);
  if (!declarado || !tipos.includes(declarado)) return noValido;
  if (archivo.size > FORMATOS[declarado].tamanoMaximo) {
    return { ok: false, error: `El archivo pesa más de ${textoDeTamano(FORMATOS[declarado].tamanoMaximo)}.` };
  }

  if (declarado === "foto") {
    const limpia = await limpiarImagen(archivo);
    return limpia.ok ? { ok: true, archivo: { tipo: "foto", ...limpia.imagen } } : limpia;
  }

  const contenido = Buffer.from(await archivo.arrayBuffer());
  if (declarado === "texto") return limpiarTexto(contenido);

  const formato = formatoPorFirma(contenido);
  // El contenido debe ser del mismo tipo que dice la extensión: así también vale el tope de
  // tamaño que ya se revisó (un PDF de 45 MB llamado .mp4 no pasa como documento).
  const listo = (tipo: TipoDeArchivo, extension: string, mimeType: string): Resultado =>
    tipo === declarado ? { ok: true, archivo: { tipo, contenido, extension, mimeType } } : noValido;

  switch (formato) {
    case "mp4":
      // El mismo contenedor sirve para video (.mp4) y audio (.m4a): decide lo que eligió la persona.
      return declarado === "audio" ? listo("audio", ".m4a", "audio/mp4") : listo("video", ".mp4", "video/mp4");
    case "mov":
      return listo("video", ".mov", "video/quicktime");
    case "webm":
      return listo("video", ".webm", "video/webm");
    case "mp3":
      return listo("audio", ".mp3", "audio/mpeg");
    case "wav":
      return listo("audio", ".wav", "audio/wav");
    case "ogg":
      return listo("audio", ".ogg", "audio/ogg");
    case "pdf":
      return declarado === "documento" ? limpiarPdf(contenido) : noValido;
    case "zip":
      return declarado === "documento" ? limpiarDocx(contenido) : noValido;
    default:
      return noValido;
  }
}

/** Texto plano: sin bytes nulos (sería un binario renombrado) y guardado siempre en UTF-8. */
function limpiarTexto(contenido: Buffer): Resultado {
  if (contenido.includes(0)) return { ok: false, error: "El archivo .txt no es texto plano." };
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(contenido);
  } catch {
    // Bloc de notas antiguo guarda en Windows-1252 (acentos en un byte).
    texto = new TextDecoder("windows-1252").decode(contenido);
  }
  texto = texto.replace(/^﻿/, "");
  if (!texto.trim()) return { ok: false, error: "El archivo .txt está vacío." };
  return { ok: true, archivo: { tipo: "texto", contenido: Buffer.from(texto, "utf-8"), extension: ".txt", mimeType: "text/plain" } };
}

/**
 * PDF sin metadatos: vacía el diccionario Info (autor, título, programa, fechas) y quita el
 * XMP del catálogo. pdf-lib reescribe el archivo completo, así que también se pierden las
 * versiones anteriores que guardan las ediciones incrementales.
 */
async function limpiarPdf(contenido: Buffer): Promise<Resultado> {
  try {
    const pdf = await PDFDocument.load(contenido, { updateMetadata: false });
    pdf.context.trailerInfo.Info = pdf.context.register(pdf.context.obj({}));
    pdf.catalog.delete(PDFName.of("Metadata"));
    const limpio = Buffer.from(await pdf.save());
    return { ok: true, archivo: { tipo: "documento", contenido: limpio, extension: ".pdf", mimeType: "application/pdf" } };
  } catch (error) {
    const cifrado = error instanceof Error && /encrypt/i.test(error.message);
    return {
      ok: false,
      error: cifrado ? "El PDF está protegido con contraseña. Súbelo sin protección." : "No se pudo leer el PDF. Prueba con otro archivo.",
    };
  }
}

const CORE_VACIO =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>';
const APP_VACIO =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"/>';
const CUSTOM_VACIO =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"/>';

/**
 * Word (.docx) sin metadatos: vacía las propiedades del documento (autor, quién lo modificó,
 * empresa, fechas, propiedades personalizadas) y deja en blanco los autores de comentarios,
 * control de cambios y la lista de personas. Rechaza los que traen macros. Las imágenes
 * incrustadas no se tocan.
 */
async function limpiarDocx(contenido: Buffer): Promise<Resultado> {
  const noEsWord: Resultado = { ok: false, error: "El archivo no es un documento de Word (.docx) válido." };
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(contenido);
  } catch {
    return noEsWord;
  }
  const tiposDeContenido = await zip.file("[Content_Types].xml")?.async("string");
  if (!tiposDeContenido || !zip.file("word/document.xml")) return noEsWord;
  if (/macroEnabled/i.test(tiposDeContenido) || zip.file(/vbaProject\.bin$/i).length > 0) {
    return { ok: false, error: "El documento tiene macros. Guárdalo como .docx normal y vuelve a subirlo." };
  }

  try {
    if (zip.file("docProps/core.xml")) zip.file("docProps/core.xml", CORE_VACIO);
    if (zip.file("docProps/app.xml")) zip.file("docProps/app.xml", APP_VACIO);
    if (zip.file("docProps/custom.xml")) zip.file("docProps/custom.xml", CUSTOM_VACIO);
    for (const parte of zip.file(/^word\/[^/]+\.xml$/)) {
      const xml = await parte.async("string");
      // Se vacía el valor, no se quita el atributo: w:author es obligatorio en w:ins/w:del.
      const sinAutores = xml.replace(/(\sw(?:15)?:(?:author|initials|userId|providerId))="[^"]*"/g, '$1=""');
      if (sinAutores !== xml) zip.file(parte.name, sinAutores);
    }
    const limpio = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return { ok: true, archivo: { tipo: "documento", contenido: limpio, extension: ".docx", mimeType: MIME_DOCX } };
  } catch {
    return noEsWord;
  }
}
