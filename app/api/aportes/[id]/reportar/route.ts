// /api/aportes/[id]/reportar — "Reportar a supervisión": el revisor reporta a quien envió un aporte. Entra a
// la bandeja de Reportes y avisa solo a los supervisores, no al creador de la campaña (2026-10-15).
// No banea ni cambia el estado. Lo usa /revisiones/[aporteId]. Reglas en lib/aportes/reporte.ts.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { reportarASupervision } from "@/lib/aportes/reporte";

// POST { motivo }: revisor aceptado de la campaña (no el creador), aporte con cuenta. Uno por aporte (409 si ya se reportó).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const resultado = await reportarASupervision({
      aporteId: Number(id),
      revisor: { id: Number(user.id), nombre: `${user.nombre ?? ""} ${user.apellidos ?? ""}`.trim() || "Un revisor" },
      motivo: body.motivo,
    });
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });

    return NextResponse.json({ message: "Reporte enviado a supervisión" });
  } catch (error) {
    console.error("Error reportando aporte a supervisión", error);
    return NextResponse.json({ error: "No se pudo enviar el reporte" }, { status: 500 });
  }
}
