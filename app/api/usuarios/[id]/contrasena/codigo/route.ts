// POST /api/usuarios/[id]/contrasena/codigo — manda al correo de la cuenta el código para
// poner contraseña con la sesión abierta, sin pedir la actual: cambiarla o, en una cuenta de
// Google, crearla. Solo la cuenta propia. Lo usa la ventana de contraseña de /cuenta
// (CambiarContrasena.tsx). Lógica en lib/usuarios/recuperacion.ts.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { enviarCodigoDeContrasena } from "@/lib/usuarios/recuperacion";
import { SEGUNDOS_ENTRE_ENVIOS } from "@/lib/usuarios/recuperacion-opciones";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }
    if (Number(sessionUser.id) !== Number(id)) {
      return NextResponse.json({ error: "Solo puedes cambiar la contraseña de tu propia cuenta" }, { status: 403 });
    }

    const enviado = await enviarCodigoDeContrasena(Number(id));
    if (!enviado) {
      return NextResponse.json(
        { error: `Ya te enviamos un código. Espera ${SEGUNDOS_ENTRE_ENVIOS} segundos para pedir otro.` },
        { status: 429, headers: { "Retry-After": String(SEGUNDOS_ENTRE_ENVIOS) } }
      );
    }

    return NextResponse.json({ data: { email: sessionUser.email } });
  } catch (error) {
    console.error("POST /api/usuarios/[id]/contrasena/codigo:", error);
    return NextResponse.json({ error: "No se pudo enviar el código" }, { status: 500 });
  }
}
