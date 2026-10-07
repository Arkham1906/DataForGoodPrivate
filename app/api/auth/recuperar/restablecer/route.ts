// POST /api/auth/recuperar/restablecer — cambia la contraseña con el código del correo.
// Lo usa /recuperar. Si sale bien cierra todas las sesiones de la cuenta y no abre una
// nueva: la pantalla manda a /entrar. Lógica en lib/usuarios/recuperacion.ts.

import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/validation";
import { cumpleReglasDeContrasena } from "@/lib/reglas-contrasena";
import { CODIGO_INVALIDO, restablecerContrasena } from "@/lib/usuarios/recuperacion";

// POST: { email, codigo, nueva }.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const codigo = String(body.codigo ?? "").trim();
    const nueva = typeof body.nueva === "string" ? body.nueva : "";

    if (!email || !codigo || !nueva) {
      return NextResponse.json({ error: "El correo, el código y la contraseña nueva son obligatorios" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "El correo no tiene un formato válido" }, { status: 400 });
    }
    if (!/^\d{6}$/.test(codigo)) {
      return NextResponse.json({ error: CODIGO_INVALIDO }, { status: 400 });
    }
    if (!cumpleReglasDeContrasena(nueva)) {
      return NextResponse.json({ error: "La nueva contraseña no cumple los requisitos" }, { status: 400 });
    }

    const resultado = await restablecerContrasena(email, codigo, nueva);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: 400 });
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("POST /api/auth/recuperar/restablecer:", error);
    return NextResponse.json({ error: "No se pudo cambiar la contraseña" }, { status: 500 });
  }
}
