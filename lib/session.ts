// Sesión de usuario (cookie session_token, tabla sessions).
// - getSessionUser(): para route handlers; devuelve null si no hay sesión o si la cuenta está sancionada.
// - exigirUsuario(): para páginas y layouts de servidor; redirige a /entrar o /cuenta-bloqueada.
// La sesión del SuperUsuario es otra (lib/rootSession.ts). Ver docs/permisos.md.

import { randomBytes, createHash } from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import {
  SQL_SANCION_BLOQUEANTE,
  contarSanciones,
  obtenerBloqueo,
  type Bloqueo,
  type HistorialDeSanciones,
} from "@/lib/sanciones";

const COOKIE_NAME = "session_token";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 días

export interface SessionUser {
  id: number;
  nombre: string;
  apellidos: string;
  email: string;
  state: string | null;
  city: string | null;
  specialty: string | null;
  intereses: string[];
  /** Lo que escribió sobre sus gustos (/bienvenida o /cuenta); null si no ha escrito nada. */
  intereses_texto: string | null;
  role: string[];
  xp_total: number;
  level: number;
  streak_days: number;
  /** Ícono del perfil (lib/usuarios/avatar-opciones.ts): null = iniciales. */
  avatar: "masculino" | "femenino" | "otro" | "foto" | null;
  /** Clave en MinIO de la foto propia; solo la usa datosDeAvatar() para la versión de la URL. */
  avatar_foto: string | null;
  email_verificado: boolean;
  tiene_contrasena: boolean;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(usuarioId: number) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await pool.query(
    `INSERT INTO sessions (token_hash, usuario_id, expires_at) VALUES ($1, $2, $3)`,
    [tokenHash, usuarioId, expiresAt]
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  const result = await pool.query(
    `SELECT u.id, u.nombre, u.apellidos, u.email, u.state, u.city, u.specialty,
            u.intereses, u.intereses_texto, u.role, u.xp_total, u.level, u.streak_days, u.email_verificado,
            u.avatar, u.avatar_foto,
          (u.password_hash IS NOT NULL) AS tiene_contrasena,
          EXISTS (
            SELECT 1 FROM campana_revisores cr
            WHERE cr.usuario_id = u.id AND cr.estado = 'aceptado'
          ) AS tiene_asignacion_revisor
     FROM sessions s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()
       -- Una cuenta suspendida o baneada deja de tener sesión válida.
       AND NOT ${SQL_SANCION_BLOQUEANTE}
    LIMIT 1`,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const sessionUser = result.rows[0] as SessionUser & { tiene_asignacion_revisor?: boolean };
  if (sessionUser.tiene_asignacion_revisor && !sessionUser.role.includes("revisor")) {
    sessionUser.role = [...sessionUser.role, "revisor"];
  }
  return sessionUser;
});

/**
 * Si la sesión es válida pero la cuenta está suspendida o baneada,
 * devuelve quién es y por qué está bloqueada; si no, null. Solo sirve para
 * mostrar la pantalla de cuenta bloqueada: no da acceso a nada (para eso
 * está getSessionUser, que para estas cuentas devuelve null).
 */
export const obtenerBloqueoDeLaSesion = cache(
  async (): Promise<{ nombre: string; bloqueo: Bloqueo; historial: HistorialDeSanciones } | null> => {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const result = await pool.query<{ id: number; nombre: string }>(
      `SELECT u.id, u.nombre
       FROM sessions s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()
       LIMIT 1`,
      [hashToken(token)]
    );
    if (result.rowCount === 0) return null;

    const { id, nombre } = result.rows[0];
    const bloqueo = await obtenerBloqueo(id);
    if (!bloqueo) return null;
    return { nombre, bloqueo, historial: await contarSanciones(id) };
  }
);

/**
 * Para layouts y páginas de servidor de la zona de usuario: el usuario de la
 * sesión, o redirige. Una cuenta suspendida o baneada va a /cuenta-bloqueada
 * (ahí ve el motivo); sin sesión, a /entrar. Layout y página corren en
 * paralelo, así que ambos deben llevar al mismo lugar.
 */
export async function exigirUsuario(): Promise<SessionUser> {
  const usuario = await getSessionUser();
  if (usuario) return usuario;
  if (await obtenerBloqueoDeLaSesion()) redirect("/cuenta-bloqueada");
  redirect("/entrar");
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  }

  cookieStore.delete(COOKIE_NAME);
}
