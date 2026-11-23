// /api/campanas/[id]/inscripcion — inscribirse a una campaña para aportar (2026-10-15): acepta una sola
// vez el acuerdo de confirmación y el de uso del aporte. Lo usa components/ui/AcuerdosDeAporte desde
// /campanas/[id] y /campanas/[id]/aportar. Reglas en lib/campanas/inscripciones.ts.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { inscribir } from "@/lib/campanas/inscripciones";
import { SIN_ROL_DE_APORTADOR, puedeAportar } from "@/lib/usuarios/rol-asignable";

// POST { aceptaUso: "si", confirmaContenido: "si" }: campaña activa o pausada, sin ser su creador ni estar baneado.
// Sin el rol de aportador (2026-11-22, lo quita el SuperUsuario): 403.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    if (!puedeAportar(user.role)) return NextResponse.json({ error: SIN_ROL_DE_APORTADOR }, { status: 403 });

    const { id } = await context.params;
    const campanaId = Number(id);
    if (!Number.isInteger(campanaId)) {
      return NextResponse.json({ error: "El id de la campaña es inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const resultado = await inscribir({
      campanaId,
      usuarioId: Number(user.id),
      acuerdos: body && typeof body === "object" ? body : {},
    });
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });

    return NextResponse.json({ message: "Te inscribiste a la campaña", data: { inscrito: true } });
  } catch (error) {
    console.error("Error inscribiendo a una campaña", error);
    return NextResponse.json({ error: "No se pudo completar la inscripción" }, { status: 500 });
  }
}
