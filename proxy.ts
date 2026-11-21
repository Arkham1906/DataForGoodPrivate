import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { absoluteUrl, hostDeAppOrigin } from "@/lib/app-url";
import { CABECERA_CSP, nuevoNonce, politicaDePagina } from "@/lib/csp";

const SESSION_COOKIE = "session_token";
const ROOT_SESSION_COOKIE = "root_session_token";
const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);
// Lo lee app/(dashboard)/layout.tsx: la ficha /campanas/[id] se muestra sin sesión.
const ENCABEZADO_DETALLE_PUBLICO = "x-public-campaign-detail";
// Zona de usuario que manda a /entrar sin cookie (las rutas que tenía el matcher hasta el 2026-11-20).
const ZONA_DE_USUARIO =
  /^\/(inicio|campanas|mis-aportes|mis-campanas|cuenta|progreso|notificaciones|revisiones|supervision)(\/|$)/;

/**
 * Protección CSRF para las mutaciones de /api. La cookie de sesión va con
 * SameSite, pero además se exige que el navegador declare venir de este
 * mismo sitio: Origin debe coincidir con el host al que llegó la petición
 * (o con APP_ORIGIN). Los clientes que no son navegador no mandan Origin y
 * no pueden usar la cookie de otra persona, así que se dejan pasar. Las
 * server actions no pasan por aquí: Next ya verifica su Origin.
 * Desde el 2026-11-20 (hallazgo #5 de las pruebas de seguridad) ya no se
 * acepta X-Forwarded-Host: lo puede escribir el cliente. Detrás del proxy o
 * del túnel, el dominio público entra por APP_ORIGIN (que debe estar puesto).
 */
function origenPermitido(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return request.headers.get("sec-fetch-site") !== "cross-site";
  }

  let hostDeOrigen: string;
  try {
    hostDeOrigen = new URL(origin).host;
  } catch {
    return false;
  }

  const permitidos = [
    request.headers.get("host"),
    // Sin lanzar si APP_ORIGIN no es una URL (antes, un valor roto tiraba cada mutación de /api).
    hostDeAppOrigin(),
  ];
  return permitidos.some((host) => host && host === hostDeOrigen);
}

/**
 * Ids de la API: enteros positivos que caben en un INTEGER de Postgres. Un id como
 * "abc", "1.5" o "99999999999999999999" llegaba hasta la consulta, Postgres fallaba
 * con error de tipo y la API respondía 500. Se revisa aquí, una vez para todas las rutas.
 */
const ID_VALIDO = /^[1-9]\d{0,8}$/;
const RUTA_CON_ID = /^\/api\/(aportes|campanas|datos|notificaciones|usuarios)\/([^/]+)/;
const PARAMETROS_DE_ID = ["id", "campaignId"];

function idInvalido(request: NextRequest): NextResponse | null {
  const segmento = request.nextUrl.pathname.match(RUTA_CON_ID)?.[2];
  if (segmento !== undefined && !ID_VALIDO.test(segmento)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  for (const nombre of PARAMETROS_DE_ID) {
    const valor = request.nextUrl.searchParams.get(nombre);
    if (valor !== null && !ID_VALIDO.test(valor)) {
      return NextResponse.json({ error: `${nombre} no es válido` }, { status: 400 });
    }
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api: solo se revisa el origen de las mutaciones y la forma de los ids. La
  // sesión la valida cada route handler (este archivo solo ve si hay cookie).
  if (pathname.startsWith("/api/")) {
    if (!METODOS_SEGUROS.has(request.method) && !origenPermitido(request)) {
      return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
    }
    return idInvalido(request) ?? NextResponse.next();
  }

  // Páginas: CSP con un nonce nuevo (2026-11-20, lib/csp.ts). Va en la petición, de donde Next lo
  // toma para sus scripts, y en la respuesta, que es la que aplica el navegador.
  const nonce = nuevoNonce();
  const csp = politicaDePagina(nonce);

  // El encabezado del detalle público solo lo pone este proxy: si lo manda el navegador se borra
  // (2026-11-11). Antes pasaba tal cual y, escrito a mano, abría sin sesión cualquier pantalla de usuario.
  const encabezados = new Headers(request.headers);
  encabezados.delete(ENCABEZADO_DETALLE_PUBLICO);
  encabezados.set(CABECERA_CSP, csp);

  const seguir = () => {
    const respuesta = NextResponse.next({ request: { headers: encabezados } });
    respuesta.headers.set(CABECERA_CSP, csp);
    return respuesta;
  };

  if (/^\/sistema(\/|$)/.test(pathname)) {
    const hasRootSession = Boolean(request.cookies.get(ROOT_SESSION_COOKIE)?.value);

    if (!hasRootSession) {
      return NextResponse.redirect(absoluteUrl("/root"));
    }

    return seguir();
  }

  // Desde el 2026-11-20 el proxy pasa por todas las páginas (por la CSP), pero solo la zona de
  // usuario manda a /entrar sin cookie: las mismas rutas que tenía el matcher antes.
  if (!ZONA_DE_USUARIO.test(pathname)) {
    return seguir();
  }

  // El detalle de una campaña pública se puede consultar sin cuenta (desde /explorar), también con una
  // cookie de sesión vencida o inválida: el layout decide con la sesión real. Las acciones para participar
  // siguen protegidas por sus propios endpoints y las demás pantallas de usuario siguen pidiendo sesión.
  if (/^\/campanas\/[1-9]\d*$/.test(pathname)) {
    encabezados.set(ENCABEZADO_DETALLE_PUBLICO, "1");
    return seguir();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession) {
    // Tras iniciar sesión, /entrar regresa a la pantalla que se pidió
    // (p. ej. una campaña abierta desde /explorar).
    const destino = encodeURIComponent(`${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(absoluteUrl(`/entrar?next=${destino}`));
  }

  return seguir();
}

export const config = {
  // Toda página, para la CSP (2026-11-20), menos los archivos estáticos (_next/static, imágenes,
  // fuentes, sw.js, el manifest...). No se salta el prefetch de <Link>: también debe pasar por aquí
  // para que nadie meta el encabezado del detalle público.
  matcher: [
    "/api/:path*",
    // La portada aparte: con basePath, /dataforgood no entra en el patrón de abajo.
    "/",
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|js|mjs|css|map|txt|xml|json|webmanifest)$).*)",
  ],
};
