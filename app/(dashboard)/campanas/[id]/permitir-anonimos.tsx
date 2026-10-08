"use client";

// Interruptor "Permitir aportes sin cuenta" del cuadro Compartir (compartir.tsx). Solo lo ve
// el creador. Llama a PATCH /api/campanas/[id]/enlace { permiteAnonimos }. Apagarlo no toca
// los aportes anónimos ya recibidos: solo hace que /c/[token] pida iniciar sesión.

import { useState } from "react";
import { BASE_PATH } from "@/lib/base-path";

export default function PermitirAnonimos({
  campanaId,
  inicial,
  onCambio,
}: {
  campanaId: string;
  inicial: boolean;
  onCambio: (permitir: boolean) => void;
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
    <div className="mb-4 rounded-lg border border-system-200 px-3.5 py-3">
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-system-900">
        <input
          type="checkbox"
          checked={permitir}
          disabled={guardando}
          onChange={(e) => void cambiar(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Permitir aportes sin cuenta</span>
          <span className="block text-[11.5px] text-system-400">
            Quien abra el enlace puede aportar de forma anónima. Si lo apagas, tendrá que iniciar sesión.
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
