"use client";

// Cuenta regresiva del potenciador activo (2026-11-23; sale de PotenciadorActivo para compartirla con el menú lateral
// y la burbuja). Los segundos los calcula el servidor con su reloj (RNF-GAM-12); aquí solo se descuentan cada segundo y,
// al llegar a 0, se piden los datos otra vez (router.refresh) para que el servidor venza el activo y active el siguiente.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PotenciadorActivo } from "@/lib/gamificacion/progreso-tipos";

export function useSegundosDelPotenciador(activo: PotenciadorActivo | null): number {
  const router = useRouter();
  const [segundos, setSegundos] = useState(activo?.segundosRestantes ?? 0);
  const [activoAnterior, setActivoAnterior] = useState(activo);
  const pidioDatos = useRef(false);

  // Si el servidor manda otro valor, se vuelve a partir de él. Se ajusta durante el render, no en un efecto, para no
  // pintar un fotograma con la cuenta vieja (react-hooks/set-state-in-effect).
  if (activo !== activoAnterior) {
    setActivoAnterior(activo);
    setSegundos(activo?.segundosRestantes ?? 0);
  }

  useEffect(() => {
    pidioDatos.current = false;
  }, [activo]);

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => setSegundos((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [activo]);

  useEffect(() => {
    if (activo && segundos === 0 && !pidioDatos.current) {
      pidioDatos.current = true;
      router.refresh();
    }
  }, [activo, segundos, router]);

  return segundos;
}
