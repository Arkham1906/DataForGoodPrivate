// /api/tematicas — catálogo de temáticas (lib/tematicas/catalogo.ts). Lo usan /bienvenida y /cuenta
// (para analizar el texto de intereses y para "Agregar temáticas") y el formulario de campaña.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { tematicasVisibles } from "@/lib/tematicas/catalogo";

// GET — las temáticas que se ofrecen (sin las ocultas): las 23 base y después las de los usuarios.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    return NextResponse.json({ data: await tematicasVisibles() });
  } catch (error) {
    console.error("Error leyendo el catálogo de temáticas", error);
    return NextResponse.json({ error: "No se pudieron cargar las temáticas" }, { status: 500 });
  }
}
