// Validación real y limpieza del archivo de un aporte, antes de guardarlo en MinIO
// (2026-10-14). La usan los dos caminos para aportar: POST /api/aportes y
// POST /api/c/[token]/aportes, a través de guardarArchivoDelAporte() (./comun.ts).
//
// El tipo lo decide el CONTENIDO (firma de los primeros bytes), no el nombre ni file.type;
// el nombre solo desempata audio y video dentro del mismo contenedor MP4.
//   - Foto: lib/aportes/imagen.ts (re-codifica con sharp, sin EXIF/GPS).
//   - Documento ("Archivos" en pantalla): .pdf, .docx, .pptx y .xlsx sin autor, fechas ni
//     propiedades; se rechazan PDF cifrados y Office con macros. Desde el 2026-10-26 también .pptx,
//     .xlsx y .xls; el .xls (Excel antiguo, formato binario) se guarda tal cual: solo se comprueba
//     que sea un libro de Excel sin macros.
//   - Texto (.txt): UTF-8 válido sin bytes nulos; si viene en Windows-1252, se pasa a UTF-8.
//   - Video y audio: solo se comprueba la firma y se guardan tal cual (limpiarlos exige
//     ffmpeg). La pantalla de aportar avisa que pueden llevar la ubicación.

import JSZip from "jszip";
import { PDFDocument, PDFName } from "pdf-lib";
import { limpiarImagen } from "@/lib/aportes/imagen";
import {
  FORMATOS,
  MIME_DOCX,
  MIME_PPTX,
  MIME_XLS,
  MIME_XLSX,
  tipoPorNombre,
  textoDeExtensiones,
  textoDeTamano,
  type TipoDeArchivo,
} from "@/lib/aportes/archivo";

export type ArchivoLimpio = { tipo: TipoDeArchivo; contenido: Buffer; extension: string; mimeType: string };
type Resultado = { ok: true; archivo: ArchivoLimpio } | { ok: false; error: string };

function empiezaCon(contenido: Buffer, bytes: number[] | string, desde = 0): boolean {
  const firma = typeof bytes === "string" ? Buffer.from(bytes, "latin1") : Buffer.from(bytes);
  return contenido.subarray(desde, desde + firma.length).equals(firma);
}

/** Contenedor y formato según los primeros bytes. */
function formatoPorFirma(c: Buffer): "jpeg" | "png" | "mp4" | "mov" | "webm" | "mp3" | "wav" | "ogg" | "pdf" | "zip" | "ole" | null {
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
  // Compound File Binary (Office antiguo: .xls, .doc, .ppt).
  if (empiezaCon(c, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
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
      return declarado === "documento" ? limpiarOffice(contenido) : noValido;
    case "ole":
      return declarado === "documento" ? revisarXls(contenido) : noValido;
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

/** Qué es un archivo de Office moderno (un ZIP) según la parte principal que trae. */
const OFFICE = [
  { principal: "word/document.xml", carpeta: "word", extension: ".docx", mimeType: MIME_DOCX, nombre: "Word (.docx)" },
  { principal: "ppt/presentation.xml", carpeta: "ppt", extension: ".pptx", mimeType: MIME_PPTX, nombre: "PowerPoint (.pptx)" },
  { principal: "xl/workbook.xml", carpeta: "xl", extension: ".xlsx", mimeType: MIME_XLSX, nombre: "Excel (.xlsx)" },
] as const;

/**
 * Word, PowerPoint o Excel modernos (.docx, .pptx, .xlsx) sin metadatos: vacía las propiedades del
 * archivo (autor, quién lo modificó, empresa, fechas, propiedades personalizadas) y deja en blanco
 * los autores de comentarios y del control de cambios. Rechaza los que traen macros. Las imágenes
 * incrustadas no se tocan. El tipo lo decide la parte principal del ZIP, no la extensión.
 */
async function limpiarOffice(contenido: Buffer): Promise<Resultado> {
  const noEsOffice: Resultado = {
    ok: false,
    error: "El archivo no es un PDF, Word (.docx), PowerPoint (.pptx) ni Excel (.xlsx) válido.",
  };
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(contenido);
  } catch {
    return noEsOffice;
  }
  const tiposDeContenido = await zip.file("[Content_Types].xml")?.async("string");
  const formato = OFFICE.find((o) => zip.file(o.principal));
  if (!tiposDeContenido || !formato) return noEsOffice;
  if (/macroEnabled/i.test(tiposDeContenido) || zip.file(/vbaProject\.bin$/i).length > 0) {
    return { ok: false, error: `El archivo tiene macros. Guárdalo como ${formato.nombre} normal y vuelve a subirlo.` };
  }

  try {
    if (zip.file("docProps/core.xml")) zip.file("docProps/core.xml", CORE_VACIO);
    if (zip.file("docProps/app.xml")) zip.file("docProps/app.xml", APP_VACIO);
    if (zip.file("docProps/custom.xml")) zip.file("docProps/custom.xml", CUSTOM_VACIO);
    const partes = zip.file(new RegExp(`^${formato.carpeta}/.+\\.xml$`));
    for (const parte of partes) {
      const xml = await parte.async("string");
      const sinAutores = xml
        // Word: se vacía el valor, no se quita el atributo (w:author es obligatorio en w:ins/w:del).
        .replace(/(\sw(?:15)?:(?:author|initials|userId|providerId))="[^"]*"/g, '$1=""')
        // PowerPoint: autores de comentarios (ppt/commentAuthors.xml y ppt/authors.xml).
        .replace(/(<p(?:188)?:(?:cmAuthor|author)\b[^>]*?\s(?:name|initials|userId|providerId))="[^"]*"/g, '$1=""')
        // Excel: autores de comentarios (xl/comments*.xml) y personas de los comentarios en hilo.
        .replace(/<author>[^<]*<\/author>/g, "<author></author>")
        .replace(/(<person\b[^>]*?\s(?:displayName|userId|providerId))="[^"]*"/g, '$1=""');
      if (sinAutores !== xml) zip.file(parte.name, sinAutores);
    }
    const limpio = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return { ok: true, archivo: { tipo: "documento", contenido: limpio, extension: formato.extension, mimeType: formato.mimeType } };
  } catch {
    return noEsOffice;
  }
}

/** Nombre de un flujo del archivo binario de Office, como aparece en su directorio (UTF-16LE). */
function flujo(nombre: string): Buffer {
  return Buffer.from(nombre, "utf16le");
}

/**
 * Excel antiguo (.xls, 2026-10-26): formato binario que no se puede limpiar sin otra librería, así
 * que se guarda tal cual (como video y audio). Se comprueba que sea un libro de Excel (flujo
 * "Workbook" o "Book") y no un .doc o .ppt renombrado (sus flujos "WordDocument" y "PowerPoint
 * Document"; el texto de un Word también va en UTF-16 y podría decir "Book"), y que no traiga
 * macros (_VBA_PROJECT_CUR).
 */
function revisarXls(contenido: Buffer): Resultado {
  const esLibro = contenido.includes(flujo("Workbook")) || contenido.includes(flujo("Book"));
  const esOtroOffice = contenido.includes(flujo("WordDocument")) || contenido.includes(flujo("PowerPoint Document"));
  if (!esLibro || esOtroOffice) return { ok: false, error: "El archivo no es un Excel (.xls) válido." };
  if (contenido.includes(flujo("_VBA_PROJECT_CUR"))) {
    return { ok: false, error: "El archivo tiene macros. Guárdalo como Excel (.xlsx) normal y vuelve a subirlo." };
  }
  return { ok: true, archivo: { tipo: "documento", contenido, extension: ".xls", mimeType: MIME_XLS } };
}
