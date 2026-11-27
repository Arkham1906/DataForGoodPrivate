// PATCH /api/progreso/lideres { apareceEnLideres: boolean } — si la persona con sesión aparece en las tablas de
// líderes y en la landing (RF-GAM-95). Lo usa el interruptor de Mi cuenta (AparecerEnLideres.tsx).

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { guardarAparecerEnLideres } from "@/lib/gamificacion/clasificacion";

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.apareceEnLideres !== "boolean" || Object.keys(body).length !== 1) {
      return NextResponse.json({ error: "Manda solo { apareceEnLideres: true | false }" }, { status: 400 });
    }
    await guardarAparecerEnLideres(Number(user.id), body.apareceEnLideres);
    return NextResponse.json({ apareceEnLideres: body.apareceEnLideres });
  } catch (error) {
    console.error("Error guardando si aparece en Líderes", error);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
