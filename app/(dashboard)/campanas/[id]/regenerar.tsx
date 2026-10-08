"use client";

// Botón del cuadro Compartir (compartir.tsx) para que el creador genere o regenere
// el enlace público. Llama a POST /api/campanas/[id]/enlace (verifica que sea el
// creador y que la campaña esté activa) y avisa con onListo para recargar el cuadro.
// Regenerar pide confirmación porque deja inutilizable el enlace anterior.

import { useState } from "react";
import Button from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";

type Modo = "crear" | "regenerar" | "vencido";

const ETIQUETA: Record<Modo, string> = {
  crear: "Generar enlace y QR",
  regenerar: "Regenerar token",
  vencido: "Regenerar enlace y QR",
};

export default function BotonRegenerar({
  campanaId,
  modo,
  onListo,
}: {
  campanaId: string;
  modo: Modo;
  onListo: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerar() {
    setEnviando(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campanaId}/enlace`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo generar el enlace");
      setConfirmando(false);
      onListo();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el enlace");
    } finally {
      setEnviando(false);
    }
  }

  // Crear el primero no invalida nada: no hace falta confirmar.
  if (modo === "crear" || !confirmando) {
    return (
      <div className="mb-2.5">
        <Button
          variant={modo === "regenerar" ? "secondary" : "primary"}
          className="w-full"
          disabled={enviando}
          onClick={() => (modo === "crear" ? void regenerar() : setConfirmando(true))}
        >
          {enviando ? "Generando…" : ETIQUETA[modo]}
        </Button>
        {error && (
          <p className="mt-1.5 text-[12px] font-medium text-error-700" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-2.5">
      <p className="mb-2.5 text-[12px] text-system-600">
        Se creará una dirección nueva y la actual dejará de funcionar de forma permanente. Los aportes ya recibidos se
        conservan.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" disabled={enviando} onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" disabled={enviando} onClick={() => void regenerar()}>
          {enviando ? "Regenerando…" : "Sí, regenerar"}
        </Button>
      </div>
      {error && (
        <p className="mt-1.5 text-[12px] font-medium text-error-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
