// /api/eventos — actualización en vivo (long polling, 2026-10-19; lib/en-vivo.ts).
// Lo llama components/layout/ActualizacionEnVivo en bucle, en la zona de usuario y en el panel del
// SuperUsuario. La petición se queda esperando en el servidor hasta que hay algo nuevo o pasan
// ESPERA_MS, y entonces responde:
//  - `tipos`: notificaciones nuevas de la persona (solo con sesión de usuario).
//  - `version`: sube con cada cambio de contenido en la base; si cambió, las pantallas recargan.
// No es Server-Sent Events porque el túnel rápido de Cloudflare retiene las respuestas que no
// terminan; una respuesta completa pasa por cualquier proxy.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { hasRootSession } from "@/lib/rootSession";
import { escucharAvisos, escucharCambios, versionDeCambios } from "@/lib/en-vivo";

/** Cuánto espera una petición sin novedades (menos que el corte por inactividad de los proxies). */
const ESPERA_MS = 25_000;

type Respuesta = { tipos: string[]; ultimoId: number; version: number };

async function notificacionesDesde(usuarioId: number | null, desde: number): Promise<{ tipos: string[]; ultimoId: number }> {
  if (usuarioId === null) return { tipos: [], ultimoId: desde };
  const { rows } = await pool.query<{ id: number; tipo: string }>(
    `SELECT id, tipo FROM notificaciones WHERE usuario_id = $1 AND id > $2 ORDER BY id`,
    [usuarioId, desde],
  );
  return { tipos: rows.map((r) => r.tipo), ultimoId: rows.length > 0 ? rows[rows.length - 1].id : desde };
}

function entero(valor: string | null): number | null | "invalido" {
  if (valor === null) return null;
  const n = Number(valor);
  return Number.isSafeInteger(n) && n >= 0 ? n : "invalido";
}

// GET ?desde=<id>&version=<n> — sin parámetros responde al momento con el último id y la versión
// actual. Con ellos, responde en cuanto haya notificaciones con id mayor que `desde` o la versión
// sea distinta de `version`; si no, a los 25 s sin novedades.
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user && !(await hasRootSession())) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }
    const usuarioId = user ? Number(user.id) : null;
    const sinCache = { headers: { "Cache-Control": "no-store" } };

    const params = new URL(request.url).searchParams;
    const desde = entero(params.get("desde"));
    const version = entero(params.get("version"));
    if (desde === "invalido" || version === "invalido") {
      return NextResponse.json({ error: "desde y version deben ser enteros positivos" }, { status: 400 });
    }
    if (desde === null || version === null) {
      const { rows } = usuarioId
        ? await pool.query<{ ultimo: number }>(
            `SELECT COALESCE(MAX(id), 0)::int AS ultimo FROM notificaciones WHERE usuario_id = $1`,
            [usuarioId],
          )
        : { rows: [{ ultimo: 0 }] };
      return NextResponse.json<Respuesta>({ tipos: [], ultimoId: rows[0].ultimo, version: versionDeCambios() }, sinCache);
    }

    // Se escucha antes de consultar: lo que llegue entre la consulta y la espera no se pierde.
    let avisado = false;
    let despertar = () => {};
    const alAvisar = () => {
      avisado = true;
      despertar();
    };
    const dejarDeEscucharAvisos = usuarioId !== null ? escucharAvisos(usuarioId, alAvisar) : () => {};
    const dejarDeEscucharCambios = escucharCambios(alAvisar);
    try {
      // Lo que llegó entre una petición y la siguiente se entrega sin esperar.
      const yaHay = await notificacionesDesde(usuarioId, desde);
      if (yaHay.tipos.length === 0 && versionDeCambios() === version) {
        await new Promise<void>((resolver) => {
          const terminar = () => {
            clearTimeout(tiempo);
            request.signal.removeEventListener("abort", terminar);
            resolver();
          };
          const tiempo = setTimeout(terminar, ESPERA_MS);
          request.signal.addEventListener("abort", terminar);
          despertar = terminar;
          if (avisado || request.signal.aborted) terminar();
        });
        if (request.signal.aborted) return new Response(null, { status: 204 });
        return NextResponse.json<Respuesta>(
          { ...(await notificacionesDesde(usuarioId, desde)), version: versionDeCambios() },
          sinCache,
        );
      }
      return NextResponse.json<Respuesta>({ ...yaHay, version: versionDeCambios() }, sinCache);
    } finally {
      dejarDeEscucharAvisos();
      dejarDeEscucharCambios();
    }
  } catch (error) {
    console.error("Error esperando avisos en vivo", error);
    return NextResponse.json({ error: "No se pudieron leer los avisos" }, { status: 500 });
  }
}
