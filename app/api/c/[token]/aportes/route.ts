// /api/c/[token]/aportes — aporte SIN cuenta desde el enlace público de una campaña.
// Público: no pide sesión. Es lo único que una persona anónima puede hacer en el sistema,
// y solo con un enlace vigente de una campaña activa. Lo usa el formulario de /c/[token]
// (aporte-anonimo.tsx). Reglas y cuota en lib/campanas/aportes-anonimos.ts.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_ANONIMO, dispositivoValido } from "@/lib/aportes/anonimato";
import { errorDeConsentimiento } from "@/lib/aportes/consentimiento";
import { enviarAporteAnonimo } from "@/lib/campanas/aportes-anonimos";
import { ipDelCliente } from "@/lib/ip";
import { getSessionUser } from "@/lib/session";

// POST (multipart/form-data: file, description, caracteristicas[], aceptaUso=si,
// confirmaContenido=si; sin las dos casillas responde 400): envía el aporte como
// "Anónimo". Cuota por dispositivo (cookie anonimo_id, se crea aquí si no existe), tope por IP
// y espera entre aportes del mismo dispositivo (429 con esperaSegundos y Retry-After).
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;

    // Con sesión se aporta con la cuenta (cuenta para su cuota y su historial), no anónimo.
    if (await getSessionUser()) {
      return NextResponse.json({ error: "Ya iniciaste sesión: aporta desde la campaña con tu cuenta" }, { status: 409 });
    }

    const formData = await request.formData();
    const errorConsentimiento = errorDeConsentimiento(formData);
    if (errorConsentimiento) {
      return NextResponse.json({ error: errorConsentimiento }, { status: 400 });
    }

    const cookieStore = await cookies();
    const resultado = await enviarAporteAnonimo({
      token,
      dispositivo: dispositivoValido(cookieStore.get(COOKIE_ANONIMO)?.value),
      ip: ipDelCliente(request.headers),
      descripcion: String(formData.get("description") ?? ""),
      caracteristicas: formData.getAll("caracteristicas").map(String),
      archivo: formData.get("file"),
    });

    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.error, ...(resultado.esperaSegundos ? { esperaSegundos: resultado.esperaSegundos } : {}) },
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
