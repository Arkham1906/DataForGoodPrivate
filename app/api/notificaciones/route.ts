// /api/notificaciones — notificaciones del usuario (lib/notificaciones/notificaciones.ts).
// Lo usan components/layout/NotificationsBell y la página /notificaciones.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { limpiarNotificaciones, listarNotificaciones, marcarTodasComoLeidas } from "@/lib/notificaciones/notificaciones";

// GET ?pagina=1&porPagina=20&filtro=todas|no-leidas — una página de notificaciones y el total sin leer.
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const pagina = Number(params.get("pagina") ?? 1);
    const porPagina = Number(params.get("porPagina") ?? 20);
    const filtro = params.get("filtro") ?? "todas";
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10_000) {
      return NextResponse.json({ error: "pagina debe ser un entero positivo" }, { status: 400 });
    }
    if (!Number.isInteger(porPagina) || porPagina < 1 || porPagina > 50) {
      return NextResponse.json({ error: "porPagina debe estar entre 1 y 50" }, { status: 400 });
    }
    if (filtro !== "todas" && filtro !== "no-leidas") {
      return NextResponse.json({ error: "filtro debe ser todas o no-leidas" }, { status: 400 });
    }

    return NextResponse.json(await listarNotificaciones(user.id, { pagina, porPagina, filtro }));
  } catch (error) {
    console.error("Error listando notificaciones", error);
    return NextResponse.json({ error: "No se pudieron cargar las notificaciones" }, { status: 500 });
  }
}

// PATCH { "leidas": "todas" } — marca como leídas todas las notificaciones del usuario.
export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (body.leidas !== "todas") {
      return NextResponse.json({ error: 'Envía { "leidas": "todas" }' }, { status: 400 });
    }

    const marcadas = await marcarTodasComoLeidas(user.id);
    return NextResponse.json({ message: "Notificaciones marcadas como leídas", marcadas });
  } catch (error) {
    console.error("Error marcando notificaciones", error);
    return NextResponse.json({ error: "No se pudieron marcar las notificaciones" }, { status: 500 });
  }
}

// DELETE — "Limpiar": borra las leídas y las de más de DIAS_PARA_NOTIFICACION_VIEJA días
// (lib/notificaciones/tipos.ts), menos una invitación de revisor sin aceptar.
export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const borradas = await limpiarNotificaciones(user.id);
    return NextResponse.json({ message: "Notificaciones limpiadas", borradas });
  } catch (error) {
    console.error("Error limpiando notificaciones", error);
    return NextResponse.json({ error: "No se pudieron limpiar las notificaciones" }, { status: 500 });
  }
}
