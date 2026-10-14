// /api/aportes/[id]/archivo — el archivo del aporte en MinIO, tras comprobar permisos.
// Se usa como src de <img>, <video> y <audio>, y como enlace de descarga de documentos.
// Nunca se exponen URLs directas al bucket.

import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { abrirArchivo, tamanoDeArchivo } from "@/lib/minio";
import { extensionForMime } from "@/lib/open-data";
import { borrarArchivoDeAporteAnonimo } from "@/lib/aportes/sanciones-anonimas";

/**
 * Los tipos que puede tener un aporte (lib/aportes/limpiar-archivo.ts) y si el navegador lo
 * muestra o lo descarga. Cualquier otro se sirve como binario para descargar.
 */
const TIPOS_SERVIBLES: Record<string, { contentType: string; enLinea: boolean }> = {
  "image/jpeg": { contentType: "image/jpeg", enLinea: true },
  "image/png": { contentType: "image/png", enLinea: true },
  "video/mp4": { contentType: "video/mp4", enLinea: true },
  "video/quicktime": { contentType: "video/quicktime", enLinea: true },
  "video/webm": { contentType: "video/webm", enLinea: true },
  "audio/mpeg": { contentType: "audio/mpeg", enLinea: true },
  "audio/mp4": { contentType: "audio/mp4", enLinea: true },
  "audio/wav": { contentType: "audio/wav", enLinea: true },
  "audio/ogg": { contentType: "audio/ogg", enLinea: true },
  "text/plain": { contentType: "text/plain; charset=utf-8", enLinea: true },
  "application/pdf": { contentType: "application/pdf", enLinea: false },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    enLinea: false,
  },
};

/** Un solo rango "bytes=a-b", "bytes=a-" o "bytes=-n". null sin cabecera (o con varios rangos: se manda todo). */
function leerRango(cabecera: string | null, tamano: number): { inicio: number; fin: number } | null | "invalido" {
  const partes = cabecera?.match(/^bytes=(\d*)-(\d*)$/);
  if (!partes) return null;
  const [, desde, hasta] = partes;
  if (!desde && !hasta) return "invalido";
  const inicio = desde ? Number(desde) : Math.max(0, tamano - Number(hasta));
  const fin = desde && hasta ? Math.min(Number(hasta), tamano - 1) : tamano - 1;
  if (inicio > fin || inicio >= tamano) return "invalido";
  return { inicio, fin };
}

// GET: quien aportó, el creador o un revisor aceptado (si está pendiente o él lo validó).
// Acepta Range (206) para video y audio. 410 si el creador borró el archivo; 404 si el
// aporte es de solo texto.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const result = await pool.query(
      `SELECT a.user_id, a.file_path, a.file_mime_type, a.campaign_id, a.status, a.first_pass_by_user_id, a.archivo_borrado_en,
              c.creator_id AS campaign_creator_id
       FROM aportes a
       JOIN campanas c ON c.id = a.campaign_id
       WHERE a.id = $1
       LIMIT 1`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });
    }

    const row = result.rows[0];
    const isOwner = Number(row.user_id) === Number(user.id);
    const isCampaignCreator = Number(row.campaign_creator_id) === Number(user.id);
    const reviewer = await pool.query(
      `SELECT 1 FROM campana_revisores WHERE campana_id = $1 AND usuario_id = $2 AND estado = 'aceptado' LIMIT 1`,
      [row.campaign_id, user.id]
    );
    const isAssignedReviewer = reviewer.rowCount !== 0;
    const canViewAsReviewer = isAssignedReviewer && (
      String(row.status) === "pendiente" || Number(row.first_pass_by_user_id) === Number(user.id)
    );

    // El rol de supervisor no da acceso al archivo (dictamina campañas, no
    // aportes), pero tampoco lo quita: un supervisor lo ve si es quien aportó,
    // quien creó la campaña o revisor aceptado de ella, como cualquiera.
    if (!isOwner && !isCampaignCreator && !canViewAsReviewer) {
      return NextResponse.json({ error: "No tienes permiso para ver este archivo" }, { status: 403 });
    }

    if (row.archivo_borrado_en) {
      return NextResponse.json({ error: "El creador de la campaña borró este archivo" }, { status: 410 });
    }

    const objectKey = String(row.file_path ?? "");
    if (!objectKey) {
      return NextResponse.json({ error: "Este aporte es de solo texto: no tiene archivo" }, { status: 404 });
    }

    const tipo = String(row.file_mime_type ?? "");
    const servible = TIPOS_SERVIBLES[tipo];
    const tamano = await tamanoDeArchivo(objectKey);
    const cabeceras: Record<string, string> = {
      // Solo tipos conocidos; nosniff evita que el navegador "adivine" otro tipo (p. ej.
      // HTML) en archivos viejos que no pasaron por la limpieza.
      "Content-Type": servible?.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
      // PDF y Word se descargan: abrirlos dentro de la app no es posible con la CSP sandbox.
      "Content-Disposition": servible?.enLinea
        ? "inline"
        : `attachment; filename="aporte-${id}${extensionForMime(tipo || "application/octet-stream")}"`,
    };

    // Range: el navegador pide una parte del video o audio (para adelantar o empezar a reproducir).
    const rango = leerRango(request.headers.get("range"), tamano);
    if (rango === "invalido") {
      return new NextResponse(null, { status: 416, headers: { ...cabeceras, "Content-Range": `bytes */${tamano}` } });
    }
    const contenido = await abrirArchivo(objectKey, rango ?? undefined);
    const cuerpo = Readable.toWeb(contenido) as ReadableStream<Uint8Array>;
    if (rango) {
      return new NextResponse(cuerpo, {
        status: 206,
        headers: {
          ...cabeceras,
          "Content-Range": `bytes ${rango.inicio}-${rango.fin}/${tamano}`,
          "Content-Length": String(rango.fin - rango.inicio + 1),
        },
      });
    }
    return new NextResponse(cuerpo, { headers: { ...cabeceras, "Content-Length": String(tamano) } });
  } catch (error) {
    console.error("Error sirviendo archivo de aporte", error);
    return NextResponse.json({ error: "No se pudo obtener el archivo" }, { status: 500 });
  }
}

// DELETE: el creador borra de MinIO el archivo de un aporte ANÓNIMO (contenido ilegal o
// dañino), solo mientras no tenga decisión (409 si ya está aceptado o rechazado). La fila del
// aporte se conserva; el archivo no se puede recuperar.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });

    const { rows } = await pool.query(
      `SELECT c.creator_id FROM aportes a JOIN campanas c ON c.id = a.campaign_id WHERE a.id = $1`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });
    if (Number(rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo el creador de la campaña puede borrar el archivo" }, { status: 403 });
    }

    const resultado = await borrarArchivoDeAporteAnonimo(Number(id), Number(user.id));
    if (resultado === "no-anonimo") {
      return NextResponse.json({ error: "Solo se puede borrar el archivo de un aporte anónimo" }, { status: 400 });
    }
    if (resultado === "decidido") {
      return NextResponse.json({ error: "El archivo de un aporte aceptado o rechazado ya no se puede borrar" }, { status: 409 });
    }
    if (resultado === "ya-borrado") return NextResponse.json({ error: "El archivo ya se había borrado" }, { status: 409 });

    return NextResponse.json({ message: "Archivo borrado" });
  } catch (error) {
    console.error("Error borrando archivo de aporte", error);
    return NextResponse.json({ error: "No se pudo borrar el archivo" }, { status: 500 });
  }
}
