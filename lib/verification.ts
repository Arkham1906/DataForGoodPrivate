// Verificación del correo: código de 6 dígitos enviado por correo (lib/correo.ts), guardado como hash.
// Vence en 15 minutos y admite 3 intentos. La cookie pending_verification_id liga /verificar con la cuenta.
// El código vive en codigos_usuario con proposito 'verificacion' (2026-10-30; antes, columnas verification_*).

import { randomInt, createHash } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { enviarCorreo, escaparHtml } from "@/lib/correo";

export const PENDING_COOKIE = "pending_verification_id";
const CODE_LENGTH = 6;
const CODE_DURATION_MS = 1000 * 60 * 15; // 15 minutos
const MAX_ATTEMPTS = 3;

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
  const code = randomInt(0, 1_000_000).toString().padStart(CODE_LENGTH, "0");
  const expiresAt = new Date(Date.now() + CODE_DURATION_MS);

  await pool.query(
    `INSERT INTO codigos_usuario (usuario_id, proposito, codigo_hash, vence_en, intentos, enviado_en)
     VALUES ($1, 'verificacion', $2, $3, 0, NOW())
     ON CONFLICT (usuario_id, proposito)
     DO UPDATE SET codigo_hash = EXCLUDED.codigo_hash, vence_en = EXCLUDED.vence_en, intentos = 0, enviado_en = NOW()`,
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
  const cookieStore = await cookies();
  const rawId = cookieStore.get(PENDING_COOKIE)?.value;

  if (!rawId || Number.isNaN(Number(rawId))) {
    return null;
  }

  const result = await pool.query(
    `SELECT u.id, u.nombre, u.email, u.email_verificado, c.vence_en, c.intentos
     FROM usuarios u
     LEFT JOIN codigos_usuario c ON c.usuario_id = u.id AND c.proposito = 'verificacion'
     WHERE u.id = $1 LIMIT 1`,
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
    expiresAt: row.vence_en,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - (row.intentos ?? 0)),
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
  const result = await pool.query(
    `SELECT c.codigo_hash, c.vence_en, c.intentos
     FROM usuarios u
     LEFT JOIN codigos_usuario c ON c.usuario_id = u.id AND c.proposito = 'verificacion'
     WHERE u.id = $1 LIMIT 1`,
    [usuarioId]
  );

  if (result.rowCount === 0) {
    return { success: false, error: "No se encontró la cuenta", attemptsLeft: 0 };
  }

  const row = result.rows[0];
  const attemptsLeft = MAX_ATTEMPTS - (row.intentos ?? 0);

  if (!row.codigo_hash || attemptsLeft <= 0) {
    return { success: false, error: "Solicita un nuevo código", attemptsLeft: 0 };
  }

  if (new Date(row.vence_en) < new Date()) {
    return { success: false, error: "El código expiró, solicita uno nuevo", attemptsLeft: 0 };
  }

  if (hashCode(code) !== row.codigo_hash) {
    const newAttempts = row.intentos + 1;
    await pool.query(
      `UPDATE codigos_usuario SET intentos = $2 WHERE usuario_id = $1 AND proposito = 'verificacion'`,
      [usuarioId, newAttempts]
    );
    return {
      success: false,
      error: "Código incorrecto",
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - newAttempts),
    };
  }

  await pool.query(`UPDATE usuarios SET email_verificado = true WHERE id = $1`, [usuarioId]);
  await pool.query(`DELETE FROM codigos_usuario WHERE usuario_id = $1 AND proposito = 'verificacion'`, [usuarioId]);

  return { success: true };
}
