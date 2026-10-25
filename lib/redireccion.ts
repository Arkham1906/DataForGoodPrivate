// A dónde volver después de iniciar sesión (?next= en /entrar). Lo usan
// proxy.ts, /entrar (cliente) y el login con Google, así que no importa
// nada de servidor.

// /inicio desde el 2026-10-24 (antes /campanas).
export const DESTINO_POR_DEFECTO = "/inicio";

/**
 * Solo acepta rutas internas de la app, sin basePath: "/campanas/12" sí,
 * "//otro.sitio", "/\otro.sitio" o "https://..." no. Así ?next= no se puede
 * usar para mandar a alguien a otro sitio tras iniciar sesión.
 */
export function destinoSeguro(valor: string | null | undefined): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//")) return DESTINO_POR_DEFECTO;
  if (/[\\\u0000-\u001f]/.test(valor)) return DESTINO_POR_DEFECTO;
  // Las pantallas del flujo de cuenta llevarían a un ciclo; /api no es una pantalla.
  if (/^\/(entrar|registro|verificar|bienvenida|api)(\/|\?|$)/.test(valor)) return DESTINO_POR_DEFECTO;
  return valor;
}

/**
 * Agrega ?next= a una ruta del flujo de cuenta (/entrar, /registro,
 * /verificar, /bienvenida) para no perder el destino entre pantallas. Si no
 * hay destino, o es el de por defecto, deja la ruta como está.
 */
export function conDestino(ruta: string, next: string | null | undefined): string {
  const destino = destinoSeguro(next);
  if (destino === DESTINO_POR_DEFECTO) return ruta;
  const separador = ruta.includes("?") ? "&" : "?";
  return `${ruta}${separador}next=${encodeURIComponent(destino)}`;
}
