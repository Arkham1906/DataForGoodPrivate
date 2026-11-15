// /api/progreso/exp-por-tipo — EXP que puede dar un aporte aceptado de cada tipo (RF-GAM-01 a 03). La pide
// components/gamificacion/ExpPorAporte al abrir su recuadro, en el detalle de una campaña. Solo lectura y con sesión.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { obtenerExpPorTipo } from "@/lib/gamificacion/exp-por-tipo";

// GET ?tipos=texto,foto — sin tipos, los cinco.
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const tipos = (new URL(request.url).searchParams.get("tipos") ?? "").split(",").map((t) => t.trim());
    const datos = await obtenerExpPorTipo(tipos);
    if (!datos) return NextResponse.json({ error: "La EXP no está disponible por ahora" }, { status: 503 });
    return NextResponse.json(datos);
  } catch (error) {
    console.error("Error leyendo la EXP por tipo de aporte", error);
    return NextResponse.json({ error: "No se pudo cargar la EXP" }, { status: 500 });
  }
}
