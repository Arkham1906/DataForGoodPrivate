// /api/push — suscripción de este navegador o teléfono a las notificaciones push (lib/notificaciones/push.ts).
// Lo usa components/notificaciones/AvisosEnEsteDispositivo (página /notificaciones), la campana al cargar
// (para que la suscripción siga a nombre de quien tiene la sesión) y LogoutButton (la quita al salir).

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { borrarSuscripcion, guardarSuscripcion, llavePublicaDePush } from "@/lib/notificaciones/push";

// GET — la llave pública VAPID para suscribirse. publicKey es null si push no está configurado.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
  return NextResponse.json({ publicKey: llavePublicaDePush() });
}

// POST { subscription } — guarda la suscripción del navegador (PushSubscription.toJSON()) a nombre de esta persona.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const error = await guardarSuscripcion(user.id, body.subscription, request.headers.get("user-agent"));
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ message: "Avisos activados en este dispositivo" }, { status: 201 });
  } catch (error) {
    console.error("Error guardando suscripción push", error);
    return NextResponse.json({ error: "No se pudieron activar los avisos" }, { status: 500 });
  }
}

// DELETE { endpoint } — quita la suscripción de este navegador.
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    await borrarSuscripcion(user.id, body.endpoint);
    return NextResponse.json({ message: "Avisos desactivados en este dispositivo" });
  } catch (error) {
    console.error("Error borrando suscripción push", error);
    return NextResponse.json({ error: "No se pudieron desactivar los avisos" }, { status: 500 });
  }
}
