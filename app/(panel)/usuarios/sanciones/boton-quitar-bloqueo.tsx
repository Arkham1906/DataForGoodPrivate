"use client";

// Botón "Quitar bloqueo" de un dispositivo anónimo. Llama a la server action
// quitarBloqueoDeDispositivo (lib/aportes/acciones-bloqueos.ts).

import { useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { quitarBloqueoDeDispositivo } from "@/lib/aportes/acciones-bloqueos";

export default function BotonQuitarBloqueo({
  bloqueoId,
  anchoCompleto = false,
}: {
  bloqueoId: string;
  anchoCompleto?: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirmando) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={anchoCompleto ? "w-full md:w-auto" : ""}
        onClick={() => setConfirmando(true)}
      >
        Quitar bloqueo
        <span className="sr-only"> del dispositivo {bloqueoId}</span>
      </Button>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${anchoCompleto ? "w-full items-stretch md:w-auto md:items-end" : "items-end"}`}>
      <div className={`flex flex-nowrap items-center gap-2 ${anchoCompleto ? "w-full justify-stretch" : "justify-end"}`}>
        <Button
          variant="secondary"
          size="sm"
          className={anchoCompleto ? "flex-1 md:flex-none" : ""}
          onClick={() => setConfirmando(false)}
        >
          No
        </Button>
        <Button
          variant="primary"
          size="sm"
          className={anchoCompleto ? "flex-1 md:flex-none" : ""}
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const resultado = await quitarBloqueoDeDispositivo(bloqueoId);
              if (resultado.ok) setConfirmando(false);
              else setError(resultado.error);
            })
          }
        >
          {pendiente ? "…" : "Confirmar"}
        </Button>
      </div>
      {error && <p className={`text-[12px] text-error-700 ${anchoCompleto ? "text-center" : ""}`}>{error}</p>}
    </div>
  );
}
