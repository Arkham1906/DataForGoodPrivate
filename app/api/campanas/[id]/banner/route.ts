// GET /api/campanas/[id]/banner — el banner de la campaña, con la misma visibilidad que la campaña. Si el creador
// no subió uno, la imagen predeterminada de su temática (2026-11-21).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { condicionDeVisibilidad } from "@/lib/campanas/visibilidad";
import { getSessionUser } from "@/lib/session";
import { readUploadedFile } from "@/lib/minio";
import { bannerPredeterminado } from "@/lib/campanas/banner-predeterminado-imagen";

function tipoDeBanner(ruta: string): string {
  return ruta.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const usuario = await getSessionUser();
  const visible = await condicionDeVisibilidad(usuario, "campanas", 2);
  const result = await pool.query<{ banner_path: string | null; tematica: string | null }>(
    `SELECT banner_path, tematica FROM campanas WHERE id = $1 AND ${visible.sql} LIMIT 1`,
    [id, ...visible.params],
  );
  const fila = result.rows[0];
  if (!fila) return new NextResponse("No encontrado", { status: 404 });
  const ruta = fila.banner_path;
  // Sin banner propio, la imagen predeterminada de su temática (2026-11-21, lib/campanas/banner-predeterminado.ts).
  if (!ruta) return respuestaPredeterminada(fila.tematica ?? "");

  try {
    const contenido = await readUploadedFile(ruta);
    return new NextResponse(new Uint8Array(contenido), {
      headers: {
        "Content-Type": tipoDeBanner(ruta),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}

async function respuestaPredeterminada(tematica: string) {
  try {
    const contenido = await bannerPredeterminado(tematica);
    return new NextResponse(new Uint8Array(contenido), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("No se pudo generar el banner predeterminado", error);
    return new NextResponse("No encontrado", { status: 404 });
  }
}
