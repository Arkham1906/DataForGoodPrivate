// POST /api/auth/recuperar — pide el código para recuperar la contraseña. Lo usa /recuperar.
// Responde lo mismo exista o no la cuenta, y el código se genera y se envía después de
// responder (after), así que ni el mensaje ni el tiempo de respuesta revelan qué correos
// tienen cuenta. Lógica en lib/usuarios/recuperacion.ts.

import { after, NextResponse } from "next/server";
import { isValidEmail } from "@/lib/validation";
import { solicitarRecuperacion } from "@/lib/usuarios/recuperacion";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "El correo es obligatorio" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "El correo no tiene un formato válido" }, { status: 400 });
  }

  after(async () => {
    try {
      await solicitarRecuperacion(email);
    } catch (error) {
      console.error("POST /api/auth/recuperar:", error);
    }
  });

  return NextResponse.json({
    message: "Si el correo tiene una cuenta, le enviamos un código para recuperar la contraseña.",
  });
}
