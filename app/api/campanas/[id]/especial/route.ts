// /api/campanas/[id]/especial — incentivos de una campaña especial (SCR-WEB-13). Solo el creador.
// PUT { inicio, fin, multiplicador, insignia? } los guarda o cambia; DELETE los quita.
// Reglas en lib/campanas/especial.ts. Lo usa /mis-campanas/[id]/especial.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { guardarEspecial, quitarEspecial } from "@/lib/campanas/especial";

type Contexto = { params: Promise<{ id: string }> };

async function idYUsuario(context: Contexto) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 }) };
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: NextResponse.json({ error: "El id de la campaña es inválido" }, { status: 400 }) };
  }
  return { id, usuarioId: Number(user.id) };
}

export async function PUT(request: Request, context: Contexto) {
  try {
    const datos = await idYUsuario(context);
    if ("error" in datos) return datos.error;
    const body = await request.json().catch(() => ({}));
    const resultado = await guardarEspecial(datos.id, datos.usuarioId, body && typeof body === "object" ? body : {});
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    return NextResponse.json({ message: "Campaña especial publicada" });
  } catch (error) {
    console.error("Error guardando la campaña especial", error);
    return NextResponse.json({ error: "No se pudo guardar la campaña especial" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Contexto) {
  try {
    const datos = await idYUsuario(context);
    if ("error" in datos) return datos.error;
    const resultado = await quitarEspecial(datos.id, datos.usuarioId);
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    return NextResponse.json({ message: "Se quitaron los incentivos" });
  } catch (error) {
    console.error("Error quitando la campaña especial", error);
    return NextResponse.json({ error: "No se pudieron quitar los incentivos" }, { status: 500 });
  }
}
