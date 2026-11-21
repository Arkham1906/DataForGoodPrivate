// POST /api/auth/verificar/reenviar — genera y envía un código nuevo. Lo usa /verificar.
// Desde el 2026-11-20 respeta la espera entre envíos y el tope por hora de lib/verification.ts:
// si no toca mandar otro, responde 429 con el mensaje y los segundos que faltan, y el último
// código que llegó sigue valiendo (sus intentos no se reinician).

import { NextResponse } from "next/server";
import { getPendingVerification, mensajeDeEnvioDetenido, reenviarCodigo } from "@/lib/verification";
import { contarPeticion, respuestaDeLimite } from "@/lib/limite-por-ip";

// Además del tope por cuenta, uno por IP que cuenta cada petición (2026-11-20, lib/limite-por-ip.ts).
export async function POST(request: Request) {
  const bloqueo = contarPeticion("reenviar", request.headers);
  if (bloqueo !== null) return respuestaDeLimite(bloqueo);

  try {
    const pending = await getPendingVerification();

    if (!pending) {
      return NextResponse.json({ error: "No hay verificación pendiente" }, { status: 404 });
    }

    // Con una señuelo cuenta la espera igual, sin mandar nada (lib/verification.ts).
    const resultado = await reenviarCodigo(pending);

    if (!resultado.enviado) {
      return NextResponse.json(
        {
          error: mensajeDeEnvioDetenido(resultado),
          esperaSegundos: resultado.segundos,
          data: { resendAvailableAt: resultado.resendAvailableAt },
        },
        { status: 429, headers: { "Retry-After": String(resultado.segundos) } }
      );
    }

    return NextResponse.json(
      {
        message: "Código reenviado",
        data: { expiresAt: resultado.expiresAt, resendAvailableAt: resultado.resendAvailableAt },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo reenviar el código" }, { status: 500 });
  }
}
