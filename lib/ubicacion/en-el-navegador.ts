"use client";

// Ubicación en el navegador (2026-10-31; ver lib/ubicacion/zona-detectada.ts). La persona la activa con un
// botón en /campanas (el navegador pide permiso ahí, nunca solo); desde entonces
// components/layout/DetectorDeUbicacion la vuelve a mandar cada tanto para notar el cambio de zona.
// "Usar mi ubicación" se recuerda en este navegador (localStorage): en otro dispositivo se activa aparte.
// Las coordenadas van a POST /api/ubicacion y ahí solo se convierten en estado y municipio.

import { BASE_PATH } from "@/lib/base-path";

export type ZonaDetectada = { estado: string; municipio: string };

/** Se lanza con la zona nueva (o null al dejar de usar la ubicación) para que las pantallas se pongan al día. */
export const EVENTO_ZONA = "dataforgood:zona-detectada";

const CLAVE = "dfg:usar-ubicacion";

/** "si" (la activó), "no" (dijo "Ahora no" o la quitó) o null (aún no decide). */
export function preferenciaDeUbicacion(): "si" | "no" | null {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    return valor === "si" || valor === "no" ? valor : null;
  } catch {
    return null;
  }
}

export function guardarPreferenciaDeUbicacion(valor: "si" | "no"): void {
  try {
    window.localStorage.setItem(CLAVE, valor);
  } catch {
    // Sin almacenamiento (ventana privada): solo dura esta visita.
  }
}

export function hayGeolocalizacion(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

/**
 * Pide la posición al navegador (la primera vez muestra el permiso) y la manda al servidor. Precisión
 * baja a propósito (red o Wi-Fi): para saber el municipio basta y gasta menos batería.
 * Devuelve la zona (null fuera de México) o lanza un Error con un mensaje para la persona.
 */
export async function detectarYEnviarZona(): Promise<{ zona: ZonaDetectada | null; avisado: boolean }> {
  if (!hayGeolocalizacion()) throw new Error("Este navegador no permite compartir la ubicación.");
  const posicion = await new Promise<GeolocationPosition>((resolver, rechazar) =>
    navigator.geolocation.getCurrentPosition(resolver, rechazar, {
      enableHighAccuracy: false,
      maximumAge: 5 * 60_000,
      timeout: 20_000,
    })
  ).catch((error: GeolocationPositionError) => {
    throw new Error(
      error.code === error.PERMISSION_DENIED
        ? "No diste permiso de ubicación. Puedes darlo en la configuración del navegador."
        : "No pudimos saber dónde estás. Intenta de nuevo en un momento."
    );
  });
  const response = await fetch(`${BASE_PATH}/api/ubicacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitud: posicion.coords.latitude, longitud: posicion.coords.longitude }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "No se pudo registrar tu ubicación");
  const zona = (body.zona ?? null) as ZonaDetectada | null;
  window.dispatchEvent(new CustomEvent(EVENTO_ZONA, { detail: zona }));
  return { zona, avisado: body.avisado === true };
}

/** Deja de usar la ubicación: la borra en el servidor y lo recuerda en este navegador. */
export async function dejarDeUsarUbicacion(): Promise<void> {
  guardarPreferenciaDeUbicacion("no");
  await fetch(`${BASE_PATH}/api/ubicacion`, { method: "DELETE" }).catch(() => null);
  window.dispatchEvent(new CustomEvent(EVENTO_ZONA, { detail: null }));
}
