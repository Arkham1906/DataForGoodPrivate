// Llamadas del navegador a /api/progreso/enfoque y la fecha de la espera en palabras. Sin imports de servidor.

import { BASE_PATH } from "@/lib/base-path";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import type { EstadoDelEnfoque } from "@/lib/gamificacion/enfoque-tipos";
import { TEXTOS } from "@/lib/gamificacion/textos";

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: ZONA_DE_CAMPANAS });

/** «3 de diciembre», en la hora de Tepic. */
export const fechaDelEnfoque = (iso: string) => FECHA.format(new Date(iso));

export async function cargarEnfoque(): Promise<EstadoDelEnfoque | null> {
  try {
    const respuesta = await fetch(`${BASE_PATH}/api/progreso/enfoque`, { cache: "no-store" });
    return respuesta.ok ? ((await respuesta.json()) as EstadoDelEnfoque) : null;
  } catch {
    return null;
  }
}

/** Guarda el enfoque. Devuelve el estado nuevo o el mensaje que se muestra a la persona. */
export async function guardarEnfoque(clave: string): Promise<{ ok: true; estado: EstadoDelEnfoque } | { ok: false; error: string }> {
  const T = TEXTOS.enfoque.errores;
  try {
    const respuesta = await fetch(`${BASE_PATH}/api/progreso/enfoque`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enfoque: clave }),
    });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as Partial<EstadoDelEnfoque> & { puedeCambiarDesde?: string | null };
    if (respuesta.ok) return { ok: true, estado: cuerpo as EstadoDelEnfoque };
    if (respuesta.status === 409 && cuerpo.puedeCambiarDesde) return { ok: false, error: T.espera(fechaDelEnfoque(cuerpo.puedeCambiarDesde)) };
    if (respuesta.status === 400) return { ok: false, error: T.noDisponible };
    return { ok: false, error: T.guardar };
  } catch {
    return { ok: false, error: T.guardar };
  }
}
