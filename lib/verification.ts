// Verificación del correo: código de 6 dígitos enviado por correo (lib/correo.ts), guardado como hash.
// Vence en 15 minutos y admite 3 intentos. El código vive en codigos_usuario con proposito
// 'verificacion' (2026-10-30; antes, columnas verification_*).
//
// La cookie verificacion_pendiente liga /verificar con la cuenta. Desde el 2026-11-20 (arreglo de
// seguridad) lleva una ficha al azar de 32 bytes y en la BD solo se guarda su sha256 (ficha_hash):
// antes la cookie pending_verification_id llevaba el id del usuario, y con poner el id de otra cuenta
// sin verificar se veía su correo, se probaban códigos y, al acertar, se abría su sesión. La ficha la
// dan solo el registro y el login con la contraseña correcta, y dura HORAS_DE_LA_FICHA.
//
// Topes contra adivinar el código o mandar correos sin fin (mismo 2026-11-20):
//   - SEGUNDOS_ENTRE_ENVIOS entre dos códigos a la misma cuenta (como en recuperar contraseña);
//   - CODIGOS_POR_HORA códigos por cuenta en una hora;
//   - un código nuevo reinicia los intentos, pero solo si pasa los dos topes: antes reenviar no
//     tenía espera y ponía intentos = 0, así que bastaba con insistir para probar todos los códigos.
//   - cada intento se descuenta en un solo UPDATE condicional antes de comparar, para que muchas
//     peticiones a la vez no usen el mismo intento.
//
// Verificación señuelo (2026-11-20, hallazgo #4): registrarse con un correo que ya tiene cuenta
// respondía 409 "ya está registrado" y así se sabía qué correos tienen cuenta. Ahora el registro
// responde igual que con una cuenta nueva y deja una ficha de verificaciones_senuelo: /verificar
// muestra el correo, la cuenta regresiva, los intentos y la espera para reenviar como siempre, pero
// ningún código sirve. A la persona dueña del correo le llega un aviso (uno por hora como máximo)
// con los enlaces para entrar o recuperar la contraseña. Para que el tiempo de respuesta tampoco
// delate nada, todos los correos de este módulo salen después de responder (after), como el de
// recuperar la contraseña: un fallo del correo ya no se ve en la respuesta, solo en el log.

import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { after, type NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { enviarCorreo, escaparHtml } from "@/lib/correo";
import { absoluteUrl } from "@/lib/app-url";

export const PENDING_COOKIE = "verificacion_pendiente";
/** Nombre de la cookie hasta el 2026-11-20 (llevaba el id): se borra donde se toca la nueva. */
const COOKIE_ANTERIOR = "pending_verification_id";
const CODE_LENGTH = 6;
const CODE_DURATION_MS = 1000 * 60 * 15; // 15 minutos
const MAX_ATTEMPTS = 3;
/** Segundos mínimos entre dos códigos a la misma cuenta. */
export const SEGUNDOS_ENTRE_ENVIOS = 30;
/** Códigos por cuenta en una hora. */
export const CODIGOS_POR_HORA = 5;
/** Horas que vale la ficha de la cookie. */
const HORAS_DE_LA_FICHA = 24;
const FORMATO_DE_FICHA = /^[A-Za-z0-9_-]{43}$/;

function sha256(texto: string) {
  return createHash("sha256").update(texto).digest("hex");
}

function mismoHash(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Manda el correo después de responder; si falla, solo queda en el log. */
function enviarDespues(email: string, asunto: string, html: string) {
  after(async () => {
    try {
      await enviarCorreo(email, asunto, html);
    } catch (error) {
      console.error(`No se pudo enviar el correo "${asunto}"`, error);
    }
  });
}

function enviarCodigoDespues(email: string, nombre: string, code: string) {
  enviarDespues(
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

function ponerCookie(response: NextResponse, ficha: string) {
  response.cookies.set(PENDING_COOKIE, ficha, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HORAS_DE_LA_FICHA * 60 * 60,
  });
  response.cookies.delete(COOKIE_ANTERIOR);
}

export type ResultadoDeEnvio =
  | { enviado: true; expiresAt: Date; resendAvailableAt: Date }
  | {
      enviado: false;
      /** "espera": aún no pasan SEGUNDOS_ENTRE_ENVIOS; "tope": ya van CODIGOS_POR_HORA en la hora. */
      motivo: "espera" | "tope";
      /** Segundos que faltan para poder pedir otro. */
      segundos: number;
      /** Vencimiento del código que sigue vigente (el último que se mandó). */
      expiresAt: Date | null;
      resendAvailableAt: Date;
    };

/** Mensaje para la persona cuando no se mandó un código nuevo. */
export function mensajeDeEnvioDetenido(resultado: Extract<ResultadoDeEnvio, { enviado: false }>) {
  if (resultado.motivo === "tope") {
    const minutos = Math.max(1, Math.ceil(resultado.segundos / 60));
    return `Ya pediste ${CODIGOS_POR_HORA} códigos en la última hora. Intenta de nuevo en ${minutos} min.`;
  }
  return `Espera ${resultado.segundos} s para pedir otro código.`;
}

// Las dos tablas (codigos_usuario y verificaciones_senuelo) tienen las mismas columnas de espera.
const HORA_NUEVA = (t: string) => `${t}.envios_desde IS NULL OR ${t}.envios_desde <= NOW() - INTERVAL '1 hour'`;
const PASA_LOS_TOPES = (t: string) =>
  `${t}.enviado_en <= NOW() - make_interval(secs => ${SEGUNDOS_ENTRE_ENVIOS})
   AND (${HORA_NUEVA(t)} OR ${t}.envios_en_hora < ${CODIGOS_POR_HORA})`;
const NUEVO_ENVIO = (t: string) =>
  `intentos = 0,
   enviado_en = NOW(),
   envios_en_hora = CASE WHEN ${HORA_NUEVA(t)} THEN 1 ELSE ${t}.envios_en_hora + 1 END,
   envios_desde = CASE WHEN ${HORA_NUEVA(t)} THEN NOW() ELSE ${t}.envios_desde END`;

/** Cuánto falta para otro envío (no pasó la espera o el tope por hora). */
async function envioDetenido(tabla: string, condicion: string, valor: unknown): Promise<ResultadoDeEnvio> {
  const estado = await pool.query<{ vence_en: Date; espera: number; tope: number }>(
    `SELECT vence_en,
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM enviado_en + make_interval(secs => $2) - NOW())))::int AS espera,
            CASE WHEN envios_desde > NOW() - INTERVAL '1 hour' AND envios_en_hora >= $3
                 THEN GREATEST(0, CEIL(EXTRACT(EPOCH FROM envios_desde + INTERVAL '1 hour' - NOW())))::int
                 ELSE 0 END AS tope
     FROM ${tabla} WHERE ${condicion}`,
    [valor, SEGUNDOS_ENTRE_ENVIOS, CODIGOS_POR_HORA]
  );
  const fila = estado.rows[0];
  const tope = fila?.tope ?? 0;
  const segundos = Math.max(1, tope > 0 ? tope : (fila?.espera ?? SEGUNDOS_ENTRE_ENVIOS));
  return {
    enviado: false,
    motivo: tope > 0 ? "tope" : "espera",
    segundos,
    expiresAt: fila?.vence_en ?? null,
    resendAvailableAt: new Date(Date.now() + segundos * 1000),
  };
}

function envioHecho(expiresAt: Date): ResultadoDeEnvio {
  return {
    enviado: true,
    expiresAt,
    resendAvailableAt: new Date(Date.now() + SEGUNDOS_ENTRE_ENVIOS * 1000),
  };
}

/**
 * Genera un código y lo manda, si la cuenta pasa la espera y el tope por hora (un solo
 * INSERT ... ON CONFLICT condicional: de dos peticiones juntas solo una manda correo).
 * Con `response` (registro y login) además da una ficha nueva y la pone en la cookie,
 * aunque no se haya mandado código: el último que llegó al correo sigue sirviendo.
 */
export async function startVerification(
  usuarioId: number,
  email: string,
  nombre: string,
  response?: NextResponse
): Promise<ResultadoDeEnvio> {
  const code = randomInt(0, 1_000_000).toString().padStart(CODE_LENGTH, "0");
  const expiresAt = new Date(Date.now() + CODE_DURATION_MS);

  const guardado = await pool.query(
    `INSERT INTO codigos_usuario
       (usuario_id, proposito, codigo_hash, vence_en, intentos, enviado_en, envios_en_hora, envios_desde)
     VALUES ($1, 'verificacion', $2, $3, 0, NOW(), 1, NOW())
     ON CONFLICT (usuario_id, proposito) DO UPDATE
       SET codigo_hash = EXCLUDED.codigo_hash, vence_en = EXCLUDED.vence_en, ${NUEVO_ENVIO("codigos_usuario")}
       WHERE ${PASA_LOS_TOPES("codigos_usuario")}
     RETURNING vence_en`,
    [usuarioId, sha256(code), expiresAt]
  );

  if (response) {
    const ficha = randomBytes(32).toString("base64url");
    await pool.query(
      `UPDATE codigos_usuario SET ficha_hash = $2, ficha_creada_en = NOW()
       WHERE usuario_id = $1 AND proposito = 'verificacion'`,
      [usuarioId, sha256(ficha)]
    );
    ponerCookie(response, ficha);
  }

  if (!guardado.rowCount) {
    return envioDetenido("codigos_usuario", "usuario_id = $1 AND proposito = 'verificacion'", usuarioId);
  }
  enviarCodigoDespues(email, nombre, code);
  return envioHecho(expiresAt);
}

/**
 * Registro con un correo que ya tiene cuenta: misma cookie y misma pantalla que una cuenta nueva,
 * con una ficha de verificaciones_senuelo. A quien es dueño del correo le avisa (una vez por hora).
 */
export async function startVerificacionSenuelo(email: string, response: NextResponse): Promise<void> {
  const ficha = randomBytes(32).toString("base64url");
  const reciente = await pool.query(
    `WITH viejas AS (DELETE FROM verificaciones_senuelo WHERE creada_en < NOW() - make_interval(hours => $2))
     SELECT 1 FROM verificaciones_senuelo WHERE email = $1 AND creada_en > NOW() - INTERVAL '1 hour' LIMIT 1`,
    [email, HORAS_DE_LA_FICHA]
  );
  await pool.query(
    `INSERT INTO verificaciones_senuelo (ficha_hash, email, vence_en) VALUES ($1, $2, $3)`,
    [sha256(ficha), email, new Date(Date.now() + CODE_DURATION_MS)]
  );
  ponerCookie(response, ficha);

  if (!reciente.rowCount) {
    enviarDespues(
      email,
      "Alguien intentó crear una cuenta con tu correo en DataForGood",
      `
        <p>Hola,</p>
        <p>Alguien intentó crear una cuenta de DataForGood con este correo, pero ya tienes una.</p>
        <p>Si fuiste tú, <a href="${absoluteUrl("/entrar")}">entra con tu correo</a> o
          <a href="${absoluteUrl("/recuperar")}">recupera tu contraseña</a>. Si tu cuenta aún no está
          verificada, al entrar con tu contraseña te mandamos el código.</p>
        <p>Si no fuiste tú, ignora este correo: tu cuenta no cambió.</p>
      `
    );
  }
}

export interface PendingVerification {
  /** null en una verificación señuelo (no hay cuenta detrás de la ficha). */
  id: number | null;
  nombre: string;
  email: string;
  expiresAt: Date | null;
  attemptsLeft: number;
  /** Desde cuándo se puede pedir otro código (espera entre envíos). */
  resendAvailableAt: Date;
  /** sha256 de la ficha (para la señuelo). */
  fichaHash: string;
}

/**
 * La verificación de la ficha de la cookie: la de una cuenta que existe, sigue sin verificar y la
 * ficha no venció, o una señuelo. Las dos se ven igual hacia afuera.
 */
export async function getPendingVerification(): Promise<PendingVerification | null> {
  const cookieStore = await cookies();
  const ficha = cookieStore.get(PENDING_COOKIE)?.value;

  if (!ficha || !FORMATO_DE_FICHA.test(ficha)) {
    return null;
  }
  const fichaHash = sha256(ficha);

  const result = await pool.query(
    `SELECT u.id, u.nombre, u.email, c.vence_en, c.intentos,
            c.enviado_en + make_interval(secs => $3) AS reenviar_desde
     FROM codigos_usuario c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.proposito = 'verificacion'
       AND c.ficha_hash = $1
       AND c.ficha_creada_en > NOW() - make_interval(hours => $2)
       AND u.email_verificado = false
       AND u.eliminada_en IS NULL
     UNION ALL
     SELECT NULL, '', s.email, s.vence_en, s.intentos, s.enviado_en + make_interval(secs => $3)
     FROM verificaciones_senuelo s
     WHERE s.ficha_hash = $1 AND s.creada_en > NOW() - make_interval(hours => $2)
     LIMIT 1`,
    [fichaHash, HORAS_DE_LA_FICHA, SEGUNDOS_ENTRE_ENVIOS]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    expiresAt: row.vence_en,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - (row.intentos ?? 0)),
    resendAvailableAt: row.reenviar_desde,
    fichaHash,
  };
}

/** "Reenviar código" de /verificar: con la señuelo cuenta la espera igual, sin mandar nada. */
export async function reenviarCodigo(pending: PendingVerification): Promise<ResultadoDeEnvio> {
  if (pending.id !== null) {
    return startVerification(pending.id, pending.email, pending.nombre);
  }
  const expiresAt = new Date(Date.now() + CODE_DURATION_MS);
  const renovado = await pool.query(
    `UPDATE verificaciones_senuelo SET vence_en = $2, ${NUEVO_ENVIO("verificaciones_senuelo")}
     WHERE ficha_hash = $1 AND ${PASA_LOS_TOPES("verificaciones_senuelo")}`,
    [pending.fichaHash, expiresAt]
  );
  if (!renovado.rowCount) {
    return envioDetenido("verificaciones_senuelo", "ficha_hash = $1", pending.fichaHash);
  }
  return envioHecho(expiresAt);
}

export async function clearPendingVerificationCookie(response?: NextResponse) {
  if (response) {
    response.cookies.delete(PENDING_COOKIE);
    response.cookies.delete(COOKIE_ANTERIOR);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.delete(PENDING_COOKIE);
  cookieStore.delete(COOKIE_ANTERIOR);
}

export type VerifyCodeResult =
  | { success: true }
  | { success: false; error: string; attemptsLeft: number };

/** Mensajes cuando ya no quedan intentos o el código venció (iguales en la señuelo). */
function sinIntentoDisponible(fila: { vence_en: Date; intentos: number } | undefined): VerifyCodeResult {
  if (fila && fila.intentos < MAX_ATTEMPTS && new Date(fila.vence_en) <= new Date()) {
    return { success: false, error: "El código expiró, solicita uno nuevo", attemptsLeft: 0 };
  }
  return { success: false, error: "Solicita un nuevo código", attemptsLeft: 0 };
}

export async function verifyCode(pending: PendingVerification, code: string): Promise<VerifyCodeResult> {
  if (pending.id === null) {
    // Señuelo: se descuentan los intentos igual, y ningún código sirve.
    const intento = await pool.query<{ intentos: number }>(
      `UPDATE verificaciones_senuelo SET intentos = intentos + 1
       WHERE ficha_hash = $1 AND intentos < $2 AND vence_en > NOW()
       RETURNING intentos`,
      [pending.fichaHash, MAX_ATTEMPTS]
    );
    if (!intento.rowCount) {
      const estado = await pool.query<{ vence_en: Date; intentos: number }>(
        `SELECT vence_en, intentos FROM verificaciones_senuelo WHERE ficha_hash = $1`,
        [pending.fichaHash]
      );
      return sinIntentoDisponible(estado.rows[0]);
    }
    return {
      success: false,
      error: "Código incorrecto",
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - intento.rows[0].intentos),
    };
  }

  const usuarioId = pending.id;
  // Descuenta el intento antes de comparar, en un solo paso: si llegan muchas peticiones a la
  // vez, cada una gasta el suyo y ninguna pasa del tope.
  const intento = await pool.query<{ codigo_hash: string; intentos: number }>(
    `UPDATE codigos_usuario SET intentos = intentos + 1
     WHERE usuario_id = $1 AND proposito = 'verificacion' AND intentos < $2 AND vence_en > NOW()
     RETURNING codigo_hash, intentos`,
    [usuarioId, MAX_ATTEMPTS]
  );

  if (!intento.rowCount) {
    const estado = await pool.query<{ vence_en: Date; intentos: number }>(
      `SELECT vence_en, intentos FROM codigos_usuario WHERE usuario_id = $1 AND proposito = 'verificacion'`,
      [usuarioId]
    );
    return sinIntentoDisponible(estado.rows[0]);
  }

  const { codigo_hash, intentos } = intento.rows[0];

  if (!mismoHash(sha256(code), codigo_hash)) {
    return {
      success: false,
      error: "Código incorrecto",
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - intentos),
    };
  }

  // Borra el código (y su ficha) y marca el correo en el mismo paso: el código sirve una vez.
  await pool.query(
    `WITH usado AS (
       DELETE FROM codigos_usuario
       WHERE usuario_id = $1 AND proposito = 'verificacion' AND codigo_hash = $2
       RETURNING usuario_id
     )
     UPDATE usuarios SET email_verificado = true WHERE id IN (SELECT usuario_id FROM usado)`,
    [usuarioId, codigo_hash]
  );

  return { success: true };
}
