"use client";

// Detector de cambio de zona (2026-10-31; lib/ubicacion/en-el-navegador.ts). Va en el layout de la zona de
// usuario. Solo si la persona activó "Usar mi ubicación" en este navegador y el permiso sigue dado: manda
// la ubicación al entrar, cada INTERVALO_MS y al volver a la pestaña (no más seguido que ESPERA_MINIMA_MS).
// El servidor decide si cambió de municipio y avisa (POST /api/ubicacion). Nunca pide el permiso por su
// cuenta: eso solo pasa con el botón de /campanas. Si el permiso se da desde el navegador (el candado de la
// barra de direcciones), lo toma como activado (2026-11-04): antes se ignoraba hasta usar el botón. Con el
// permiso ya dado y sin haber decidido, también; "Ahora no" se respeta hasta que el permiso cambie.

import { useEffect } from "react";
import {
  detectarYEnviarZona,
  guardarPreferenciaDeUbicacion,
  hayGeolocalizacion,
  permisoDeUbicacion,
  preferenciaDeUbicacion,
} from "@/lib/ubicacion/en-el-navegador";

/** Cada cuánto se revisa la zona con la pestaña abierta. */
const INTERVALO_MS = 10 * 60_000;
/** Al volver a la pestaña, si la última revisión fue hace menos que esto, no se repite. */
const ESPERA_MINIMA_MS = 3 * 60_000;

export default function DetectorDeUbicacion() {
  useEffect(() => {
    if (!hayGeolocalizacion()) return;
    let ultima = 0;
    let vivo = true;

    const revisar = async () => {
      if (!vivo || preferenciaDeUbicacion() !== "si" || document.visibilityState !== "visible") return;
      if (Date.now() - ultima < ESPERA_MINIMA_MS) return;
      if ((await permisoDeUbicacion()) !== "granted") return;
      ultima = Date.now();
      await detectarYEnviarZona().catch(() => {
        // Sin señal o permiso quitado: se intenta en la siguiente vuelta.
      });
    };

    // Permiso dado desde el navegador. Safari viejo no tiene permissions.query: ahí no se escucha.
    const activar = () => {
      guardarPreferenciaDeUbicacion("si");
      ultima = 0;
      void revisar();
    };
    let permiso: PermissionStatus | null = null;
    void navigator.permissions
      ?.query({ name: "geolocation" })
      .then((estado) => {
        if (!vivo) return;
        permiso = estado;
        estado.onchange = () => {
          if (estado.state === "granted") activar();
        };
        if (estado.state === "granted" && preferenciaDeUbicacion() === null) activar();
      })
      .catch(() => {});

    void revisar();
    const intervalo = window.setInterval(() => void revisar(), INTERVALO_MS);
    const alVolver = () => void revisar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      if (permiso) permiso.onchange = null;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  return null;
}
