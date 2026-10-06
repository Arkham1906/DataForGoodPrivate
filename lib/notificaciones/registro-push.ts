// Lado del navegador de las notificaciones push: registrar public/sw.js, pedir permiso, suscribirse y
// avisar al servidor (/api/push). Sin imports de servidor: lo usan componentes cliente
// (AvisosEnEsteDispositivo, NotificationsBell, LogoutButton). Todas las funciones toleran navegadores
// sin soporte: no lanzan, devuelven false/null.

import { BASE_PATH } from "@/lib/base-path";

export type EstadoDePush =
  | "sin-soporte" // el navegador no tiene push (o la página no es HTTPS)
  | "instalar-en-ios" // iPhone/iPad sin agregar a la pantalla de inicio: ahí no hay push
  | "bloqueado" // la persona negó el permiso de notificaciones
  | "inactivo"
  | "activo";

export function soportaPush(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function esIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function instaladaComoApp(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/`, updateViaCache: "none" });
  } catch {
    return null;
  }
}

async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!soportaPush()) return null;
  const reg = await navigator.serviceWorker.getRegistration(`${BASE_PATH}/`);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function estadoDePush(): Promise<EstadoDePush> {
  if (typeof window !== "undefined" && esIOS() && !instaladaComoApp()) return "instalar-en-ios";
  if (!soportaPush()) return "sin-soporte";
  if (Notification.permission === "denied") return "bloqueado";
  return (await suscripcionActual()) && Notification.permission === "granted" ? "activo" : "inactivo";
}

function base64UrlABytes(texto: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (texto.length % 4)) % 4);
  const binario = window.atob((texto + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function guardarEnServidor(suscripcion: PushSubscription): Promise<boolean> {
  const response = await fetch(`${BASE_PATH}/api/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: suscripcion.toJSON() }),
  }).catch(() => null);
  return Boolean(response?.ok);
}

/** Pide permiso y suscribe este navegador. Devuelve el mensaje de error, o null si quedó activo. */
export async function activarPush(): Promise<string | null> {
  if (!soportaPush()) return "Este navegador no permite notificaciones push.";
  const llave = await fetch(`${BASE_PATH}/api/push`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!llave?.publicKey) return "Las notificaciones push no están configuradas en el servidor.";

  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return "No diste permiso para mostrar notificaciones.";

  const reg = await registro();
  if (!reg) return "No se pudo preparar el servicio de notificaciones.";
  await navigator.serviceWorker.ready;
  try {
    const suscripcion =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlABytes(llave.publicKey) }));
    return (await guardarEnServidor(suscripcion)) ? null : "No se pudieron activar los avisos. Intenta de nuevo.";
  } catch {
    return "No se pudo suscribir este dispositivo. Intenta de nuevo.";
  }
}

/** Quita la suscripción de este navegador, en el servidor y en el navegador. */
export async function desactivarPush(): Promise<void> {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return;
  await fetch(`${BASE_PATH}/api/push`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: suscripcion.endpoint }),
  }).catch(() => null);
  await suscripcion.unsubscribe().catch(() => false);
}

/**
 * Al cargar la app con sesión: si este navegador ya tenía los avisos activos, se vuelve a mandar la
 * suscripción para que quede a nombre de quien tiene la sesión (y se renueva si el navegador la cambió).
 */
export async function sincronizarPush(): Promise<void> {
  if (!soportaPush() || Notification.permission !== "granted") return;
  const suscripcion = await suscripcionActual();
  if (suscripcion) await guardarEnServidor(suscripcion);
}
