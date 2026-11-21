// Content-Security-Policy de las páginas (2026-11-20, a pedido del usuario; antes no había CSP
// global). La pone proxy.ts en cada página con un nonce nuevo por petición: Next lo lee de la
// cabecera de la petición y lo agrega solo a sus scripts (guía content-security-policy de
// node_modules/next/dist/docs). Para eso toda página se arma en cada visita: app/layout.tsx
// llama a connection(). Sin imports de servidor: corre en el proxy.
//
// Por directiva:
//   - script-src: solo scripts con el nonce y lo que ellos carguen ('strict-dynamic'). Es lo que
//     frena un XSS: un <script> inyectado no trae el nonce. 'unsafe-eval' solo en next dev (React
//     lo usa para las pilas de error).
//   - style-src 'unsafe-inline': React escribe atributos style en el HTML del servidor (banners,
//     barras) y la vista previa de documentos (iframe srcdoc, hereda esta política) trae sus estilos.
//   - img-src/media-src blob: y data:: vistas previas con URL.createObjectURL, QR e imágenes de
//     documentos de Office dentro de la vista previa.
//   - worker-src blob:: el worker de PDF (pdfjs) y los que crean las librerías de Office.
//   - frame-src 'self': el texto de un aporte se muestra en un iframe de /api/aportes/[id]/archivo.
//   - connect-src 'self': todo fetch va a la propia API (el push lo manda el navegador, no la página);
//     en next dev, también el websocket de recarga.
//   - upgrade-insecure-requests solo si APP_ORIGIN es https (en http://localhost rompería todo).
//   - report-uri: el navegador avisa cada bloqueo a /api/csp-reporte, que lo deja en el log
//     ("CSP bloqueó ..."). Así se ve si la política rompe una pantalla.
//
// Swagger UI (/api/docs) y el archivo de un aporte (/api/aportes/[id]/archivo) mandan la suya.

import { BASE_PATH } from "@/lib/base-path";

export const CABECERA_CSP = "Content-Security-Policy";

/** Nonce nuevo para cada petición (base64 de 16 bytes al azar). */
export function nuevoNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

export function politicaDePagina(nonce: string): string {
  const desarrollo = process.env.NODE_ENV === "development";
  const https = (process.env.APP_ORIGIN ?? "").startsWith("https://");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${desarrollo ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
    // Cada bloqueo queda en el log del servidor (app/api/csp-reporte/route.ts).
    `report-uri ${BASE_PATH}/api/csp-reporte`,
  ].join("; ");
}
