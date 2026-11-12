// Respuesta HTTP del aporte SIN cuenta, compartida por POST /api/c/[token]/aportes (desde el enlace del
// creador) y POST /api/campanas/[id]/aporte-sin-cuenta (desde la ficha pública, 2026-11-11). Solo cambia
// de dónde sale la campaña; las reglas están en ./aportes-anonimos.ts.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_ANONIMO, dispositivoValido } from "@/lib/aportes/anonimato";
import { MENSAJE_CUERPO_GRANDE, cuerpoDemasiadoGrande } from "@/lib/aportes/comun";
import { errorDeConsentimiento } from "@/lib/aportes/consentimiento";
import { enviarAporteAnonimo, type OrigenDelAporteAnonimo } from "@/lib/campanas/aportes-anonimos";
import { ipDelCliente } from "@/lib/ip";
import { getSessionUser } from "@/lib/session";

// multipart/form-data: file, description, texto (solo texto, 2026-11-11: se guarda como .txt y
// description es su título), caracteristicas[], aceptaUso=si,
// confirmaContenido=si; sin las dos casillas responde 400; file es opcional si la campaña
// acepta texto; 413 si el cuerpo pasa del archivo más grande permitido): envía el aporte como
// "Anónimo". Un aporte por dispositivo y campaña (cookie anonimo_id, se crea aquí si no existe;
// el segundo responde 403 con pideCuenta: true, 2026-11-09), tope por IP y espera entre aportes
// del mismo dispositivo (429 con esperaSegundos y Retry-After).
export async function responderAporteAnonimo(request: Request, origen: OrigenDelAporteAnonimo): Promise<NextResponse> {
  try {
    // Con sesión se aporta con la cuenta (cuenta para su cuota y su historial), no anónimo.
    if (await getSessionUser()) {
      return NextResponse.json({ error: "Ya iniciaste sesión: aporta desde la campaña con tu cuenta" }, { status: 409 });
    }

    if (cuerpoDemasiadoGrande(request)) {
      return NextResponse.json({ error: MENSAJE_CUERPO_GRANDE }, { status: 413 });
    }
    const formData = await request.formData();
    const errorConsentimiento = errorDeConsentimiento(formData);
    if (errorConsentimiento) {
      return NextResponse.json({ error: errorConsentimiento }, { status: 400 });
    }

    const cookieStore = await cookies();
    const resultado = await enviarAporteAnonimo({
      origen,
      dispositivo: dispositivoValido(cookieStore.get(COOKIE_ANONIMO)?.value),
      ip: ipDelCliente(request.headers),
      descripcion: String(formData.get("description") ?? ""),
      // Solo texto (2026-11-11): el texto va aparte y description es su título.
      texto: String(formData.get("texto") ?? ""),
      caracteristicas: formData.getAll("caracteristicas").map(String),
      archivo: formData.get("file"),
    });

    if (!resultado.ok) {
      return NextResponse.json(
        {
          error: resultado.error,
          ...(resultado.esperaSegundos ? { esperaSegundos: resultado.esperaSegundos } : {}),
          // Ya usó su aporte sin cuenta en esta campaña (2026-11-09): la pantalla invita a registrarse.
          ...(resultado.pideCuenta ? { pideCuenta: true } : {}),
        },
        {
          status: resultado.status,
          ...(resultado.esperaSegundos ? { headers: { "Retry-After": String(resultado.esperaSegundos) } } : {}),
        }
      );
    }

    if (resultado.dispositivoNuevo) {
      cookieStore.set(COOKIE_ANONIMO, resultado.dispositivo, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    // Sin id ni datos del aporte: la persona anónima no puede consultarlo después.
    return NextResponse.json(
      {
        message: "Aporte enviado. Quedará pendiente de revisión.",
        data: { restantes: resultado.restantes, esperaSegundos: resultado.esperaSegundos },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creando aporte anónimo", error);
    return NextResponse.json({ error: "No se pudo enviar el aporte" }, { status: 500 });
  }
}
