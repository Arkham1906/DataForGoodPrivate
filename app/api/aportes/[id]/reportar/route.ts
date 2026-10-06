// /api/aportes/[id]/reportar — "Reportar al creador": el revisor avisa al creador de la campaña que un
// aporte o quien lo envió merece una sanción. No banea ni cambia el estado: eso lo decide el creador.
// Lo usa /revisiones/[aporteId]. Reglas en lib/aportes/reporte.ts.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { reportarAlCreador } from "@/lib/aportes/reporte";

// POST { motivo }: revisor aceptado de la campaña (no el creador). Uno por aporte (409 si ya se reportó).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const resultado = await reportarAlCreador({
      aporteId: Number(id),
      revisor: { id: Number(user.id), nombre: `${user.nombre ?? ""} ${user.apellidos ?? ""}`.trim() || "Un revisor" },
      motivo: body.motivo,
    });
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });

    return NextResponse.json({ message: "Aviso enviado a quien creó la campaña" });
  } catch (error) {
    console.error("Error reportando aporte al creador", error);
    return NextResponse.json({ error: "No se pudo enviar el reporte" }, { status: 500 });
  }
}
