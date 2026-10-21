// Códigos por correo para poner contraseña. Dos caminos comparten el mismo código
// (columnas recuperacion_* de usuarios):
//
// A. Recuperar ("¿Olvidaste tu contraseña?", pantalla /recuperar, sin sesión).
//    1. solicitarRecuperacion(): si el correo tiene cuenta, guarda el hash de un código de
//       6 dígitos y lo envía. Si no la tiene, no hace nada: la ruta responde igual en los dos
//       casos (y corre esto después de responder) para no revelar qué correos tienen cuenta.
//       Una cuenta solo de Google (sin contraseña) también lo recibe y con él crea su
//       contraseña (decisión del usuario, 2026-10-07).
//    2. restablecerContrasena(): con el correo, el código y la contraseña nueva. Si es
//       correcto: guarda la contraseña, quita el bloqueo por intentos, marca el correo como
//       verificado (recibir el código lo demuestra), cierra todas las sesiones y quita los
//       avisos push de la cuenta (decisión del usuario: quien recupera puede ser víctima de
//       un acceso indebido). No abre sesión: la pantalla manda a /entrar.
//
// B. Con sesión, desde /cuenta (decisiones del usuario, 2026-10-07): "Cambiar" ya no pide la
//    contraseña actual, y una cuenta de Google crea así su contraseña para entrar de las dos
//    formas.
//    1. enviarCodigoDeContrasena(): manda el código al correo de la cuenta. Se pide aunque
//       haya sesión, para que una sesión robada no baste para quedarse con la cuenta.
//    2. ponerContrasenaConCodigo(): igual que restablecer, pero conserva las sesiones (como
//       el cambio de contraseña de siempre).
//
// En los dos, el código vence en MINUTOS_DE_VIGENCIA, admite INTENTOS_POR_CODIGO y hay
// SEGUNDOS_ENTRE_ENVIOS entre correos a la misma cuenta; todo fallo da el mismo mensaje.
// Usar el código reinicia esa espera (2026-10-21): antes, pedir otro justo después de cambiar
// la contraseña (o de /cuenta a /recuperar) se ignoraba en silencio y parecía que no llegaba.

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

/* ── Enviar el código ──────────────────────────────────────────────────────── */

type Cuenta = { email: string } | { id: number };

/**
 * Genera el código y lo envía. Devuelve false si no se envió: la cuenta no existe, o le
 * mandamos otro hace menos de SEGUNDOS_ENTRE_ENVIOS. Un solo UPDATE condicional: si llegan
 * dos peticiones juntas, solo una pasa la espera y manda correo.
 */
async function enviarCodigo(cuenta: Cuenta): Promise<boolean> {
  const codigo = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const [condicion, valor] = "email" in cuenta ? ["email = $1", cuenta.email] : ["id = $1", cuenta.id];

  const result = await pool.query<{ nombre: string; email: string; tiene_contrasena: boolean }>(
    `UPDATE usuarios
     SET recuperacion_codigo_hash = $2,
         recuperacion_vence_en = NOW() + make_interval(mins => $3),
         recuperacion_intentos = 0,
         recuperacion_enviada_en = NOW()
     WHERE ${condicion}
       AND eliminada_en IS NULL
       AND (recuperacion_enviada_en IS NULL OR recuperacion_enviada_en < NOW() - make_interval(secs => $4))
     RETURNING nombre, email, password_hash IS NOT NULL AS tiene_contrasena`,
    [valor, hashDeCodigo(codigo), MINUTOS_DE_VIGENCIA, SEGUNDOS_ENTRE_ENVIOS]
  );
  if (!result.rowCount) return false;

  const usuario = result.rows[0];
  const queHace = usuario.tiene_contrasena
    ? "Con este código puedes elegir una contraseña nueva para tu cuenta."
    : "Tu cuenta entra con Google. Con este código puedes crear una contraseña para entrar también con tu correo.";

  await enviarCorreo(
    usuario.email,
    usuario.tiene_contrasena ? "Recupera tu contraseña de DataForGood" : "Crea tu contraseña de DataForGood",
    `
      <p>Hola ${escaparHtml(usuario.nombre)},</p>
      <p>${queHace} Tu código es:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${codigo}</p>
      <p>Expira en ${MINUTOS_DE_VIGENCIA} minutos. Si no lo pediste, ignora este correo: tu contraseña no cambia.</p>
    `
  );
  return true;
}

export async function solicitarRecuperacion(email: string): Promise<void> {
  await enviarCodigo({ email });
}

/** Devuelve false si ya se le envió uno hace menos de SEGUNDOS_ENTRE_ENVIOS. */
export async function enviarCodigoDeContrasena(usuarioId: number): Promise<boolean> {
  return enviarCodigo({ id: usuarioId });
}

/* ── Usar el código ────────────────────────────────────────────────────────── */

export type ResultadoDeCodigo =
  | { ok: true; creoContrasena: boolean }
  | { ok: false; error: string };

/** `nueva` ya cumple REGLAS_DE_CONTRASENA (lo revisa la ruta). */
async function usarCodigo(
  cuenta: Cuenta,
  codigo: string,
  nueva: string,
  modo: "recuperar" | "sesion"
): Promise<ResultadoDeCodigo> {
  // El hash se calcula antes de bloquear la fila: bcrypt tarda.
  const nuevoHash = await hashPassword(nueva);
  const [condicion, valor] = "email" in cuenta ? ["email = $1", cuenta.email] : ["id = $1", cuenta.id];
  const client = await pool.connect();
  let usuarioId: number;
  let creoContrasena: boolean;

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, password_hash, recuperacion_codigo_hash, recuperacion_vence_en, recuperacion_intentos
       FROM usuarios
       WHERE ${condicion} AND eliminada_en IS NULL
       FOR UPDATE`,
      [valor]
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
           recuperacion_enviada_en = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [usuarioId, nuevoHash]
    );
    if (modo === "recuperar") {
      await client.query(`DELETE FROM sessions WHERE usuario_id = $1`, [usuarioId]);
      await client.query(`DELETE FROM push_suscripciones WHERE usuario_id = $1`, [usuarioId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  await registrarAuditoria({
    actor: { tipo: "usuario", id: usuarioId },
    accion:
      modo === "recuperar"
        ? "usuario.contrasena_recuperar"
        : creoContrasena
          ? "usuario.contrasena_crear"
          : "usuario.contrasena_cambiar",
    objetivo: { tipo: "usuario", id: usuarioId },
    detalle: modo === "recuperar" ? { creoContrasena } : { conCodigo: true },
  });
  return { ok: true, creoContrasena };
}

export async function restablecerContrasena(email: string, codigo: string, nueva: string) {
  return usarCodigo({ email }, codigo, nueva, "recuperar");
}

/** Crea la contraseña (cuenta de Google) o cambia la que se olvidó, con la sesión abierta. */
export async function ponerContrasenaConCodigo(usuarioId: number, codigo: string, nueva: string) {
  return usarCodigo({ id: usuarioId }, codigo, nueva, "sesion");
}
