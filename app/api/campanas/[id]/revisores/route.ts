// /api/campanas/[id]/revisores — revisores de una campaña (tabla campana_revisores). Solo el creador.
// Lo usan /mis-campanas/[id]/aportes/agregar-revisor y /mis-campanas/[id]/aportes/revisores.
// Sin límite de revisores por campaña (2026-10-22, a pedido del usuario: la bandeja dejaba de
// ofrecer "Agregar revisor" con el primero).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { quitarRevisor } from "@/lib/campanas/revisores";

// La invitación a revisor es por campaña (campana_revisores), no por el rol
// global en usuarios.role: esta lista es lo que debe usar la pantalla de
// "Agregar revisor" para saber a quién ya se invitó/aceptó en ESTA campaña,
// en vez del rol global (eso bloqueaba invitar a alguien que ya es revisor
// de OTRA campaña, o que tiene el rol por una asignación vieja).
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const campaign = await pool.query(`SELECT creator_id FROM campanas WHERE id = $1 LIMIT 1`, [id]);
    if (campaign.rowCount === 0) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    if (Number(campaign.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo el creador puede ver los revisores" }, { status: 403 });
    }

    // Desde el 2026-10-22 también nombre, fechas y cuántos aportes decidió cada uno
    // (aportes.first_pass_by_user_id), para /mis-campanas/[id]/aportes/revisores. Sin correo.
    const result = await pool.query<{
      usuario_id: number;
      estado: string;
      nombre: string;
      apellidos: string;
      invitado_en: Date;
      aceptado_en: Date | null;
      revisados: number;
    }>(
      `SELECT r.usuario_id, r.estado, u.nombre, u.apellidos, r.invitado_en, r.aceptado_en,
              (SELECT COUNT(*)::int FROM aportes a
                WHERE a.campaign_id = r.campana_id AND a.first_pass_by_user_id = r.usuario_id
                  AND a.status IN ('aceptado', 'rechazado')) AS revisados
       FROM campana_revisores r JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.campana_id = $1
       ORDER BY r.estado = 'aceptado' DESC, r.estado = 'invitado' DESC, r.invitado_en DESC`,
      [id]
    );

    return NextResponse.json({
      data: result.rows.map((row) => ({
        usuarioId: String(row.usuario_id),
        estado: row.estado,
        nombre: `${row.nombre} ${row.apellidos}`.trim(),
        invitadoEn: row.invitado_en.toISOString(),
        aceptadoEn: row.aceptado_en ? row.aceptado_en.toISOString() : null,
        revisados: row.revisados,
      })),
    });
  } catch (error) {
    console.error("Error listando revisores de la campaña", error);
    return NextResponse.json({ error: "No se pudieron listar los revisores" }, { status: 500 });
  }
}

// POST: invita a un usuario como revisor (le llega una notificación). Solo el creador.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const usuarioId = Number(body.usuarioId ?? body.userId);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return NextResponse.json({ error: "usuarioId es obligatorio" }, { status: 400 });
    }

    const campaign = await pool.query(
      `SELECT id, name, creator_id FROM campanas WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (campaign.rowCount === 0) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    if (Number(campaign.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo el creador puede invitar revisores" }, { status: 403 });
    }
    if (usuarioId === Number(user.id) || usuarioId === Number(campaign.rows[0].creator_id)) {
      return NextResponse.json({ error: "No puedes invitar al creador de la campaña" }, { status: 400 });
    }

    const candidate = await pool.query(`SELECT id, nombre, apellidos, role FROM usuarios WHERE id = $1 LIMIT 1`, [usuarioId]);
    if (candidate.rowCount === 0) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const existing = await pool.query(
      `SELECT estado FROM campana_revisores WHERE campana_id = $1 AND usuario_id = $2 LIMIT 1`,
      [id, usuarioId]
    );
    if (existing.rowCount && existing.rows[0].estado === "aceptado") {
      return NextResponse.json({ error: "Este usuario ya es revisor de la campaña" }, { status: 409 });
    }

    await pool.query(
      `INSERT INTO campana_revisores (campana_id, usuario_id, estado, invitado_en, aceptado_en)
       VALUES ($1, $2, 'invitado', NOW(), NULL)
       ON CONFLICT (campana_id, usuario_id)
       DO UPDATE SET estado = 'invitado', invitado_en = NOW(), aceptado_en = NULL`,
      [id, usuarioId]
    );

    await notificar({
      usuarioId,
      tipo: "invitacion_revisor",
      titulo: "Invitación para revisar aportes",
      mensaje: `Te invitaron a ser revisor de aportes en la campaña "${campaign.rows[0].name}".`,
      campanaId: id,
      metadata: { campanaId: String(id) },
    });

    await registrarAuditoria({
      actor: { tipo: "usuario", id: Number(user.id) },
      accion: "revisor.invitar",
      objetivo: { tipo: "usuario", id: usuarioId },
      detalle: { campanaId: Number(id) },
    });

    return NextResponse.json({ message: "Invitación enviada" }, { status: 201 });
  } catch (error) {
    console.error("Error invitando revisor", error);
    return NextResponse.json({ error: "No se pudo enviar la invitación" }, { status: 500 });
  }
}

// DELETE ?usuarioId=: quita a un revisor o cancela su invitación pendiente (2026-10-22). Solo el
// creador. Reglas en lib/campanas/revisores.ts. Al revisor quitado le llega un aviso.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const usuarioId = Number(new URL(request.url).searchParams.get("usuarioId"));
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return NextResponse.json({ error: "usuarioId es obligatorio" }, { status: 400 });
    }

    const campaign = await pool.query(`SELECT creator_id FROM campanas WHERE id = $1 LIMIT 1`, [id]);
    if (campaign.rowCount === 0) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    if (Number(campaign.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo el creador puede quitar revisores" }, { status: 403 });
    }

    const resultado = await quitarRevisor(Number(id), usuarioId);
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });

    const quitado = resultado.estadoAnterior === "aceptado";
    await registrarAuditoria({
      actor: { tipo: "usuario", id: Number(user.id) },
      accion: quitado ? "revisor.quitar" : "revisor.cancelar_invitacion",
      objetivo: { tipo: "usuario", id: usuarioId },
      detalle: { campanaId: Number(id) },
    });
    if (quitado) {
      await notificar({
        usuarioId,
        tipo: "revisor_quitado",
        titulo: "Ya no revisas aportes de una campaña",
        mensaje: `Quien organiza "${resultado.nombreDeCampana}" te quitó como revisor de aportes. Los aportes que ya revisaste se conservan.`,
        campanaId: id,
      });
    }

    return NextResponse.json({ message: quitado ? "Revisor quitado" : "Invitación cancelada" });
  } catch (error) {
    console.error("Error quitando revisor", error);
    return NextResponse.json({ error: "No se pudo quitar al revisor" }, { status: 500 });
  }
}
