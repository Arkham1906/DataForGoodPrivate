// Notificaciones push (Web Push) al teléfono o navegador, aunque la app esté cerrada.
// Cada notificación que crea notificar() se manda también a las suscripciones de la persona
// (tabla push_suscripciones). El service worker public/sw.js la muestra y, al tocarla, abre su enlace.
// Sin VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en el entorno, todo esto queda apagado y la app sigue igual.
// Android (Chrome, Firefox...) lo recibe en el navegador; iPhone solo con la app agregada a la pantalla
// de inicio (iOS 16.4+).

import webpush from "web-push";
import { pool } from "@/lib/db";
import { BASE_PATH } from "@/lib/base-path";

const LLAVE_PUBLICA = process.env.VAPID_PUBLIC_KEY ?? "";
const LLAVE_PRIVADA = process.env.VAPID_PRIVATE_KEY ?? "";

/** Hasta cuántos navegadores o teléfonos por persona; al pasarse se descartan los más viejos. */
const MAXIMO_POR_USUARIO = 10;

/**
 * Solo se aceptan suscripciones de los servicios de push conocidos. Sin esto, cualquiera podría
 * registrar una "suscripción" cuyo endpoint apunte a otro servidor y la app le haría peticiones.
 */
const SERVICIOS_DE_PUSH = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge y Android
  /^(web\.push|[a-z0-9-]+\.push)\.apple\.com$/, // Safari e iPhone
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge en Windows
];

let configurado = false;
function configurar(): boolean {
  if (!LLAVE_PUBLICA || !LLAVE_PRIVADA) return false;
  if (!configurado) {
    // Contacto que piden los servicios de push por si hay problemas: el correo remitente de la app.
    const correo = (process.env.EMAIL_FROM ?? "").match(/[^\s<>"]+@[^\s<>"]+/)?.[0];
    const contacto = process.env.VAPID_SUBJECT || (correo ? `mailto:${correo}` : process.env.APP_ORIGIN ?? "");
    webpush.setVapidDetails(contacto, LLAVE_PUBLICA, LLAVE_PRIVADA);
    configurado = true;
  }
  return true;
}

/** La llave pública VAPID que el navegador necesita para suscribirse, o null si push está apagado. */
export function llavePublicaDePush(): string | null {
  return LLAVE_PUBLICA && LLAVE_PRIVADA ? LLAVE_PUBLICA : null;
}

export type SuscripcionDelNavegador = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

function endpointValido(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2000) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && SERVICIOS_DE_PUSH.some((patron) => patron.test(url.hostname));
  } catch {
    return false;
  }
}

const CLAVE = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

/** Guarda (o pasa a esta persona) la suscripción de un navegador. Devuelve el error, o null si quedó. */
export async function guardarSuscripcion(
  usuarioId: number | string,
  suscripcion: SuscripcionDelNavegador,
  userAgent: string | null
): Promise<string | null> {
  if (!llavePublicaDePush()) return "Las notificaciones push no están configuradas en este servidor";
  const { endpoint, keys } = suscripcion ?? {};
  if (!endpointValido(endpoint)) return "La suscripción no es de un servicio de push reconocido";
  if (typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string" || !CLAVE.test(keys.p256dh) || !CLAVE.test(keys.auth)) {
    return "La suscripción no trae sus claves";
  }

  // Un navegador es de quien inició sesión ahí la última vez: si otra persona entra en el mismo
  // teléfono y activa los avisos, la suscripción pasa a ella.
  await pool.query(
    `INSERT INTO push_suscripciones (usuario_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
       SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent, created_at = NOW()`,
    [usuarioId, endpoint, keys.p256dh, keys.auth, userAgent?.slice(0, 300) ?? null]
  );
  await pool.query(
    `DELETE FROM push_suscripciones
     WHERE usuario_id = $1
       AND id NOT IN (SELECT id FROM push_suscripciones WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT $2)`,
    [usuarioId, MAXIMO_POR_USUARIO]
  );
  return null;
}

/** Quita la suscripción de este navegador (al desactivar los avisos o cerrar sesión). */
export async function borrarSuscripcion(usuarioId: number | string, endpoint: unknown): Promise<void> {
  if (typeof endpoint !== "string") return;
  await pool.query(`DELETE FROM push_suscripciones WHERE usuario_id = $1 AND endpoint = $2`, [usuarioId, endpoint]);
}

export type AvisoPush = { id: string; titulo: string; mensaje: string; enlace?: string | null };

/**
 * Manda el aviso a todos los navegadores de la persona. Nunca lanza: si un envío falla solo se
 * registra en el log, y las suscripciones que el servicio ya no reconoce (404/410) se borran.
 */
export async function enviarPush(usuarioId: number | string, aviso: AvisoPush): Promise<void> {
  try {
    if (!configurar()) return;
    const { rows } = await pool.query<{ id: number; endpoint: string; p256dh: string; auth: string }>(
      `SELECT id, endpoint, p256dh, auth FROM push_suscripciones WHERE usuario_id = $1`,
      [usuarioId]
    );
    if (rows.length === 0) return;

    const payload = JSON.stringify({
      titulo: aviso.titulo,
      mensaje: aviso.mensaje.length > 180 ? `${aviso.mensaje.slice(0, 177)}…` : aviso.mensaje,
      url: `${BASE_PATH}${aviso.enlace ?? "/notificaciones"}`,
      etiqueta: `notificacion-${aviso.id}`,
      icono: `${BASE_PATH}/icono-192.png`,
      insignia: `${BASE_PATH}/insignia-96.png`,
    });

    await Promise.all(
      rows.map(async (s) => {
        try {
          // TTL de 1 día: si el teléfono está apagado más tiempo, el aviso ya no llega (sigue en la campana).
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            TTL: 86_400,
            urgency: "normal",
          });
          await pool.query(`UPDATE push_suscripciones SET ultimo_envio_en = NOW() WHERE id = $1`, [s.id]);
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await pool.query(`DELETE FROM push_suscripciones WHERE id = $1`, [s.id]);
          } else {
            console.error(`Error enviando push a la suscripción ${s.id}`, status ?? error);
          }
        }
      })
    );
  } catch (error) {
    console.error(`Error enviando push al usuario ${usuarioId}`, error);
  }
}
