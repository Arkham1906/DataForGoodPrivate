"use client";

// "Aprobar" / "Rechazar" de una temática pendiente en /sistema/tematicas (2026-10-19). Llama a la
// server action revisarTematica (lib/tematicas/acciones-tematicas.ts), que revalida la página.
// Rechazar la borra (2026-10-22): desaparece de la lista, ya no queda "Aprobar".

import { useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { revisarTematica } from "@/lib/tematicas/acciones-tematicas";

export default function BotonesDeRevision({ id, nombre }: { id: number; nombre: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function revisar(aprobada: boolean) {
    iniciar(async () => {
      const resultado = await revisarTematica(id, aprobada);
      setError(resultado.ok ? null : resultado.error);
    });
  }

  return (
    <>
      {error ? (
        <span role="alert" className="text-[12px] text-error-700">
          {error}
        </span>
      ) : null}
      <Button size="sm" variant="danger" disabled={pendiente} onClick={() => revisar(false)}>
        Rechazar
        <span className="sr-only"> {nombre}</span>
      </Button>
      <Button size="sm" variant="primary" disabled={pendiente} onClick={() => revisar(true)}>
        {pendiente ? "Guardando…" : "Aprobar"}
        <span className="sr-only"> {nombre}</span>
      </Button>
    </>
  );
}
