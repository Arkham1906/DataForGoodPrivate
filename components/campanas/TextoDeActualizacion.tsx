"use client";

// "Actualizado hace 5 min" en los paneles de campaña (2026-11-03, a pedido del usuario; antes decía "En vivo").
// `iso` es el último cambio real de la campaña o de sus aportes (ultimaActualizacionDeCampana); el texto avanza
// solo con el reloj. El servidor no conoce la hora del navegador: ahí solo dice "Actualizado".

import { useSyncExternalStore } from "react";
import { haceCuanto } from "@/lib/notificaciones/tipos";

const CADA_MS = 10_000;

function suscribirAlReloj(avisar: () => void) {
  const intervalo = setInterval(avisar, CADA_MS);
  return () => clearInterval(intervalo);
}

export default function TextoDeActualizacion({ iso }: { iso: string | null }) {
  const ahora = useSyncExternalStore(
    suscribirAlReloj,
    () => Math.floor(Date.now() / CADA_MS) * CADA_MS,
    () => 0
  );
  return <>{iso && ahora > 0 ? `Actualizado ${haceCuanto(iso, ahora)}` : "Actualizado"}</>;
}
