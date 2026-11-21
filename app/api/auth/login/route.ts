// POST /api/auth/login — inicio de sesión con correo y contraseña.
// Lo llama /entrar. Crea la cookie session_token (lib/session.ts).
// Tope por IP de fallos (2026-11-20, lib/limite-por-ip.ts): correo sin cuenta o contraseña
// equivocada cuentan; con el tope lleno responde 429 antes de buscar la cuenta.
// Bloqueo por correo (2026-11-20, hallazgo #4): 5 fallos del mismo correo desde la misma IP, o
// 50 desde cualquiera, dan 429 con el mismo texto exista o no la cuenta. Antes 5 fallos bloqueaban
// la cuenta en la BD (locked_until) para todos y el 423 "Cuenta bloqueada" delataba que existía.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { columnaDeRoles } from "@/lib/usuarios/tabla-roles";
import { createSession } from "@/lib/session";
import { cancelarBajaSiPendiente } from "@/lib/usuarios/baja";
import { verifyPassword, hashPassword, wasLegacyHash } from "@/lib/password";
import { isValidEmail } from "@/lib/validation";
import { startVerification } from "@/lib/verification";
import {
  limpiarFallosDeCorreoEnIp,
  respuestaDeBloqueoDeCorreo,
  respuestaDeLimite,
  segundosDeBloqueo,
  segundosDeBloqueoDeCorreo,
  sumarAlLimite,
  sumarFalloDeCorreo,
} from "@/lib/limite-por-ip";

// Misma respuesta si el correo no existe, si la cuenta es solo de Google o si la
// contraseña está mal: antes el mensaje distinto revelaba qué correos tienen cuenta.
const CREDENCIALES_INCORRECTAS = "Correo o contraseña incorrectos. Si te registraste con Google, usa el botón de Google.";
// Hash bcrypt de relleno: se compara aunque no haya contraseña que revisar, para que
// la respuesta tarde lo mismo exista o no la cuenta.
const HASH_DE_RELLENO = "$2b$10$KP9PLyK6L22XafVtFtSJGuxFPH4/m6urZ9MWGa1p7GGKY1i/DyKMm";

function credencialesIncorrectas(request: Request, email: string) {
  sumarAlLimite("login", request.headers);
  sumarFalloDeCorreo(email, request.headers);
  return NextResponse.json({ error: CREDENCIALES_INCORRECTAS }, { status: 401 });
}

export async function POST(request: Request) {
  const bloqueo = segundosDeBloqueo("login", request.headers);
  if (bloqueo !== null) return respuestaDeLimite(bloqueo);

  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Correo y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "El correo no tiene un formato válido" },
        { status: 400 }
      );
    }

    // Antes de buscar la cuenta: el mismo 429 exista o no.
    const bloqueoDeCorreo = segundosDeBloqueoDeCorreo(email, request.headers);
    if (bloqueoDeCorreo !== null) return respuestaDeBloqueoDeCorreo(bloqueoDeCorreo);

    const result = await pool.query(
      `SELECT id, nombre, apellidos, email, password_hash, state, city, specialty, intereses, ${columnaDeRoles()},
              xp_total, level, streak_days, email_verificado
       FROM usuarios
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (result.rowCount === 0) {
      await verifyPassword(password, HASH_DE_RELLENO);
      return credencialesIncorrectas(request, email);
    }

    const usuario = result.rows[0];

    if (!usuario.password_hash) {
      await verifyPassword(password, HASH_DE_RELLENO);
      return credencialesIncorrectas(request, email);
    }

    const passwordMatches = await verifyPassword(password, usuario.password_hash);

    if (!passwordMatches) {
      return credencialesIncorrectas(request, email);
    }

    limpiarFallosDeCorreoEnIp(email, request.headers);

    if (wasLegacyHash(usuario.password_hash)) {
      const upgradedHash = await hashPassword(password);
      await pool.query(`UPDATE usuarios SET password_hash = $2 WHERE id = $1`, [usuario.id, upgradedHash]);
    }

    // El login ya no escribe estas columnas (2026-11-20); las sigue usando la contraseña actual
    // equivocada con sesión (lib/usuarios/contrasena-actual.ts), y entrar bien las limpia.
    await pool.query(
      `UPDATE usuarios SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [usuario.id]
    );

    // Una cuenta suspendida o baneada sí inicia sesión: al entrar a la app la
    // mandan a /cuenta-bloqueada, donde ve el motivo, y getSessionUser no la
    // deja usar nada (lib/sanciones.ts).

    if (!usuario.email_verificado) {
      const response = NextResponse.json(
        { error: "Verifica tu correo antes de iniciar sesión", requiresVerification: true },
        { status: 403 }
      );

      try {
        // Deja la cookie con una ficha nueva (lib/verification.ts); manda código solo si pasa
        // la espera entre envíos y el tope por hora: si no, sirve el último que llegó.
        await startVerification(usuario.id, usuario.email, usuario.nombre, response);
      } catch (verificationError) {
        console.error("No se pudo enviar el correo de verificación", verificationError);
      }

      return response;
    }

    delete usuario.password_hash;

    // Entrar dentro del plazo de gracia cancela la baja de cuenta (lib/usuarios/baja.ts).
    const bajaCancelada = await cancelarBajaSiPendiente(usuario.id);
    await createSession(usuario.id);

    return NextResponse.json(
      { message: bajaCancelada ? "Sesión iniciada. Cancelamos la baja de tu cuenta." : "Sesión iniciada", data: usuario, bajaCancelada },
      { status: 200 }
    );
  } catch (error) {
    // El detalle se queda en el log: mandarlo al navegador exponía errores internos.
    console.error("POST /api/auth/login:", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
