// /api/auth/verificar — verificación del correo con código de 6 dígitos (lib/verification.ts).
// La cuenta pendiente se identifica por la ficha al azar de la cookie verificacion_pendiente
// (2026-11-20; antes pending_verification_id con el id). Lo usa /verificar.

import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { getPendingVerification, verifyCode, clearPendingVerificationCookie } from "@/lib/verification";
import { respuestaDeLimite, segundosDeBloqueo, sumarAlLimite } from "@/lib/limite-por-ip";

// GET: correo al que se envió el código (para mostrarlo en /verificar).
export async function GET() {
  try {
    const pending = await getPendingVerification();

    if (!pending) {
      return NextResponse.json({ error: "No hay verificación pendiente" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        email: pending.email,
        expiresAt: pending.expiresAt,
        attemptsLeft: pending.attemptsLeft,
        resendAvailableAt: pending.resendAvailableAt,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo obtener la verificación" }, { status: 500 });
  }
}

// POST: valida el código. Si es correcto, marca la cuenta como verificada y abre sesión.
// Tope por IP de códigos equivocados (2026-11-20, lib/limite-por-ip.ts).
export async function POST(request: Request) {
  const bloqueo = segundosDeBloqueo("verificar", request.headers);
  if (bloqueo !== null) return respuestaDeLimite(bloqueo);

  try {
    const pending = await getPendingVerification();

    if (!pending) {
      return NextResponse.json({ error: "No hay verificación pendiente" }, { status: 404 });
    }

    const body = await request.json();
    const code = String(body.code ?? "").trim();

    if (!code) {
      return NextResponse.json({ error: "El código es obligatorio" }, { status: 400 });
    }

    // Con una verificación señuelo (registro con un correo que ya tiene cuenta) nunca acierta.
    const result = await verifyCode(pending, code);

    if (!result.success || pending.id === null) {
      sumarAlLimite("verificar", request.headers);
      return NextResponse.json(
        result.success
          ? { error: "Código incorrecto", attemptsLeft: 0 }
          : { error: result.error, attemptsLeft: result.attemptsLeft },
        { status: 400 }
      );
    }

    await clearPendingVerificationCookie();
    await createSession(pending.id);

    return NextResponse.json({ message: "Correo verificado" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo verificar el código" }, { status: 500 });
  }
}
