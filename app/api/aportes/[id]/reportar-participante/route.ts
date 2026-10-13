// /api/aportes/[id]/reportar-participante — el creador de la campaña o un revisor reporta a la plataforma
// a quien envió el aporte (2026-10-12). Va a la bandeja del SuperUsuario (/reportes), que lo descarta o
// lo confirma con un aviso. Quien aportó no se entera del reporte. No confundir con /reportar ("Reportar
// al creador" del revisor). Lo usan /mis-campanas/[id]/aportes/[aporteId] y /revisiones/[aporteId].
// Reglas en lib/reportes/reportes.ts.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { reportarParticipante } from "@/lib/reportes/reportes";

// POST { motivo?, descripcion? }: creador o revisor aceptado; solo aportes con cuenta. Motivo de
// MOTIVOS_DE_REPORTE_DE_APORTE y/o descripción. Uno por persona y aporte (409 si ya lo reportó).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const resultado = await reportarParticipante({
      aporteId: Number(id),
      usuarioId: Number(user.id),
      motivo: body.motivo,
      descripcion: body.descripcion,
    });
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });

    return NextResponse.json({ message: "Reporte enviado. El equipo de DataForGood lo revisará." }, { status: 201 });
  } catch (error) {
    console.error("Error reportando participante", error);
    return NextResponse.json({ error: "No se pudo enviar el reporte" }, { status: 500 });
  }
}
