import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { absoluteUrl } from "@/lib/app-url";

const SESSION_COOKIE = "session_token";
const ROOT_SESSION_COOKIE = "root_session_token";
const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Protección CSRF para las mutaciones de /api. La cookie de sesión va con
 * SameSite, pero además se exige que el navegador declare venir de este
 * mismo sitio: Origin debe coincidir con el host al que llegó la petición
 * (o con APP_ORIGIN). Los clientes que no son navegador no mandan Origin y
 * no pueden usar la cookie de otra persona, así que se dejan pasar. Las
 * server actions no pasan por aquí: Next ya verifica su Origin.
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
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).host : null,
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

  if (pathname.startsWith("/sistema")) {
    const hasRootSession = Boolean(request.cookies.get(ROOT_SESSION_COOKIE)?.value);

    if (!hasRootSession) {
      return NextResponse.redirect(absoluteUrl("/root"));
    }

    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession) {
    // Tras iniciar sesión, /entrar regresa a la pantalla que se pidió
    // (p. ej. una campaña abierta desde /explorar).
    const destino = encodeURIComponent(`${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(absoluteUrl(`/entrar?next=${destino}`));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/campanas/:path*",
    "/mis-aportes/:path*",
    "/mis-campanas/:path*",
    "/cuenta/:path*",
    "/notificaciones/:path*",
    "/supervision/:path*",
    "/sistema/:path*",
  ],
};
