// /api/campanas/[id]/guardar — favoritos (tabla campanas_guardadas). Lo usa /campanas/[id].

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { actualizarMisiones } from "@/lib/gamificacion/misiones";
import { getSessionUser } from "@/lib/session";

function parseCampaignId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

// POST /api/campanas/:id/guardar — marca la campaña como guardada por el usuario en sesión.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }

    const { id } = await context.params;
    const campaignId = parseCampaignId(id);
    if (campaignId === null) {
      return NextResponse.json({ error: "El id de la campaña es inválido" }, { status: 400 });
    }

    const campana = await pool.query(`SELECT id FROM campanas WHERE id = $1`, [campaignId]);
    if (campana.rowCount === 0) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    await pool.query(
      `INSERT INTO campanas_guardadas (usuario_id, campana_id)
        VALUES ($1, $2)
        ON CONFLICT (usuario_id, campana_id) DO NOTHING`,
      [user.id, campaignId]
    );
    await actualizarMisiones(user.id);

    return NextResponse.json({ data: { isSaved: true } });
  } catch (error) {
    console.error("Error guardando campaña", error);
    return NextResponse.json({ error: "No se pudo guardar la campaña" }, { status: 500 });
  }
}

// DELETE /api/campanas/:id/guardar — quita la campaña de las guardadas del usuario en sesión.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }

    const { id } = await context.params;
    const campaignId = parseCampaignId(id);
    if (campaignId === null) {
      return NextResponse.json({ error: "El id de la campaña es inválido" }, { status: 400 });
    }

    await pool.query(
      `DELETE FROM campanas_guardadas WHERE usuario_id = $1 AND campana_id = $2`,
      [user.id, campaignId]
    );

    return NextResponse.json({ data: { isSaved: false } });
  } catch (error) {
    console.error("Error quitando campaña guardada", error);
    return NextResponse.json({ error: "No se pudo quitar la campaña guardada" }, { status: 500 });
  }
}
