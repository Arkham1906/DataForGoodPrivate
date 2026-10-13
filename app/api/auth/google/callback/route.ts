// GET /api/auth/google/callback — Google regresa aquí con code y state.
// Vincula google_id a la cuenta con ese correo o crea una ya verificada, abre sesión y redirige.

import { NextResponse } from "next/server";
import { correoEnListaNegra } from "@/lib/usuarios/lista-negra";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { createSession } from "@/lib/session";
import { cancelarBajaSiPendiente } from "@/lib/usuarios/baja";
import { exchangeCodeForProfile } from "@/lib/google";
import { absoluteUrl } from "@/lib/app-url";
import { conDestino, destinoSeguro } from "@/lib/redireccion";

const STATE_COOKIE = "google_oauth_state";
const NEXT_COOKIE = "google_oauth_next";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Si algo falla, /entrar conserva el destino para reintentar (lib/redireccion.ts).
  let destino: string | undefined;

  try {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(STATE_COOKIE)?.value;
    cookieStore.delete(STATE_COOKIE);
    destino = destinoSeguro(cookieStore.get(NEXT_COOKIE)?.value);
    cookieStore.delete(NEXT_COOKIE);

    if (!code || !state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(absoluteUrl(conDestino("/entrar?error=google", destino)));
    }

    const profile = await exchangeCodeForProfile(code);


    const existing = await pool.query(
      `SELECT id FROM usuarios WHERE email = $1 OR google_id = $2 LIMIT 1`,
      [profile.email, profile.googleId]
    );

    let usuarioId: number;

    if (existing.rowCount && existing.rowCount > 0) {
      usuarioId = existing.rows[0].id;
      await pool.query(
        `UPDATE usuarios SET google_id = $2, email_verificado = true WHERE id = $1`,
        [usuarioId, profile.googleId]
      );
    } else {
      // Correo de una cuenta baneada (lista negra, 2026-10-12): no se crea una cuenta nueva con él.
      if (await correoEnListaNegra(profile.email)) {
        return NextResponse.redirect(absoluteUrl(conDestino("/entrar?error=correo_bloqueado", destino)));
      }
      const inserted = await pool.query(
        `INSERT INTO usuarios (nombre, apellidos, email, password_hash, google_id, email_verificado, role, xp_total, level, streak_days)
         VALUES ($1, $2, $3, NULL, $4, true, $5::jsonb, 0, 1, 0)
         RETURNING id`,
        [profile.givenName, profile.familyName, profile.email, profile.googleId, JSON.stringify(["usuario"])]
      );
      usuarioId = inserted.rows[0].id;
    }

    // Una cuenta bloqueada también entra: al llegar a la app la mandan a
    // /cuenta-bloqueada, donde ve el motivo (exigirUsuario en lib/session.ts).
    // Entrar dentro del plazo de gracia cancela la baja de cuenta (lib/usuarios/baja.ts).
    const bajaCancelada = await cancelarBajaSiPendiente(usuarioId);
    await createSession(usuarioId);

    // Con la baja recién cancelada, primero el aviso de /entrar; de ahí sigue a `destino`.
    if (bajaCancelada) {
      return NextResponse.redirect(absoluteUrl(conDestino("/entrar?baja=cancelada", destino)));
    }
    return NextResponse.redirect(absoluteUrl(destino));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(absoluteUrl(conDestino("/entrar?error=google", destino)));
  }
}
