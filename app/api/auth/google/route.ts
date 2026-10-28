// GET /api/auth/google — inicia el login con Google (lib/google.ts).
// Guarda un state aleatorio (cookie google_oauth_state) y el ?next= para volver después.
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getGoogleAuthUrl } from "@/lib/google";
import { absoluteUrl } from "@/lib/app-url";
import { conDestino, destinoSeguro } from "@/lib/redireccion";
const STATE_COOKIE = "google_oauth_state";
const NEXT_COOKIE = "google_oauth_next";
export async function GET(request: Request) {
  // Pantalla a la que volver tras el callback (?next= desde /entrar o /registro).
  const next = new URL(request.url).searchParams.get("next");
  try {
    const state = randomBytes(16).toString("hex");
    const url = getGoogleAuthUrl(state);
    const cookieStore = await cookies();
    const opciones = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    };
    cookieStore.set(STATE_COOKIE, state, opciones);
    if (next) {
      cookieStore.set(NEXT_COOKIE, destinoSeguro(next), opciones);
    } else {
      cookieStore.delete(NEXT_COOKIE);
    }
    return NextResponse.redirect(url);
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(absoluteUrl(conDestino("/entrar?error=google", next)));
  }
}
