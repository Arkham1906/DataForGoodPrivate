// /api/campanas/[id]/reportar — reportar una campaña (2026-10-12). El reporte va contra quien la creó y
// llega a la bandeja del SuperUsuario (/reportes), que lo descarta o lo confirma con un aviso. El creador
// no se entera del reporte. Lo usa /campanas/[id]. Reglas en lib/reportes/reportes.ts.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { reportarCampana } from "@/lib/reportes/reportes";

// POST { motivo?, descripcion? }: cualquier persona con sesión salvo el creador. Motivo de la lista
// (MOTIVOS_DE_REPORTE_DE_CAMPANA) y/o descripción. Uno por persona y campaña (409 si ya la reportó).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const resultado = await reportarCampana({
      campanaId: Number(id),
      usuarioId: Number(user.id),
      motivo: body.motivo,
      descripcion: body.descripcion,
    });
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });

    return NextResponse.json({ message: "Gracias. El equipo de DataForGood revisará tu reporte." }, { status: 201 });
  } catch (error) {
    console.error("Error reportando campaña", error);
    return NextResponse.json({ error: "No se pudo enviar el reporte" }, { status: 500 });
  }
}
