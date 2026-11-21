// Topes por IP de las rutas de cuenta sin sesión (2026-11-20, hallazgo #3 de las pruebas de
// seguridad): entrar, registrarse, verificar el correo y recuperar la contraseña. Cada cuenta ya
// tiene su propio tope (bloqueo tras fallar la contraseña, 3 intentos por código, espera entre
// correos); estos topes frenan a quien prueba contra MUCHAS cuentas desde la misma IP o manda
// correos sin fin.
//
// Ventana fija en memoria, como el tope de /root (lib/root-acceso.ts): la app corre en un solo
// proceso (next start). Se pierde al reiniciar y no se comparte entre réplicas.
//
// La IP sale de ipDelCliente (lib/ip.ts): el último valor de X-Forwarded-For. Mientras el puerto
// de la app sea accesible sin pasar por el proxy, quien cambie ese encabezado en cada petición
// esquiva el tope (pendiente de despliegue: que solo el proxy llegue al puerto).
//
// Las cifras son generosas a propósito: en una escuela o empresa muchas personas salen por la
// misma IP. Donde se puede, se cuentan solo los FALLOS (contraseña o código equivocados), no
// los aciertos.
//
// Bloqueo del login por correo (2026-11-20, hallazgo #4): reemplaza al bloqueo de la cuenta en la
// BD (usuarios.failed_login_attempts / locked_until, que el login ya no usa). Antes, 5 fallos
// bloqueaban la cuenta 15 min para todos: cualquiera podía dejar fuera a otra persona, y el aviso
// "Cuenta bloqueada" solo salía con correos que tienen cuenta. Ahora se cuenta por el CORREO
// escrito, exista o no la cuenta (no revela nada): 5 fallos del mismo correo desde la misma IP
// bloquean esa pareja, y un tope alto por correo desde cualquier IP frena a quien reparte la
// fuerza bruta entre muchas IPs. Recuperar la contraseña lo limpia.

import { NextResponse } from "next/server";
import { ipDelCliente } from "@/lib/ip";

interface Limite {
  maximo: number;
  ventanaMs: number;
}

const MINUTO = 60_000;

// Cifras confirmadas por el usuario el 2026-11-20 (generosas a propósito: en una escuela muchas
// personas salen por la misma IP). Si se cambian, actualizar docs/rutas.md y roles-y-sesiones.md.
export const LIMITES_POR_IP = {
  /** Contraseñas equivocadas (o correos sin cuenta) al entrar. */
  login: { maximo: 30, ventanaMs: 15 * MINUTO },
  /** Cuentas creadas. */
  registro: { maximo: 30, ventanaMs: 60 * MINUTO },
  /** Códigos de verificación equivocados. */
  verificar: { maximo: 30, ventanaMs: 15 * MINUTO },
  /** Pedir otro código de verificación. */
  reenviar: { maximo: 20, ventanaMs: 60 * MINUTO },
  /** Pedir el código para recuperar la contraseña. */
  recuperar: { maximo: 20, ventanaMs: 15 * MINUTO },
  /** Códigos de recuperación equivocados. */
  restablecer: { maximo: 30, ventanaMs: 15 * MINUTO },
  /** Reportes de la CSP (POST /api/csp-reporte): solo para no llenar el log. */
  cspReporte: { maximo: 100, ventanaMs: 15 * MINUTO },
  /** Contraseñas equivocadas de un correo desde una IP (clave: correo + IP). */
  loginCorreoIp: { maximo: 5, ventanaMs: 15 * MINUTO },
  /** Contraseñas equivocadas de un correo desde cualquier IP (clave: correo). */
  loginCorreo: { maximo: 50, ventanaMs: 15 * MINUTO },
} satisfies Record<string, Limite>;

export type NombreDeLimite = keyof typeof LIMITES_POR_IP;

const registros = new Map<string, { n: number; desde: number }>();
/** Con más claves que esto se borran las vencidas (para que el mapa no crezca sin fin). */
const LIMPIAR_DESDE = 10_000;

function limpiarVencidos(ahora: number) {
  if (registros.size < LIMPIAR_DESDE) return;
  for (const [clave, registro] of registros) {
    const nombre = clave.slice(0, clave.indexOf("|")) as NombreDeLimite;
    if (ahora - registro.desde >= LIMITES_POR_IP[nombre].ventanaMs) registros.delete(clave);
  }
}

function segundosPorClave(nombre: NombreDeLimite, clave: string): number | null {
  const { maximo, ventanaMs } = LIMITES_POR_IP[nombre];
  const registro = registros.get(`${nombre}|${clave}`);
  if (!registro) return null;
  const restante = registro.desde + ventanaMs - Date.now();
  if (restante <= 0 || registro.n < maximo) return null;
  return Math.max(1, Math.ceil(restante / 1000));
}

function sumarPorClave(nombre: NombreDeLimite, clave: string): void {
  const ahora = Date.now();
  limpiarVencidos(ahora);
  const llave = `${nombre}|${clave}`;
  const registro = registros.get(llave);
  if (!registro || ahora - registro.desde >= LIMITES_POR_IP[nombre].ventanaMs) {
    registros.set(llave, { n: 1, desde: ahora });
    return;
  }
  registro.n += 1;
}

/** Segundos que faltan si la IP ya llegó al tope; null si puede seguir. No cuenta nada. */
export function segundosDeBloqueo(nombre: NombreDeLimite, headers: Headers): number | null {
  return segundosPorClave(nombre, ipDelCliente(headers));
}

/** Suma una vez a la IP (un fallo, o una petición en los topes que cuentan todas). */
export function sumarAlLimite(nombre: NombreDeLimite, headers: Headers): void {
  sumarPorClave(nombre, ipDelCliente(headers));
}

/* ── Bloqueo del login por correo (hallazgo #4) ─────────────────────────────── */

/** Segundos que faltan si este correo está bloqueado desde esta IP o desde todas; null si no. */
export function segundosDeBloqueoDeCorreo(email: string, headers: Headers): number | null {
  const porPareja = segundosPorClave("loginCorreoIp", `${email}|${ipDelCliente(headers)}`);
  const general = segundosPorClave("loginCorreo", email);
  if (porPareja === null && general === null) return null;
  return Math.max(porPareja ?? 0, general ?? 0);
}

/** Una contraseña equivocada para este correo (exista o no la cuenta). */
export function sumarFalloDeCorreo(email: string, headers: Headers): void {
  sumarPorClave("loginCorreoIp", `${email}|${ipDelCliente(headers)}`);
  sumarPorClave("loginCorreo", email);
}

/** Al entrar bien: borra los fallos de este correo desde esta IP (el tope general sigue). */
export function limpiarFallosDeCorreoEnIp(email: string, headers: Headers): void {
  registros.delete(`loginCorreoIp|${email}|${ipDelCliente(headers)}`);
}

/** Al recuperar la contraseña: borra todos los fallos de este correo, de cualquier IP. */
export function limpiarFallosDeCorreo(email: string): void {
  registros.delete(`loginCorreo|${email}`);
  const prefijo = `loginCorreoIp|${email}|`;
  for (const clave of registros.keys()) if (clave.startsWith(prefijo)) registros.delete(clave);
}

/** 429 del bloqueo por correo: el mismo texto exista o no la cuenta. */
export function respuestaDeBloqueoDeCorreo(segundos: number): NextResponse {
  const minutos = Math.max(1, Math.ceil(segundos / 60));
  return NextResponse.json(
    {
      error: `Demasiados intentos con este correo. Espera ${minutos} min o recupera tu contraseña.`,
      esperaSegundos: segundos,
    },
    { status: 429, headers: { "Retry-After": String(segundos) } }
  );
}

/**
 * Para los topes que cuentan todas las peticiones (registro, reenviar, recuperar): si la IP
 * ya llegó al tope devuelve los segundos que faltan; si no, cuenta esta petición y da null.
 */
export function contarPeticion(nombre: NombreDeLimite, headers: Headers): number | null {
  const segundos = segundosDeBloqueo(nombre, headers);
  if (segundos !== null) return segundos;
  sumarAlLimite(nombre, headers);
  return null;
}

/** Respuesta 429 con Retry-After y el mismo mensaje en todas las rutas. */
export function respuestaDeLimite(segundos: number): NextResponse {
  const minutos = Math.max(1, Math.ceil(segundos / 60));
  return NextResponse.json(
    {
      error: `Demasiados intentos desde esta conexión. Intenta de nuevo en ${minutos} min.`,
      esperaSegundos: segundos,
    },
    { status: 429, headers: { "Retry-After": String(segundos) } }
  );
}
