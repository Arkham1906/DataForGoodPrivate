// Recuperación de contraseña ("¿Olvidaste tu contraseña?", pantalla /recuperar).
//
// 1. solicitarRecuperacion(): si el correo tiene cuenta, guarda el hash de un código de
//    6 dígitos y lo envía. Si no la tiene, no hace nada: la ruta responde igual en los dos
//    casos (y corre esto después de responder) para no revelar qué correos tienen cuenta.
//    Una cuenta solo de Google (sin contraseña) también lo recibe y con él crea su
//    contraseña (decisión del usuario, 2026-10-07).
// 2. restablecerContrasena(): con el correo, el código y la contraseña nueva. El código
//    vence en MINUTOS_DE_VIGENCIA y admite INTENTOS_POR_CODIGO; todo fallo da el mismo
//    mensaje. Si es correcto: guarda la contraseña, quita el bloqueo por intentos, marca el
//    correo como verificado (recibir el código lo demuestra), cierra todas las sesiones y
//    quita los avisos push de la cuenta (decisión del usuario: quien recupera puede ser
//    víctima de un acceso indebido). No abre sesión: la pantalla manda a /entrar.

import { createHash, randomInt } from "crypto";
import { pool } from "@/lib/db";
import { enviarCorreo, escaparHtml } from "@/lib/correo";
import { hashPassword } from "@/lib/password";
import { registrarAuditoria } from "@/lib/auditoria";
import { INTENTOS_POR_CODIGO, MINUTOS_DE_VIGENCIA, SEGUNDOS_ENTRE_ENVIOS } from "@/lib/usuarios/recuperacion-opciones";

export const CODIGO_INVALIDO = "El código no es válido o ya venció. Revisa el correo o pide uno nuevo.";

function hashDeCodigo(codigo: string) {
  return createHash("sha256").update(codigo).digest("hex");
}

/* ── 1. Pedir el código ────────────────────────────────────────────────────── */

export async function solicitarRecuperacion(email: string): Promise<void> {
  const codigo = randomInt(0, 1_000_000).toString().padStart(6, "0");

  // Un solo UPDATE condicional: si llegan dos peticiones juntas, solo una pasa la espera
  // entre envíos y manda correo.
  const result = await pool.query<{ nombre: string; email: string; tiene_contrasena: boolean }>(
    `UPDATE usuarios
     SET recuperacion_codigo_hash = $2,
         recuperacion_vence_en = NOW() + make_interval(mins => $3),
         recuperacion_intentos = 0,
         recuperacion_enviada_en = NOW()
     WHERE email = $1
       AND eliminada_en IS NULL
       AND (recuperacion_enviada_en IS NULL OR recuperacion_enviada_en < NOW() - make_interval(secs => $4))
     RETURNING nombre, email, password_hash IS NOT NULL AS tiene_contrasena`,
    [email, hashDeCodigo(codigo), MINUTOS_DE_VIGENCIA, SEGUNDOS_ENTRE_ENVIOS]
  );
  if (!result.rowCount) return;

  const usuario = result.rows[0];
  const queHace = usuario.tiene_contrasena
    ? "Con este código puedes elegir una contraseña nueva para tu cuenta."
    : "Tu cuenta entra con Google. Con este código puedes crear una contraseña para entrar también con tu correo.";

  await enviarCorreo(
    usuario.email,
    "Recupera tu contraseña de DataForGood",
    `
      <p>Hola ${escaparHtml(usuario.nombre)},</p>
      <p>${queHace} Tu código es:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${codigo}</p>
      <p>Expira en ${MINUTOS_DE_VIGENCIA} minutos. Si no lo pediste, ignora este correo: tu contraseña no cambia.</p>
    `
  );
}

/* ── 2. Cambiar la contraseña con el código ────────────────────────────────── */

export type ResultadoDeRestablecer = { ok: true } | { ok: false; error: string };

/** `nueva` ya cumple REGLAS_DE_CONTRASENA (lo revisa la ruta). */
export async function restablecerContrasena(
  email: string,
  codigo: string,
  nueva: string
): Promise<ResultadoDeRestablecer> {
  // El hash se calcula antes de bloquear la fila: bcrypt tarda.
  const nuevoHash = await hashPassword(nueva);
  const client = await pool.connect();
  let usuarioId: number;
  let creoContrasena: boolean;

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, password_hash, recuperacion_codigo_hash, recuperacion_vence_en, recuperacion_intentos
       FROM usuarios
       WHERE email = $1 AND eliminada_en IS NULL
       FOR UPDATE`,
      [email]
    );
    const fila = result.rows[0];

    const vigente =
      fila?.recuperacion_codigo_hash &&
      fila.recuperacion_intentos < INTENTOS_POR_CODIGO &&
      fila.recuperacion_vence_en &&
      new Date(fila.recuperacion_vence_en) > new Date();

    if (!vigente) {
      await client.query("ROLLBACK");
      return { ok: false, error: CODIGO_INVALIDO };
    }

    if (hashDeCodigo(codigo) !== fila.recuperacion_codigo_hash) {
      await client.query(`UPDATE usuarios SET recuperacion_intentos = recuperacion_intentos + 1 WHERE id = $1`, [
        fila.id,
      ]);
      await client.query("COMMIT");
      return { ok: false, error: CODIGO_INVALIDO };
    }

    usuarioId = fila.id;
    creoContrasena = !fila.password_hash;
    await client.query(
      `UPDATE usuarios
       SET password_hash = $2,
           failed_login_attempts = 0, locked_until = NULL,
           email_verificado = true,
           verification_code_hash = NULL, verification_code_expires_at = NULL, verification_attempts = 0,
           recuperacion_codigo_hash = NULL, recuperacion_vence_en = NULL, recuperacion_intentos = 0,
           updated_at = NOW()
       WHERE id = $1`,
      [usuarioId, nuevoHash]
    );
    await client.query(`DELETE FROM sessions WHERE usuario_id = $1`, [usuarioId]);
    await client.query(`DELETE FROM push_suscripciones WHERE usuario_id = $1`, [usuarioId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  await registrarAuditoria({
    actor: { tipo: "usuario", id: usuarioId },
    accion: "usuario.contrasena_recuperar",
    objetivo: { tipo: "usuario", id: usuarioId },
    detalle: { creoContrasena },
  });
  return { ok: true };
}
