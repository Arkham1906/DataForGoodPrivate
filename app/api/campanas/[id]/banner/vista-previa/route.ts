// GET /api/campanas/[id]/banner/vista-previa — el banner ligero para compartir (2026-11-13): JPEG de 1200 × 630
// y menos de 300 KB (lib/campanas/banner-vista-previa.ts). Lo usan el og:image de /c/[token] (WhatsApp, Facebook,
// X, Telegram y LinkedIn lo descargan sin sesión), la vista previa del cuadro Compartir y el adjunto de
// "Más opciones". Misma visibilidad que el banner original (../route.ts): sin sesión, solo campañas públicas.
// Si no se puede generar, entrega el original para que la vista previa no se quede sin imagen.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { condicionDeVisibilidad } from "@/lib/campanas/visibilidad";
import { vistaPreviaDelBanner } from "@/lib/campanas/banner-vista-previa";
import { readUploadedFile } from "@/lib/minio";
import { getSessionUser } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const usuario = await getSessionUser();
  const visible = await condicionDeVisibilidad(usuario, "campanas", 2);
  const result = await pool.query<{
    banner_path: string | null;
    banner_scale: number | null;
    banner_position_x: number | null;
    banner_position_y: number | null;
  }>(
    `SELECT banner_path, banner_scale, banner_position_x, banner_position_y
       FROM campanas WHERE id = $1 AND ${visible.sql} LIMIT 1`,
    [id, ...visible.params],
  );
  const fila = result.rows[0];
  if (!fila?.banner_path) return new NextResponse("No encontrado", { status: 404 });

  const cabeceras = {
    // La URL lleva ?v=<fecha de cambio>: puede guardarse un día sin servir una vieja.
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const contenido = await vistaPreviaDelBanner({
      campanaId: Number(id),
      ruta: fila.banner_path,
      escala: Number(fila.banner_scale ?? 1),
      x: Number(fila.banner_position_x ?? 50),
      y: Number(fila.banner_position_y ?? 50),
    });
    return new NextResponse(new Uint8Array(contenido), { headers: { ...cabeceras, "Content-Type": "image/jpeg" } });
  } catch (error) {
    console.error("No se pudo generar la vista previa del banner", error);
    try {
      const original = await readUploadedFile(fila.banner_path);
      const tipo = fila.banner_path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      return new NextResponse(new Uint8Array(original), { headers: { ...cabeceras, "Content-Type": tipo } });
    } catch {
      return new NextResponse("No encontrado", { status: 404 });
    }
  }
}
