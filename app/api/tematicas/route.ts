// /api/tematicas — catálogo de temáticas (lib/tematicas/catalogo.ts). Lo usan /bienvenida y /cuenta
// (para analizar el texto de intereses y para "Agregar temáticas") y el formulario de campaña.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { tematicasPropuestasPor, tematicasVisibles } from "@/lib/tematicas/catalogo";

// GET — las temáticas que se ofrecen (sin las ocultas): las base y después las de los usuarios.
// `propias` (2026-10-29): las que propuso quien pregunta y siguen sin revisar, para marcarlas "por aprobar".
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    const [data, propias] = await Promise.all([tematicasVisibles(), tematicasPropuestasPor(Number(user.id))]);
    return NextResponse.json({ data, propias });
  } catch (error) {
    console.error("Error leyendo el catálogo de temáticas", error);
    return NextResponse.json({ error: "No se pudieron cargar las temáticas" }, { status: 500 });
  }
}
