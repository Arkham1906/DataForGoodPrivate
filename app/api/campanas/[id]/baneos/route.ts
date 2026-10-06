// /api/campanas/[id]/baneos — baneos de participantes en esta campaña (lib/campanas/baneos.ts).
// Solo el creador. Lo usan el detalle del aporte y la sección de baneados de la bandeja.
// Un aporte anónimo no tiene cuenta: "banear" bloquea su dispositivo en la campaña
// (lib/aportes/sanciones-anonimas.ts).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { listarBaneadosDeCampana, quitarBaneoDeCampana } from "@/lib/campanas/baneos";
import {
  bloquearEnCampana,
  desbloquearEnCampana,
  listarDispositivosBloqueadosDeCampana,
} from "@/lib/aportes/sanciones-anonimas";

/** Solo quien creó la campaña administra sus baneos. Devuelve la respuesta de error, o null si puede. */
async function exigirCreador(campaignId: string, user: SessionUser | null): Promise<NextResponse | null> {
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
  const result = await pool.query(`SELECT creator_id FROM campanas WHERE id = $1 LIMIT 1`, [campaignId]);
  if (!result.rowCount) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  if (Number(result.rows[0].creator_id) !== Number(user.id)) {
    return NextResponse.json({ error: "Solo el dueño de la campaña puede ver o quitar baneos" }, { status: 403 });
  }
  return null;
}

// GET: participantes baneados (data) y dispositivos anónimos bloqueados (dispositivos).
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await context.params;
    const denegado = await exigirCreador(campaignId, await getSessionUser());
    if (denegado) return denegado;

    const [baneados, dispositivos] = await Promise.all([
      listarBaneadosDeCampana(campaignId),
      listarDispositivosBloqueadosDeCampana(Number(campaignId)),
    ]);
    return NextResponse.json({ data: baneados, dispositivos });
  } catch (error) {
    console.error("Error listando baneados de campaña", error);
    return NextResponse.json({ error: "No se pudieron cargar los baneos" }, { status: 500 });
  }
}

// POST: banea a un participante de esta campaña (no de toda la app). Si el aporte es
// anónimo, bloquea el dispositivo que lo envió. Solo el creador; se puede antes o después de decidir
// el aporte, porque es una acción sobre la persona, no sobre el aporte.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const contributionId = String(body.contributionId ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    if (!contributionId || !reason) {
      return NextResponse.json({ error: "contributionId y reason son obligatorios" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT c.creator_id, c.name, a.user_id
       FROM campanas c
       JOIN aportes a ON a.campaign_id = c.id
       WHERE c.id = $1 AND a.id = $2
       LIMIT 1`,
      [campaignId, contributionId]
    );
    if (!result.rowCount) return NextResponse.json({ error: "Aporte no encontrado en esta campaña" }, { status: 404 });

    const row = result.rows[0];
    if (Number(row.creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo el dueño de la campaña puede banear participantes" }, { status: 403 });
    }
    if (row.user_id == null) {
      const bloqueado = await bloquearEnCampana({
        campanaId: Number(campaignId),
        aporteId: Number(contributionId),
        usuarioId: Number(user.id),
        motivo: reason,
      });
      if (!bloqueado) return NextResponse.json({ error: "Este aporte no tiene dispositivo que bloquear" }, { status: 400 });
      return NextResponse.json({ message: "Dispositivo bloqueado en la campaña" });
    }

    await pool.query(
      `INSERT INTO campana_baneados (campana_id, usuario_id, motivo, baneado_por)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (campana_id, usuario_id) DO UPDATE SET motivo = EXCLUDED.motivo, baneado_por = EXCLUDED.baneado_por`,
      [campaignId, row.user_id, reason, user.id]
    );

    await registrarAuditoria({
      actor: { tipo: "usuario", id: Number(user.id) },
      accion: "campana.banear",
      objetivo: { tipo: "usuario", id: Number(row.user_id) },
      detalle: { campanaId: Number(campaignId), aporteId: Number(contributionId), motivo: reason },
    });

    await notificar({
      usuarioId: row.user_id,
      tipo: "campana_baneo",
      titulo: "Ya no puedes aportar en una campaña",
      mensaje: `Quien organiza "${row.name}" te retiró de la campaña y ya no puedes enviar aportes en ella. Motivo: ${reason}`,
      campanaId: campaignId,
      enlace: `/campanas/${campaignId}`,
      metadata: { motivo: reason },
    });

    return NextResponse.json({ message: "Usuario baneado de la campaña" });
  } catch (error) {
    console.error("Error baneando usuario de campaña", error);
    return NextResponse.json({ error: "No se pudo banear al usuario de la campaña" }, { status: 500 });
  }
}
// DELETE { usuarioId } quita el baneo; { bloqueoId } desbloquea un dispositivo anónimo.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await context.params;
    const user = await getSessionUser();
    const denegado = await exigirCreador(campaignId, user);
    if (denegado) return denegado;

    const body = await request.json().catch(() => ({}));
    if (body.bloqueoId !== undefined) {
      const bloqueoId = Number(body.bloqueoId);
      if (!Number.isInteger(bloqueoId) || bloqueoId <= 0) {
        return NextResponse.json({ error: "bloqueoId no es válido" }, { status: 400 });
      }
      if (!(await desbloquearEnCampana(Number(campaignId), bloqueoId, Number(user!.id)))) {
        return NextResponse.json({ error: "Ese dispositivo no está bloqueado en esta campaña" }, { status: 404 });
      }
      return NextResponse.json({ message: "Dispositivo desbloqueado" });
    }
    const usuarioId = Number(body.usuarioId);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return NextResponse.json({ error: "usuarioId es obligatorio" }, { status: 400 });
    }

    if (!(await quitarBaneoDeCampana(campaignId, usuarioId))) {
      return NextResponse.json({ error: "Esa persona no está baneada de esta campaña" }, { status: 404 });
    }

    await registrarAuditoria({
      actor: { tipo: "usuario", id: Number(user!.id) },
      accion: "campana.desbanear",
      objetivo: { tipo: "usuario", id: usuarioId },
      detalle: { campanaId: Number(campaignId) },
    });

    const campana = await pool.query(`SELECT name FROM campanas WHERE id = $1`, [campaignId]);
    await notificar({
      usuarioId,
      tipo: "campana_desbaneo",
      titulo: "Puedes volver a aportar",
      mensaje: `Quien organiza "${campana.rows[0]?.name ?? "la campaña"}" te permitió volver a participar.`,
      campanaId: campaignId,
      enlace: `/campanas/${campaignId}`,
    });

    return NextResponse.json({ message: "Baneo quitado" });
  } catch (error) {
    console.error("Error quitando baneo de campaña", error);
    return NextResponse.json({ error: "No se pudo quitar el baneo" }, { status: 500 });
  }
}
