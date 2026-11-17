// /api/progreso/celebraciones — celebraciones de rango y de medalla de quien tiene la sesión (2026-11-16; RF-GAM-84).
// Las pide components/gamificacion/celebraciones/Celebraciones al cargar la app, al llegar un aviso en vivo y después
// de enviar un aporte. Cada persona ve y marca solo las suyas.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { marcarCelebracionesVistas, obtenerCelebracionesPendientes } from "@/lib/gamificacion/celebraciones";

// GET: las pendientes.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
  return NextResponse.json(await obtenerCelebracionesPendientes(user.id));
}

const ids = (valor: unknown): number[] =>
  Array.isArray(valor) ? valor.filter((v): v is number => Number.isInteger(v) && v > 0).slice(0, 200) : [];

// POST { rangos: [ids de rango_ascensos], medallas: [ids de medalla_ascensos] }: las marca vistas.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    const cuerpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await marcarCelebracionesVistas(user.id, { rangos: ids(cuerpo.rangos), medallas: ids(cuerpo.medallas) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error marcando celebraciones vistas", error);
    return NextResponse.json({ error: "No se pudieron marcar las celebraciones" }, { status: 500 });
  }
}
