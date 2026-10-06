// /api/aportes/[id]/archivo — el archivo del aporte en MinIO, tras comprobar permisos.
// Se usa como src de <img>. Nunca se exponen URLs directas al bucket.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { readUploadedFile } from "@/lib/minio";
import { borrarArchivoDeAporteAnonimo } from "@/lib/aportes/sanciones-anonimas";

/** Los tipos que puede tener un aporte (lib/aportes/imagen.ts). Cualquier otro se sirve como binario. */
const TIPOS_SERVIBLES = new Set(["image/jpeg", "image/png"]);

// GET: quien aportó, el creador o un revisor aceptado (si está pendiente o él lo validó).
// 410 si el creador borró el archivo.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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
    const buffer = await readUploadedFile(objectKey);
    const tipo = String(row.file_mime_type ?? "");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        // Solo tipos de imagen conocidos; nosniff evita que el navegador "adivine" otro
        // tipo (p. ej. HTML) en archivos viejos que no pasaron por la limpieza.
        "Content-Type": TIPOS_SERVIBLES.has(tipo) ? tipo : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=3600",
      },
    });
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
