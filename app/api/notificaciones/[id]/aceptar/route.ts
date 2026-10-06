// POST /api/notificaciones/[id]/aceptar — acepta una invitación de revisor (tipo invitacion_revisor).
// Marca campana_revisores como 'aceptado', lo registra en audit_log y avisa al creador.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { normalizeRoles } from "@/lib/roles";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const { id } = await context.params;
    const notification = await pool.query(
      `SELECT id, campana_id FROM notificaciones
       WHERE id = $1 AND usuario_id = $2 AND tipo = 'invitacion_revisor'
       LIMIT 1`,
      [id, user.id]
    );
    if (notification.rowCount === 0 || notification.rows[0].campana_id == null) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
    }

    const campaignId = notification.rows[0].campana_id;
    const client = await pool.connect();
    let campana: { creator_id: number; name: string } | undefined;
    try {
      await client.query("BEGIN");
      const invitation = await client.query(
        `UPDATE campana_revisores
         SET estado = 'aceptado', aceptado_en = NOW()
         WHERE campana_id = $1 AND usuario_id = $2 AND estado = 'invitado'
         RETURNING id`,
        [campaignId, user.id]
      );
      if (invitation.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "La invitación ya no está disponible" }, { status: 409 });
      }

      const roles = Array.isArray(user.role) ? user.role : [];
      const nextRoles = normalizeRoles([...roles, "revisor"]);
      await client.query(`UPDATE usuarios SET role = $2::jsonb, updated_at = NOW() WHERE id = $1`, [user.id, JSON.stringify(nextRoles)]);
      campana = (
        await client.query(
          `UPDATE campanas SET has_reviewer_assigned = true, updated_at = NOW() WHERE id = $1 RETURNING creator_id, name`,
          [campaignId]
        )
      ).rows[0];
      await client.query(`UPDATE notificaciones SET leida_en = NOW() WHERE id = $1`, [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await registrarAuditoria({
      actor: { tipo: "usuario", id: Number(user.id) },
      accion: "revisor.aceptar",
      objetivo: { tipo: "campana", id: Number(campaignId) },
    });

    if (campana) {
      const nombre = `${user.nombre ?? ""} ${user.apellidos ?? ""}`.trim() || "La persona que invitaste";
      await notificar({
        usuarioId: campana.creator_id,
        tipo: "revisor_acepto",
        titulo: "Tu campaña tiene revisor",
        mensaje: `${nombre} aceptó revisar los aportes de "${campana.name}".`,
        campanaId: campaignId,
        enlace: `/mis-campanas/${campaignId}/aportes`,
      });
    }

    return NextResponse.json({ message: "Ahora eres revisor de aportes de esta campaña" });
  } catch (error) {
    console.error("Error aceptando invitación de revisor", error);
    return NextResponse.json({ error: "No se pudo aceptar la invitación" }, { status: 500 });
  }
}
