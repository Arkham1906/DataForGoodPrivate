"use client";

// Detector de cambio de zona (2026-10-31; lib/ubicacion/en-el-navegador.ts). Va en el layout de la zona de
// usuario. Solo si la persona activó "Usar mi ubicación" en este navegador y el permiso sigue dado: manda
// la ubicación al entrar, cada INTERVALO_MS y al volver a la pestaña (no más seguido que ESPERA_MINIMA_MS).
// El servidor decide si cambió de municipio y avisa (POST /api/ubicacion). Nunca pide el permiso por su
// cuenta: eso solo pasa con el botón de /campanas.

import { useEffect } from "react";
import { detectarYEnviarZona, hayGeolocalizacion, preferenciaDeUbicacion } from "@/lib/ubicacion/en-el-navegador";

/** Cada cuánto se revisa la zona con la pestaña abierta. */
const INTERVALO_MS = 10 * 60_000;
/** Al volver a la pestaña, si la última revisión fue hace menos que esto, no se repite. */
const ESPERA_MINIMA_MS = 3 * 60_000;

async function permisoDado(): Promise<boolean> {
  try {
    const estado = await navigator.permissions.query({ name: "geolocation" });
    return estado.state === "granted";
  } catch {
    // Safari viejo no tiene permissions.query: si la activó, se intenta (no muestra el aviso otra vez).
    return true;
  }
}

export default function DetectorDeUbicacion() {
  useEffect(() => {
    if (!hayGeolocalizacion()) return;
    let ultima = 0;
    let vivo = true;

    const revisar = async () => {
      if (!vivo || preferenciaDeUbicacion() !== "si" || document.visibilityState !== "visible") return;
      if (Date.now() - ultima < ESPERA_MINIMA_MS) return;
      if (!(await permisoDado())) return;
      ultima = Date.now();
      await detectarYEnviarZona().catch(() => {
        // Sin señal o permiso quitado: se intenta en la siguiente vuelta.
      });
    };

    void revisar();
    const intervalo = window.setInterval(() => void revisar(), INTERVALO_MS);
    const alVolver = () => void revisar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  return null;
}
