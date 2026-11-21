// Lectura de cuerpos multipart/form-data en los route handlers (2026-11-20, hallazgo #5 de las
// pruebas de seguridad). request.formData() lanza un error si el cuerpo no es un formulario
// (JSON, texto, multipart roto) y la ruta respondía 500; con esto responde 400.
// Lo usan POST /api/aportes, el aporte sin cuenta, crear y editar campaña con banner y el avatar.

import { NextResponse } from "next/server";

export const MENSAJE_FORMULARIO_INVALIDO =
  "La petición debe enviarse como formulario (multipart/form-data).";

/** El formulario del cuerpo, o null si no se pudo leer como formulario. */
export async function leerFormulario(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

export function respuestaDeFormularioInvalido(): NextResponse {
  return NextResponse.json({ error: MENSAJE_FORMULARIO_INVALIDO }, { status: 400 });
}
