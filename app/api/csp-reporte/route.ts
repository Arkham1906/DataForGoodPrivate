// POST /api/csp-reporte — el navegador manda aquí cada cosa que bloquea la CSP de las páginas
// (report-uri de lib/csp.ts, 2026-11-20). Solo deja una línea en el log del servidor
// ("CSP bloqueó ...") para ver en `docker compose logs app` si la política rompe algo o si alguien
// intenta inyectar contenido. No guarda nada en la BD. Público (el navegador no manda sesión);
// tope por IP para que no llenen el log.

import { NextResponse } from "next/server";
import { contarPeticion } from "@/lib/limite-por-ip";

/** Recorta un texto del reporte para el log (viene del navegador: no se confía en su largo). */
function corto(valor: unknown, largo = 200): string {
  return String(valor ?? "").replace(/[\r\n]+/g, " ").slice(0, largo);
}

export async function POST(request: Request) {
  // Sin respuesta útil para el navegador: siempre 204, también al pasar el tope.
  if (contarPeticion("cspReporte", request.headers) !== null) {
    return new NextResponse(null, { status: 204 });
  }

  const texto = (await request.text().catch(() => "")).slice(0, 10_000);
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // Formato viejo (report-uri): { "csp-report": {...} }. Formato nuevo (Reporting API): [{ body: {...} }].
  const reportes = Array.isArray(cuerpo)
    ? cuerpo.map((r) => (r as { body?: Record<string, unknown> })?.body)
    : [(cuerpo as { "csp-report"?: Record<string, unknown> })?.["csp-report"]];

  for (const r of reportes.slice(0, 20)) {
    if (!r) continue;
    const directiva = r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"];
    const bloqueado = r["blocked-uri"] ?? r.blockedURL;
    const pagina = r["document-uri"] ?? r.documentURL;
    const fuente = r["source-file"] ?? r.sourceFile;
    console.warn(
      `CSP bloqueó ${corto(directiva, 40)}: ${corto(bloqueado)} en ${corto(pagina)}` +
        (fuente ? ` (desde ${corto(fuente)}:${corto(r["line-number"] ?? r.lineNumber, 10)})` : "")
    );
  }

  return new NextResponse(null, { status: 204 });
}
