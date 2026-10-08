"use client";

// Botón "Ocultar" / "Mostrar" de una temática en /sistema/tematicas. Llama a la server action
// cambiarVisibilidadDeTematica (lib/tematicas/acciones-tematicas.ts), que revalida la página.

import { useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { cambiarVisibilidadDeTematica } from "@/lib/tematicas/acciones-tematicas";

export default function BotonDeVisibilidad({ id, nombre, oculta }: { id: number; nombre: string; oculta: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error ? (
        <span role="alert" className="text-[12px] text-error-700">
          {error}
        </span>
      ) : null}
      <Button
        size="sm"
        variant={oculta ? "secondary" : "danger"}
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const resultado = await cambiarVisibilidadDeTematica(id, !oculta);
            setError(resultado.ok ? null : resultado.error);
          })
        }
      >
        {pendiente ? "Guardando…" : oculta ? "Mostrar" : "Ocultar"}
        <span className="sr-only"> {nombre}</span>
      </Button>
    </>
  );
}
