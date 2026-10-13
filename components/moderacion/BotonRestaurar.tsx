"use client";

// Botón "Restaurar acceso" de la lista de sanciones de la moderación (/supervisar o /supervision).
// Llama a la server action restaurarAcceso (lib/moderacion/acciones.ts) con la zona.

import { useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { restaurarAcceso } from "@/lib/moderacion/acciones";
import type { ZonaDeModeracion } from "@/lib/moderacion/rutas";

export default function BotonRestaurar({
  zona,
  sancionId,
  usuario,
  anchoCompleto = false,
}: {
  zona: ZonaDeModeracion;
  sancionId: string;
  usuario: string;
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
        Restaurar
        <span className="sr-only"> el acceso de {usuario}</span>
      </Button>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${anchoCompleto ? "w-full items-stretch md:w-auto md:items-end" : "items-end"}`}>
    <div
      className={`flex flex-nowrap items-center gap-2 ${
        anchoCompleto ? "w-full justify-stretch md:w-auto md:justify-end" : "justify-end"
      }`}
    >
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
            setError(null);
            const resultado = await restaurarAcceso(zona, sancionId);
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
