"use client";

// Interruptor "Permitir aportes sin cuenta" de Compartir y de las tarjetas de /mis-campanas.
// Solo lo ve el creador. Llama a PATCH /api/campanas/[id]/enlace { permiteAnonimos }. Apagarlo
// no toca los aportes anónimos ya recibidos: solo hace que /c/[token] pida iniciar sesión.

import { useState } from "react";
import { BASE_PATH } from "@/lib/base-path";

export default function PermitirAnonimos({
  campanaId,
  inicial,
  onCambio,
  compacto = false,
}: {
  campanaId: string;
  inicial: boolean;
  onCambio: (permitir: boolean) => void;
  compacto?: boolean;
}) {
  const [permitir, setPermitir] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(valor: boolean) {
    setGuardando(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campanaId}/enlace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permiteAnonimos: valor }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el cambio");
      setPermitir(valor);
      onCambio(valor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el cambio");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className={
        compacto
          ? "relative z-10 mb-2 rounded-lg border border-system-200 bg-system-50 px-2.5 py-2"
          : "mb-4 rounded-lg border border-system-200 px-3.5 py-3"
      }
    >
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-system-900">
        <input
          type="checkbox"
          role="switch"
          checked={permitir}
          disabled={guardando}
          onChange={(e) => void cambiar(e.target.checked)}
          className="relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-system-300 transition-colors before:absolute before:left-1 before:top-1 before:size-4 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:bg-brand-600 checked:before:translate-x-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-wait disabled:opacity-60"
        />
        <span>
          <span className={`font-medium ${compacto ? "text-[11.5px]" : ""}`}>Permitir aportes sin cuenta</span>
          <span className={`block text-system-500 ${compacto ? "text-[10px]" : "text-[11.5px]"}`}>
            {permitir
              ? "Quien tenga el enlace podrá aportar sin iniciar sesión. Al desactivarlo, los aportes recibidos se conservan."
              : "Los aportes anónimos están desactivados; quien tenga el enlace deberá iniciar sesión."}
          </span>
        </span>
      </label>
      {error && (
        <p className="mt-1.5 text-[12px] font-medium text-error-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
