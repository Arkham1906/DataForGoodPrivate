import { BASE_PATH } from "@/lib/base-path";

// Next 16 ya no arma la URL absoluta de una petición a partir del header
// Host (`experimental.trustHostHeader` es `false` por defecto): usa en su
// lugar el hostname:puerto con el que arrancó el servidor. En Docker eso es
// HOSTNAME=0.0.0.0 (necesario para aceptar conexiones desde fuera del
// contenedor), así que `new URL(path, request.url)` da
// "http://0.0.0.0:3000/..." en vez de la URL pública real. Para construir
// una URL absoluta que el navegador pueda usar (redirects, links en
// correos) hay que partir de un origen configurado, no de `request.url`.
//
// APP_ORIGIN es solo el origen (sin subruta); la subruta de publicación se
// antepone aquí porque NextResponse.redirect no aplica `basePath`.
// Lo usan también proxy.ts (Origin permitido para las mutaciones, junto con Host) y la CSP
// (upgrade-insecure-requests con https). Al arrancar, problemasDeAppOrigin() avisa en el log si
// falta o está mal (instrumentation-node.ts).
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";

export function absoluteUrl(path: string) {
  return new URL(`${BASE_PATH}${path}`, APP_ORIGIN);
}

/** Host (dominio:puerto) de APP_ORIGIN, o null si no está o no es una URL. Nunca lanza. */
export function hostDeAppOrigin(): string | null {
  try {
    return process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).host : null;
  } catch {
    return null;
  }
}

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Lo que está mal en APP_ORIGIN (2026-11-20), para avisar al arrancar. Sin APP_ORIGIN o con un valor
 * equivocado, los enlaces de los correos y las redirecciones (absoluteUrl) mandan a otro lado, y
 * detrás de un proxy que cambie el Host las mutaciones de /api responden 403 (proxy.ts ya no acepta
 * X-Forwarded-Host). Al pasar de localhost al túnel de Cloudflare hay que cambiar APP_ORIGIN y
 * GOOGLE_REDIRECT_URI juntas.
 */
export function problemasDeAppOrigin(): string[] {
  const produccion = process.env.NODE_ENV === "production";
  const valor = process.env.APP_ORIGIN;
  if (!valor) {
    return produccion
      ? ["Falta APP_ORIGIN: los correos y las redirecciones apuntarán a http://localhost:3000 y, detrás de un proxy que cambie el Host, las mutaciones de /api responderán 403."]
      : [];
  }

  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return [`APP_ORIGIN no es una URL válida ("${valor}"): debe ser como https://dominio.mx, sin subruta.`];
  }

  const problemas: string[] = [];
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    problemas.push(`APP_ORIGIN debe empezar con https:// (o http:// en local), no con ${url.protocol}`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    problemas.push(`APP_ORIGIN lleva algo más que el origen (${url.pathname}${url.search}): solo va https://dominio; la subruta la pone BASE_PATH.`);
  }
  if (produccion && url.protocol === "http:" && !HOSTS_LOCALES.has(url.hostname)) {
    problemas.push(`APP_ORIGIN usa http:// en producción (${url.origin}): las cookies son Secure y el inicio de sesión no funcionará.`);
  }

  const google = process.env.GOOGLE_REDIRECT_URI;
  if (google) {
    const esperado = `${url.origin}${BASE_PATH}/api/auth/google/callback`;
    if (google !== esperado) {
      problemas.push(`GOOGLE_REDIRECT_URI (${google}) no coincide con APP_ORIGIN: debería ser ${esperado}, o "Continuar con Google" fallará.`);
    }
  }
  return problemas;
}
