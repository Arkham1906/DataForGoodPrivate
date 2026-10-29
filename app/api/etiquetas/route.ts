// /api/etiquetas — catálogo de etiquetas (subtemáticas, 2026-10-27; lib/etiquetas/catalogo.ts). Lo
// usan el formulario de campaña (las de su temática) y /bienvenida y /cuenta (las de sus intereses).

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { etiquetasVisibles, tematicasConEtiquetas } from "@/lib/etiquetas/catalogo";

// GET — las etiquetas que se ofrecen (aprobadas y visibles), por nombre de temática: { [tematica]: [{ id, nombre }] },
// más las pendientes de quien pregunta (las que propuso o tiene en su perfil) con `pendiente: true` (2026-10-28).
// `tematicas`: las temáticas aprobadas y visibles, a las que se les puede proponer una etiqueta desde el perfil,
// y desde el 2026-10-29 también las pendientes que propuso quien pregunta o tiene en sus intereses.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    const [data, tematicas] = await Promise.all([etiquetasVisibles(user.id), tematicasConEtiquetas(user.id)]);
    return NextResponse.json({ data, tematicas });
  } catch (error) {
    console.error("Error leyendo el catálogo de etiquetas", error);
    return NextResponse.json({ error: "No se pudieron cargar las etiquetas" }, { status: 500 });
  }
}
