// /api/etiquetas — catálogo de etiquetas (subtemáticas, 2026-10-27; lib/etiquetas/catalogo.ts). Lo
// usan el formulario de campaña (las de su temática) y /bienvenida y /cuenta (las de sus intereses).

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { etiquetasVisibles } from "@/lib/etiquetas/catalogo";

// GET — las etiquetas que se ofrecen (aprobadas y visibles), por nombre de temática: { [tematica]: [{ id, nombre }] }.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    return NextResponse.json({ data: await etiquetasVisibles() });
  } catch (error) {
    console.error("Error leyendo el catálogo de etiquetas", error);
    return NextResponse.json({ error: "No se pudieron cargar las etiquetas" }, { status: 500 });
  }
}
