// POST /api/notificaciones/[id]/rechazar — rechaza una invitación de revisor (tipo invitacion_revisor;
// 2026-11-11, a pedido del usuario: antes solo se podía aceptar). Deja campana_revisores en 'rechazado'
// (el creador lo ve como "Rechazó la invitación" en /mis-campanas/[id]/aportes/revisores), borra la
// notificación de la invitación (como al cancelarla el creador: si la vuelve a invitar llega una nueva),
// lo registra en audit_log y avisa al creador con revisor_rechazo.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const { id } = await context.params;
    const notification = await pool.query<{ campana_id: number | null }>(
      `SELECT campana_id FROM notificaciones
       WHERE id = $1 AND usuario_id = $2 AND tipo = 'invitacion_revisor'
       LIMIT 1`,
      [id, user.id],
    );
    if (notification.rowCount === 0 || notification.rows[0].campana_id == null) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
    }

    const campaignId = notification.rows[0].campana_id;
    const client = await pool.connect();
    let campana: { creator_id: number; name: string } | undefined;
    try {
      await client.query("BEGIN");
      // Solo la pendiente: una ya aceptada no se rechaza aquí (la deja el creador quitándola).
      const invitation = await client.query(
        `UPDATE campana_revisores
         SET estado = 'rechazado', aceptado_en = NULL
         WHERE campana_id = $1 AND usuario_id = $2 AND estado = 'invitado'
         RETURNING id`,
        [campaignId, user.id],
      );
      if (invitation.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "La invitación ya no está disponible" }, { status: 409 });
      }
      await client.query(
        `DELETE FROM notificaciones WHERE usuario_id = $1 AND campana_id = $2 AND tipo = 'invitacion_revisor'`,
        [user.id, campaignId],
      );
      campana = (
        await client.query<{ creator_id: number; name: string }>(
          // updated_at avisa a las pantallas abiertas del creador (lista de revisores, agregar revisor).
          `UPDATE campanas SET updated_at = NOW() WHERE id = $1 RETURNING creator_id, name`,
          [campaignId],
        )
      ).rows[0];
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await registrarAuditoria({
      actor: { tipo: "usuario", id: Number(user.id) },
      accion: "revisor.rechazar",
      objetivo: { tipo: "campana", id: Number(campaignId) },
    });

    if (campana) {
      const nombre = `${user.nombre ?? ""} ${user.apellidos ?? ""}`.trim() || "La persona que invitaste";
      await notificar({
        usuarioId: campana.creator_id,
        tipo: "revisor_rechazo",
        titulo: "Invitación de revisor rechazada",
        mensaje: `${nombre} rechazó revisar los aportes de "${campana.name}". Puedes invitar a otra persona.`,
        campanaId: campaignId,
        enlace: `/mis-campanas/${campaignId}/aportes/revisores`,
      });
    }

    return NextResponse.json({ message: "Rechazaste la invitación" });
  } catch (error) {
    console.error("Error rechazando invitación de revisor", error);
    return NextResponse.json({ error: "No se pudo rechazar la invitación" }, { status: 500 });
  }
}
