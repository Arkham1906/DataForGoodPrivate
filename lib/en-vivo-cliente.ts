"use client";

// Lado del navegador de la actualización en vivo (2026-10-19). components/layout/ActualizacionEnVivo
// lanza EVENTO_DATOS cuando cambió algo en la base; las pantallas cliente que leen con fetch usan
// useRecargaEnVivo() y lo ponen en las dependencias del efecto que carga sus datos, para volver a
// leerlos. No lo uses en formularios de edición: recargar borraría lo que la persona está escribiendo.

import { useEffect, useState } from "react";

export const EVENTO_DATOS = "dataforgood:datos-cambiaron";

/** Número que sube cada vez que cambian los datos (empieza en 0). */
export function useRecargaEnVivo(): number {
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    const alCambiar = () => setVuelta((n) => n + 1);
    window.addEventListener(EVENTO_DATOS, alCambiar);
    return () => window.removeEventListener(EVENTO_DATOS, alCambiar);
  }, []);
  return vuelta;
}
