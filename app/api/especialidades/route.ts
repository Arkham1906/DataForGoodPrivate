// /api/especialidades — catálogo de especialidades del perfil (lib/usuarios/especialidades.ts,
// 2026-10-26). Lo usan /bienvenida y /cuenta (ui/CampoDeEspecialidad) para sugerir mientras se escribe.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { especialidadesVisibles } from "@/lib/usuarios/especialidades";

// GET — todas las especialidades, base y escritas por usuarios, en orden alfabético.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    return NextResponse.json({ data: await especialidadesVisibles() });
  } catch (error) {
    console.error("Error leyendo el catálogo de especialidades", error);
    return NextResponse.json({ error: "No se pudieron cargar las especialidades" }, { status: 500 });
  }
}
