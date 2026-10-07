// Verificación del correo: código de 6 dígitos enviado por correo (lib/correo.ts), guardado como hash.
// Vence en 15 minutos y admite 3 intentos. La cookie pending_verification_id liga /verificar con la cuenta.

import { randomInt, createHash } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { enviarCorreo, escaparHtml } from "@/lib/correo";

export const PENDING_COOKIE = "pending_verification_id";
const CODE_LENGTH = 6;
const CODE_DURATION_MS = 1000 * 60 * 15; // 15 minutos
const MAX_ATTEMPTS = 3;

// TIMESTAMPTZ, no TIMESTAMP: si Postgres y el servidor de Next corren en
// husos horarios distintos, un valor sin zona se interpreta con el huso
// equivocado al leerlo de vuelta y el código nace "expirado" (mismo defecto
// que root_sessions.expires_at).
const ensureVerificationColumns = `
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verification_code_hash VARCHAR(64);
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;
`;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

async function sendVerificationEmail(email: string, nombre: string, code: string) {
  await enviarCorreo(
    email,
    "Tu código de verificación de DataForGood",
    `
      <p>Hola ${escaparHtml(nombre)},</p>
      <p>Tu código de verificación es:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>Expira en 15 minutos. Si no lo solicitaste, ignora este correo.</p>
    `
  );
}

export async function startVerification(
  usuarioId: number,
  email: string,
  nombre: string,
  response?: NextResponse
) {
  await pool.query(ensureVerificationColumns);

  const code = randomInt(0, 1_000_000).toString().padStart(CODE_LENGTH, "0");
  const expiresAt = new Date(Date.now() + CODE_DURATION_MS);

  await pool.query(
    `UPDATE usuarios
     SET verification_code_hash = $2, verification_code_expires_at = $3, verification_attempts = 0
     WHERE id = $1`,
    [usuarioId, hashCode(code), expiresAt]
  );

  await sendVerificationEmail(email, nombre, code);

  if (response) {
    response.cookies.set(PENDING_COOKIE, String(usuarioId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
  }

  return { expiresAt };
}

export interface PendingVerification {
  id: number;
  nombre: string;
  email: string;
  expiresAt: Date | null;
  attemptsLeft: number;
}

export async function getPendingVerification(): Promise<PendingVerification | null> {
  await pool.query(ensureVerificationColumns);

  const cookieStore = await cookies();
  const rawId = cookieStore.get(PENDING_COOKIE)?.value;

  if (!rawId || Number.isNaN(Number(rawId))) {
    return null;
  }

  const result = await pool.query(
    `SELECT id, nombre, email, email_verificado, verification_code_expires_at, verification_attempts
     FROM usuarios WHERE id = $1 LIMIT 1`,
    [Number(rawId)]
  );

  if (result.rowCount === 0 || result.rows[0].email_verificado) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    expiresAt: row.verification_code_expires_at,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - row.verification_attempts),
  };
}

export async function clearPendingVerificationCookie(response?: NextResponse) {
  if (response) {
    response.cookies.delete(PENDING_COOKIE);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.delete(PENDING_COOKIE);
}

export type VerifyCodeResult =
  | { success: true }
  | { success: false; error: string; attemptsLeft: number };

export async function verifyCode(usuarioId: number, code: string): Promise<VerifyCodeResult> {
  await pool.query(ensureVerificationColumns);

  const result = await pool.query(
    `SELECT verification_code_hash, verification_code_expires_at, verification_attempts
     FROM usuarios WHERE id = $1 LIMIT 1`,
    [usuarioId]
  );

  if (result.rowCount === 0) {
    return { success: false, error: "No se encontró la cuenta", attemptsLeft: 0 };
  }

  const row = result.rows[0];
  const attemptsLeft = MAX_ATTEMPTS - row.verification_attempts;

  if (!row.verification_code_hash || attemptsLeft <= 0) {
    return { success: false, error: "Solicita un nuevo código", attemptsLeft: 0 };
  }

  if (!row.verification_code_expires_at || new Date(row.verification_code_expires_at) < new Date()) {
    return { success: false, error: "El código expiró, solicita uno nuevo", attemptsLeft: 0 };
  }

  if (hashCode(code) !== row.verification_code_hash) {
    const newAttempts = row.verification_attempts + 1;
    await pool.query(`UPDATE usuarios SET verification_attempts = $2 WHERE id = $1`, [
      usuarioId,
      newAttempts,
    ]);
    return {
      success: false,
      error: "Código incorrecto",
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - newAttempts),
    };
  }

  await pool.query(
    `UPDATE usuarios
     SET email_verificado = true, verification_code_hash = NULL, verification_code_expires_at = NULL, verification_attempts = 0
     WHERE id = $1`,
    [usuarioId]
  );

  return { success: true };
}
