"use client";

// Potenciador de EXP de «Hoy» (2026-11-02; SRS v1.1: RF-GAM-32 a 36): el activo con su cuenta regresiva y cuántos
// hay en espera. Es cliente solo por el reloj: los segundos que quedan los calcula el servidor con su propio reloj
// (RNF-GAM-12) y aquí únicamente se descuentan cada segundo; al llegar a 0 pide los datos de nuevo.
//
// No decide nada sobre la cola ni sobre qué pasa con la capacidad llena (DA-GAM-13, pendiente): solo muestra lo
// que hay. Sin potenciador, explica lo que es sin prometer cómo se consigue (el catálogo de misiones sigue
// abierto, DA-GAM-06).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumenDePotenciadores } from "@/lib/gamificacion/progreso-tipos";

const RADIO = 20;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export default function PotenciadorActivo({ potenciadores }: { potenciadores: ResumenDePotenciadores }) {
  const router = useRouter();
  const { activo, enEspera } = potenciadores;
  const [segundos, setSegundos] = useState(activo?.segundosRestantes ?? 0);
  const [activoAnterior, setActivoAnterior] = useState(activo);
  const pidioDatos = useRef(false);

  // Si el servidor manda otro valor (la página se actualizó), se vuelve a partir de él. Se ajusta durante el
  // render, no en un efecto, para no pintar un fotograma con la cuenta vieja (react-hooks/set-state-in-effect).
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

  return (
    <>
      <h2 className="text-lg font-extrabold text-system-900">Potenciador</h2>
      {activo ? (
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="h-12 w-12 shrink-0 -rotate-90">
            <circle cx="24" cy="24" r={RADIO} fill="none" strokeWidth="5" className="stroke-white" />
            <circle
              cx="24"
              cy="24"
              r={RADIO}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              className="stroke-brand-700"
              strokeDasharray={`${CIRCUNFERENCIA * Math.min(1, segundos / (activo.duracionMinutos * 60))} ${CIRCUNFERENCIA}`}
            />
          </svg>
          <div>
            <p role="timer" className="font-mono text-2xl font-extrabold leading-none text-system-900">
              {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")}
            </p>
            <p className="mt-1 text-[13px] text-brand-800">
              +{activo.bonificacion.toLocaleString("es-MX", { minimumFractionDigits: 1 })} a lo que envíes ahora.
              {enEspera > 0 && ` ${enEspera} más en espera.`}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-brand-800">
          No tienes potenciadores.
          {enEspera > 0
            ? ` ${enEspera === 1 ? "Tienes 1 en espera" : `Tienes ${enEspera} en espera`}: se activa solo en cuanto puede.`
            : " Cuando obtengas uno, se activa solo y suma a los aportes que envíes mientras dure."}
        </p>
      )}
    </>
  );
}
