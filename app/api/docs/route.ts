import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/app-url";
import { BASE_PATH } from "@/lib/base-path";
import { puedeVerDocs } from "@/lib/api-docs";

const SWAGGER_UI_ORIGEN = "https://cdn.jsdelivr.net";
const SWAGGER_UI = `${SWAGGER_UI_ORIGEN}/npm/swagger-ui-dist@5.17.14`;

// Script que arranca Swagger UI. Su hash va en la CSP (2026-11-20): es el único script en línea
// que se permite, y solo los de jsdelivr además de los propios.
const ARRANQUE = `
    window.ui = SwaggerUIBundle({
      url: "${BASE_PATH}/api/docs/spec",
      dom_id: "#swagger-ui",
      deepLinking: true,
      persistAuthorization: true,
      withCredentials: true,
    });
  `;
const HASH_DEL_ARRANQUE = createHash("sha256").update(ARRANQUE).digest("base64");

// CSP propia (2026-11-20): las rutas de /api no reciben la de las páginas (lib/csp.ts).
const CSP_DE_DOCS = [
  "default-src 'self'",
  `script-src 'self' ${SWAGGER_UI_ORIGEN} 'sha256-${HASH_DEL_ARRANQUE}'`,
  `style-src 'self' 'unsafe-inline' ${SWAGGER_UI_ORIGEN}`,
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Swagger UI con la especificación de /api/docs/spec. Corre en el mismo
// dominio que la API, así que "Try it out" usa la cookie de sesión del
// navegador y pasa el chequeo de Origin de proxy.ts.
export async function GET() {
  if (!(await puedeVerDocs())) {
    return NextResponse.redirect(absoluteUrl("/root"));
  }

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DataForGood API</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
  <style>body { margin: 0; background: #fff; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js" crossorigin></script>
  <script>${ARRANQUE}</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": CSP_DE_DOCS,
    },
  });
}
