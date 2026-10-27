// /api/organizaciones — catálogo de organizaciones del perfil (lib/usuarios/organizaciones.ts,
// 2026-10-26). Lo usan /bienvenida, /cuenta y el formulario de campaña (ui/CampoConSugerencias)
// para sugerir mientras se escribe.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { organizacionesVisibles } from "@/lib/usuarios/organizaciones";

// GET — todas las organizaciones (las que ya usaban las campañas y las que escriben los usuarios), en orden alfabético.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    return NextResponse.json({ data: await organizacionesVisibles() });
  } catch (error) {
    console.error("Error leyendo el catálogo de organizaciones", error);
    return NextResponse.json({ error: "No se pudieron cargar las organizaciones" }, { status: 500 });
  }
}
