import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { condicionDeVisibilidad } from "@/lib/campanas/visibilidad";
import { getSessionUser } from "@/lib/session";
import { readUploadedFile } from "@/lib/minio";

function tipoDeBanner(ruta: string): string {
  return ruta.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new NextResponse("No encontrado", { status: 404 });

  const usuario = await getSessionUser();
  const visible = await condicionDeVisibilidad(usuario, "campanas", 2);
  const result = await pool.query<{ banner_path: string | null }>(
    `SELECT banner_path FROM campanas WHERE id = $1 AND ${visible.sql} LIMIT 1`,
    [id, ...visible.params],
  );
  const ruta = result.rows[0]?.banner_path;
  if (!ruta) return new NextResponse("No encontrado", { status: 404 });

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
