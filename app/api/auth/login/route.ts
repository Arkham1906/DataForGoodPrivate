// POST /api/auth/login — inicio de sesión con correo y contraseña.
// Lo llama /entrar. Crea la cookie session_token (lib/session.ts).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { columnaDeRoles } from "@/lib/usuarios/tabla-roles";
import { createSession } from "@/lib/session";
import { cancelarBajaSiPendiente } from "@/lib/usuarios/baja";
import { verifyPassword, hashPassword, wasLegacyHash, MAX_FAILED_ATTEMPTS, LOCK_DURATION_MS } from "@/lib/password";
import { isValidEmail } from "@/lib/validation";
import { startVerification } from "@/lib/verification";

// Misma respuesta si el correo no existe, si la cuenta es solo de Google o si la
// contraseña está mal: antes el mensaje distinto revelaba qué correos tienen cuenta.
const CREDENCIALES_INCORRECTAS = "Correo o contraseña incorrectos. Si te registraste con Google, usa el botón de Google.";
// Hash bcrypt de relleno: se compara aunque no haya contraseña que revisar, para que
// la respuesta tarde lo mismo exista o no la cuenta.
const HASH_DE_RELLENO = "$2b$10$KP9PLyK6L22XafVtFtSJGuxFPH4/m6urZ9MWGa1p7GGKY1i/DyKMm";

function credencialesIncorrectas() {
  return NextResponse.json({ error: CREDENCIALES_INCORRECTAS }, { status: 401 });
}

export async function POST(request: Request) {
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

    const result = await pool.query(
      `SELECT id, nombre, apellidos, email, password_hash, state, city, specialty, intereses, ${columnaDeRoles()},
              xp_total, level, streak_days, email_verificado, failed_login_attempts, locked_until
       FROM usuarios
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (result.rowCount === 0) {
      await verifyPassword(password, HASH_DE_RELLENO);
      return credencialesIncorrectas();
    }

    const usuario = result.rows[0];

    if (usuario.locked_until && new Date(usuario.locked_until) > new Date()) {
      const minutosRestantes = Math.ceil(
        (new Date(usuario.locked_until).getTime() - Date.now()) / 60000
      );
      return NextResponse.json(
        { error: `Cuenta bloqueada temporalmente. Intenta de nuevo en ${minutosRestantes} minuto(s)` },
        { status: 423 }
      );
    }

    if (!usuario.password_hash) {
      await verifyPassword(password, HASH_DE_RELLENO);
      return credencialesIncorrectas();
    }

    const passwordMatches = await verifyPassword(password, usuario.password_hash);

    if (!passwordMatches) {
      const attempts = usuario.failed_login_attempts + 1;
      const lockUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null;

      await pool.query(
        `UPDATE usuarios SET failed_login_attempts = $2, locked_until = $3 WHERE id = $1`,
        [usuario.id, attempts, lockUntil]
      );

      return credencialesIncorrectas();
    }

    if (wasLegacyHash(usuario.password_hash)) {
      const upgradedHash = await hashPassword(password);
      await pool.query(`UPDATE usuarios SET password_hash = $2 WHERE id = $1`, [usuario.id, upgradedHash]);
    }

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
        const { expiresAt } = await startVerification(usuario.id, usuario.email, usuario.nombre, response);
        response.cookies.set("pending_verification_id", String(usuario.id), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          expires: expiresAt,
        });
      } catch (verificationError) {
        console.error("No se pudo enviar el correo de verificación", verificationError);
      }

      return response;
    }

    delete usuario.password_hash;
    delete usuario.failed_login_attempts;
    delete usuario.locked_until;

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
