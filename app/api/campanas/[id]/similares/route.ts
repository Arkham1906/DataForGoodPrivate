// GET /api/campanas/[id]/similares — las demás campañas de la misma temática, para decidir si una en
// revisión se acepta o se rechaza (2026-11-04, lib/supervision/similares.ts). Solo el rol de supervisor; el SuperUsuario
// las lee en el servidor, en /supervisar/[campaignId].

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { obtenerCampanasSimilares } from "@/lib/supervision/similares";

// GET — campañas similares a una en revisión.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const roles = Array.isArray(user.role) ? user.role : typeof user.role === "string" ? [user.role] : [];
    if (!roles.includes("supervisor")) {
      return NextResponse.json({ error: "Solo un supervisor puede ver las campañas similares" }, { status: 403 });
    }

    const { id } = await context.params;
    const similares = await obtenerCampanasSimilares(id);
    if (!similares) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    return NextResponse.json({ data: similares });
  } catch (error) {
    console.error("Error leyendo campañas similares", error);
    return NextResponse.json({ error: "No se pudieron cargar las campañas similares" }, { status: 500 });
  }
}
