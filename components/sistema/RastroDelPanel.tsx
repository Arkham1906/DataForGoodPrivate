"use client";

// Anota cada pantalla del panel del SuperUsuario en el rastro de navegación (components/sistema/rastro-del-panel.ts)
// para que "Volver" regrese a la pantalla de donde se llegó (2026-11-23). Va una vez en app/(panel)/layout.tsx,
// dentro de un Suspense (usa useSearchParams). No pinta nada.
// - Avisa al rastro cuando se navega por el historial (atrás/adelante del navegador o router.back). Usa el evento
//   `navigate` de la Navigation API: el popstate llega tarde, cuando Next ya cambió de pantalla (probado). Sin esa
//   API (navegadores viejos) no se avisa y "Volver" navega con su enlace, que siempre funciona.
// - Guarda cuánto se bajó en cada pantalla y, al regresar a una, baja hasta ahí cuando la página ya creció lo
//   suficiente (la bandeja de aportes abre sus grupos después de pintarse). Si la persona se mueve antes, se detiene.

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { guardarPosicion, marcarNavegacionPorHistorial, registrarEnElRastro } from "@/components/sistema/rastro-del-panel";
import { BASE_PATH } from "@/lib/base-path";

type EventoDeNavegacion = Event & { navigationType?: string };

/** Cuánto se intenta bajar a la posición guardada mientras la página termina de dibujarse. */
const ESPERA_MAXIMA_MS = 1200;

/** true mientras se baja a una posición guardada: esos desplazamientos no se guardan. */
let restaurando = false;

/** La URL del navegador como la registra el rastro (sin basePath). */
function urlDelNavegador(): string {
  const ruta = window.location.pathname.slice(BASE_PATH.length) || "/";
  // Misma codificación que useSearchParams().toString() (un espacio puede llegar como %20 o como +).
  const consulta = new URLSearchParams(window.location.search).toString();
  return consulta ? `${ruta}?${consulta}` : ruta;
}

function bajarA(y: number): () => void {
  const inicio = performance.now();
  let cuadro = 0;
  let detenido = false;
  restaurando = true;
  const detener = () => {
    detenido = true;
    restaurando = false;
  };
  const opciones = { passive: true, once: true } as const;
  window.addEventListener("wheel", detener, opciones);
  window.addEventListener("touchstart", detener, opciones);
  window.addEventListener("keydown", detener, opciones);
  const intentar = () => {
    if (detenido) return;
    window.scrollTo(0, y);
    const llego = Math.abs(window.scrollY - y) < 2;
    if (!llego && performance.now() - inicio < ESPERA_MAXIMA_MS) cuadro = requestAnimationFrame(intentar);
    else restaurando = false;
  };
  cuadro = requestAnimationFrame(intentar);
  return () => {
    detenido = true;
    restaurando = false;
    cancelAnimationFrame(cuadro);
    window.removeEventListener("wheel", detener);
    window.removeEventListener("touchstart", detener);
    window.removeEventListener("keydown", detener);
  };
}

export default function RastroDelPanel() {
  const ruta = usePathname();
  const consulta = useSearchParams().toString();
  const url = consulta ? `${ruta}?${consulta}` : ruta;
  const urlActual = useRef(url);

  useEffect(() => {
    const navegacion = (window as unknown as { navigation?: EventTarget }).navigation;
    if (!navegacion) return;
    const alNavegar = (e: Event) => {
      if ((e as EventoDeNavegacion).navigationType === "traverse") marcarNavegacionPorHistorial();
    };
    navegacion.addEventListener("navigate", alNavegar);
    return () => navegacion.removeEventListener("navigate", alNavegar);
  }, []);

  // La posición de la pantalla actual, guardada mientras se baja (una vez por cuadro). No se guarda mientras se cambia
  // de pantalla (la URL del navegador ya no es la registrada: Next sube la página al llegar a otra) ni mientras se
  // restaura una posición.
  useEffect(() => {
    let pendiente = 0;
    const alDesplazar = () => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(() => {
        pendiente = 0;
        if (restaurando || urlDelNavegador() !== urlActual.current) return;
        guardarPosicion(urlActual.current, window.scrollY);
      });
    };
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => {
      window.removeEventListener("scroll", alDesplazar);
      cancelAnimationFrame(pendiente);
    };
  }, []);

  useEffect(() => {
    urlActual.current = url;
    const posicion = registrarEnElRastro(url);
    if (posicion && posicion > 0) return bajarA(posicion);
  }, [url]);

  return null;
}
