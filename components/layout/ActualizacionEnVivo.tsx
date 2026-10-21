"use client";

// Actualización en vivo (2026-10-19; lib/en-vivo.ts). Va en los layouts de la zona de usuario y del
// panel del SuperUsuario. Llama en bucle a GET /api/eventos (long polling) y, según lo que llegue:
//  - Notificaciones nuevas: avisa a la campana (EVENTO_NOTIFICACIONES) y, si cambió el rol o hay una
//    sanción (AVISOS_QUE_REFRESCAN), refresca la página para que el menú y los permisos se pongan al día.
//  - Cambio de contenido (otra versión): refresca las partes de servidor (router.refresh) y avisa a las
//    pantallas cliente (EVENTO_DATOS → useRecargaEnVivo) para que vuelvan a leer sus datos.
// Con la pestaña oculta no recarga: lo hace al volver a ella. Si falla, reintenta a los 5 s.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";
import { EVENTO_DATOS } from "@/lib/en-vivo-cliente";
import { AVISOS_QUE_REFRESCAN, EVENTO_NOTIFICACIONES } from "@/lib/notificaciones/tipos";

/** Varios cambios seguidos (p. ej. aceptar 10 aportes) se juntan en una sola recarga. */
const JUNTAR_MS = 800;

type Respuesta = { tipos: string[]; ultimoId: number; version: number };

export default function ActualizacionEnVivo() {
  const router = useRouter();

  useEffect(() => {
    const cancelar = new AbortController();
    let pendiente = false;
    let temporizador: number | undefined;

    const recargar = () => {
      if (document.visibilityState !== "visible") {
        pendiente = true;
        return;
      }
      pendiente = false;
      router.refresh();
      window.dispatchEvent(new Event(EVENTO_DATOS));
    };
    const programarRecarga = () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(recargar, JUNTAR_MS);
    };
    const alVolver = () => {
      if (document.visibilityState === "visible" && pendiente) recargar();
    };
    document.addEventListener("visibilitychange", alVolver);

    void (async () => {
      let ultimo: Respuesta | null = null;
      while (!cancelar.signal.aborted) {
        try {
          const consulta: string = ultimo ? `?desde=${ultimo.ultimoId}&version=${ultimo.version}` : "";
          const response = await fetch(`${BASE_PATH}/api/eventos${consulta}`, { cache: "no-store", signal: cancelar.signal });
          if (response.status === 401) return; // Sin sesión: VigilanteDeSesion o el layout se encargan.
          if (!response.ok) throw new Error(String(response.status));
          const nuevo: Respuesta = await response.json();
          if (ultimo) {
            if (nuevo.tipos.length > 0) {
              window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES));
              if (nuevo.tipos.some((tipo) => AVISOS_QUE_REFRESCAN.has(tipo))) router.refresh();
            }
            if (nuevo.version !== ultimo.version) programarRecarga();
          }
          ultimo = nuevo;
        } catch {
          if (cancelar.signal.aborted) return;
          await new Promise((resolver) => window.setTimeout(resolver, 5_000));
        }
      }
    })();

    return () => {
      cancelar.abort();
      window.clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [router]);

  return null;
}
