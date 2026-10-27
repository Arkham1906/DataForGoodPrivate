// GET /api/campanas/[id]/metricas — "Métricas generales" del panel de la campaña (2026-10-27):
// según su temática, tipos de dato, ubicación y checklists, y cómo llegan y se revisan sus aportes
// (lib/campanas/metricas-generales.ts). Solo el creador: es su panel (/mis-campanas/[id]/panel).
// Los paneles de supervisión leen la misma función en el servidor, con su propia verificación.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { obtenerMetricasGenerales } from "@/lib/campanas/metricas-generales";

// GET — las métricas generales de una campaña propia.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

    const dueno = await pool.query<{ creator_id: number }>(`SELECT creator_id FROM campanas WHERE id = $1`, [id]);
    if (dueno.rowCount === 0) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    if (Number(dueno.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo quien creó la campaña ve sus estadísticas" }, { status: 403 });
    }

    const metricas = await obtenerMetricasGenerales(id);
    if (!metricas) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    return NextResponse.json({ data: metricas });
  } catch (error) {
    console.error("Error leyendo las métricas generales de la campaña", error);
    return NextResponse.json({ error: "No se pudieron cargar las métricas" }, { status: 500 });
  }
}
