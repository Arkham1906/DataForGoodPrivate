// /api/notificaciones/[id] — marcar o borrar una notificación propia (lib/notificaciones/notificaciones.ts).
// Lo usan components/layout/NotificationsBell y la página /notificaciones.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { borrarNotificacion, marcarNotificacion } from "@/lib/notificaciones/notificaciones";

// PATCH { "leida": true | false } — marca la notificación como leída o no leída.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.leida !== "boolean") {
      return NextResponse.json({ error: "leida debe ser true o false" }, { status: 400 });
    }

    if (!(await marcarNotificacion(id, user.id, body.leida))) {
      return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ message: body.leida ? "Marcada como leída" : "Marcada como no leída" });
  } catch (error) {
    console.error("Error marcando notificación", error);
    return NextResponse.json({ error: "No se pudo actualizar la notificación" }, { status: 500 });
  }
}

// DELETE — borra la notificación. Una invitación de revisor sin aceptar no se puede borrar (409).
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const { id } = await context.params;
    const resultado = await borrarNotificacion(id, user.id);
    if (resultado === "no-existe") {
      return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 });
    }
    if (resultado === "invitacion-pendiente") {
      return NextResponse.json({ error: "Una invitación sin aceptar no se puede borrar" }, { status: 409 });
    }
    return NextResponse.json({ message: "Notificación eliminada" });
  } catch (error) {
    console.error("Error borrando notificación", error);
    return NextResponse.json({ error: "No se pudo borrar la notificación" }, { status: 500 });
  }
}
