// /api/aportes/[id]/inapropiado — marcar un aporte ANÓNIMO como contenido inapropiado.
// El creador o un revisor aceptado, solo mientras el aporte no tenga decisión (aceptado o rechazado
// ya no se toca). También se marca al rechazar, con PATCH /api/aportes/[id] { inapropiado: true };
// esta ruta marca sin cambiar el estado. Lo usa /revisiones/[aporteId].
// Reglas y bloqueo global en lib/aportes/sanciones-anonimas.ts.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { marcarInapropiado } from "@/lib/aportes/sanciones-anonimas";

// POST (sin cuerpo): creador o revisor aceptado de la campaña, aporte anónimo sin decisión.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });

    const { rows } = await pool.query(
      `SELECT a.user_id, c.creator_id,
              EXISTS (SELECT 1 FROM campana_revisores r
                      WHERE r.campana_id = a.campaign_id AND r.usuario_id = $2 AND r.estado = 'aceptado') AS es_revisor
       FROM aportes a JOIN campanas c ON c.id = a.campaign_id
       WHERE a.id = $1`,
      [id, user.id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });
    const row = rows[0];
    if (Number(row.creator_id) !== Number(user.id) && !row.es_revisor) {
      return NextResponse.json({ error: "Solo el creador o un revisor aceptado puede marcar este aporte" }, { status: 403 });
    }
    if (row.user_id != null) {
      return NextResponse.json({ error: "Solo un aporte anónimo se marca como inapropiado" }, { status: 400 });
    }

    const resultado = await marcarInapropiado(Number(id), Number(user.id), { soloSinDecision: true });
    if (resultado.decidido) {
      return NextResponse.json({ error: "Un aporte aceptado o rechazado ya no se puede marcar" }, { status: 409 });
    }
    if (!resultado.ok) return NextResponse.json({ error: "Solo un aporte anónimo se marca como inapropiado" }, { status: 400 });

    return NextResponse.json({
      message: resultado.bloqueoGlobal
        ? "Marcado como inapropiado. Ese dispositivo quedó bloqueado en toda la plataforma."
        : "Marcado como inapropiado",
      data: { inapropiado: true, bloqueoGlobal: resultado.bloqueoGlobal },
    });
  } catch (error) {
    console.error("Error marcando aporte como inapropiado", error);
    return NextResponse.json({ error: "No se pudo marcar el aporte" }, { status: 500 });
  }
}
