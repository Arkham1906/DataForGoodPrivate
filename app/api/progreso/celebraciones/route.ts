// /api/progreso/celebraciones — celebraciones de rango y de medalla de quien tiene la sesión (2026-11-16; RF-GAM-84).
// Las pide components/gamificacion/celebraciones/Celebraciones al cargar la app, al llegar un aviso en vivo y después
// de enviar un aporte. Cada persona ve y marca solo las suyas.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { marcarCelebracionesVistas, obtenerCelebracionesPendientes } from "@/lib/gamificacion/celebraciones";
import { decidirObjeto } from "@/lib/gamificacion/inventario";

// GET: las pendientes.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
  return NextResponse.json(await obtenerCelebracionesPendientes(user.id));
}

const idsDeTexto = (valor: unknown): string[] =>
  Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string" && /^\d{1,18}$/.test(v)).slice(0, 200) : [];

const ids = (valor: unknown): number[] =>
  Array.isArray(valor) ? valor.filter((v): v is number => Number.isInteger(v) && v > 0).slice(0, 200) : [];

// POST { rangos: [ids de rango_ascensos], medallas: [ids de medalla_ascensos], objetos: [ids de mision_instancias] }: las
// marca vistas.
// POST { objeto: { instancia, accion: "cambiar" | "rechazar" } }: la respuesta a «ya tienes el máximo» (2026-11-19).
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    const cuerpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const objeto = cuerpo.objeto as { instancia?: unknown; accion?: unknown } | undefined;
    if (objeto) {
      const instancia = typeof objeto.instancia === "string" && /^\d{1,18}$/.test(objeto.instancia) ? objeto.instancia : null;
      const accion = objeto.accion === "cambiar" || objeto.accion === "rechazar" ? objeto.accion : null;
      if (!instancia || !accion) return NextResponse.json({ error: "Decisión no válida" }, { status: 400 });
      const resultado = await decidirObjeto(user.id, instancia, accion);
      if (!resultado) return NextResponse.json({ error: "Ya no hay nada que decidir" }, { status: 409 });
      return NextResponse.json({ resultado });
    }
    await marcarCelebracionesVistas(user.id, { rangos: ids(cuerpo.rangos), medallas: ids(cuerpo.medallas), objetos: idsDeTexto(cuerpo.objetos) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error marcando celebraciones vistas", error);
    return NextResponse.json({ error: "No se pudieron marcar las celebraciones" }, { status: 500 });
  }
}
