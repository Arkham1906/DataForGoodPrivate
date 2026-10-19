// /api/aportes/[id]/reportar — "Reportar a supervisión": el revisor o el creador (2026-10-19) reportan a quien
// envió un aporte. Entra a la bandeja de Reportes y avisa a los supervisores, no al creador de la campaña
// (2026-10-15). Desde el 2026-10-19 rechaza el aporte (salvo en una campaña ya finalizada); no banea.
// Lo usa /revisiones/[aporteId]. Reglas en lib/aportes/reporte.ts.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { reportarASupervision } from "@/lib/aportes/reporte";

// POST { motivo }: revisor aceptado o creador de la campaña, aporte con cuenta. Uno por aporte (409 si ya se reportó).
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

    return NextResponse.json({
      message: resultado.rechazado ? "Reporte enviado a supervisión. El aporte quedó rechazado." : "Reporte enviado a supervisión",
    });
  } catch (error) {
    console.error("Error reportando aporte a supervisión", error);
    return NextResponse.json({ error: "No se pudo enviar el reporte" }, { status: 500 });
  }
}
