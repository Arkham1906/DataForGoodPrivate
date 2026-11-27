"use client";

// «Aparecer en la clasificación» en la ventana de Preferencias de /cuenta (RF-GAM-95): aparecer u ocultarse de las
// tablas de líderes y de la landing. Como «Usar mi ubicación», se guarda al momento (PATCH /api/progreso/lideres) y no
// depende de «Guardar cambios» ni del interruptor general de notificaciones.

import { useState } from "react";
import { BASE_PATH } from "@/lib/base-path";
import { TEXTOS } from "@/lib/gamificacion/textos";

export default function AparecerEnLideres({ inicial }: { inicial: boolean }) {
  const T = TEXTOS.lideres.visibilidad;
  const [aparece, setAparece] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alternar() {
    const nuevo = !aparece;
    setOcupado(true);
    setError(null);
    setAparece(nuevo);
    try {
      const respuesta = await fetch(`${BASE_PATH}/api/progreso/lideres`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apareceEnLideres: nuevo }),
      });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
    } catch {
      setAparece(!nuevo);
      setError(T.error);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-3 rounded border border-system-300 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p id="pref-lideres" className="text-base font-bold text-system-900">
            {T.interruptor}
          </p>
          <p id="pref-lideres-detalle" aria-live="polite" className="text-[15px] text-system-600">
            {aparece ? T.encendida : T.apagada}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aparece}
          aria-labelledby="pref-lideres"
          aria-describedby="pref-lideres-detalle"
          disabled={ocupado}
          onClick={() => void alternar()}
          className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-60 ${aparece ? "bg-brand-600" : "bg-system-300"}`}
        >
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${aparece ? "left-6" : "left-1"}`} />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[13.5px] text-error-700">
          {error}
        </p>
      )}
    </div>
  );
}
