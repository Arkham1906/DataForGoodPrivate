"use client";

// "Aprobar" / "Rechazar" de una temática pendiente en /sistema/tematicas (2026-10-19). Llama a la
// server action revisarTematica (lib/tematicas/acciones-tematicas.ts), que revalida la página.
// Rechazar la borra (2026-10-22): desaparece de la lista, ya no queda "Aprobar".
// Desde el 2026-10-29 una campaña puede usar una temática propuesta: si alguna la usa, "Rechazar"
// pide primero a qué temática aprobada pasan (decisión del usuario) y se confirma con "Rechazar y mover".

import { useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { revisarTematica } from "@/lib/tematicas/acciones-tematicas";

export default function BotonesDeRevision({
  id,
  nombre,
  campanas = 0,
  reemplazos = [],
}: {
  id: number;
  nombre: string;
  /** Campañas que usan esta temática propuesta. */
  campanas?: number;
  /** Temáticas aprobadas y visibles a las que pueden pasar esas campañas. */
  reemplazos?: string[];
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [reemplazo, setReemplazo] = useState("");

  function revisar(aprobada: boolean) {
    if (!aprobada && campanas > 0 && !eligiendo) {
      setEligiendo(true);
      setError(null);
      return;
    }
    if (!aprobada && campanas > 0 && !reemplazo) {
      setError("Elige a qué temática pasan las campañas.");
      return;
    }
    iniciar(async () => {
      const resultado = await revisarTematica(id, aprobada, aprobada ? undefined : reemplazo || undefined);
      setError(resultado.ok ? null : resultado.error);
    });
  }

  if (eligiendo) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-system-600" htmlFor={`reemplazo-${id}`}>
          {campanas === 1 ? "La campaña que la usa pasa a" : `Las ${campanas} campañas que la usan pasan a`}
        </label>
        <select
          id={`reemplazo-${id}`}
          value={reemplazo}
          onChange={(e) => {
            setReemplazo(e.target.value);
            setError(null);
          }}
          className="rounded border border-system-300 bg-white px-2 py-1.5 text-[12.5px] text-system-900 outline-none focus:border-brand-600"
        >
          <option value="">Elige una temática</option>
          {reemplazos.map((tema) => (
            <option key={tema} value={tema}>
              {tema}
            </option>
          ))}
        </select>
        {error ? (
          <span role="alert" className="text-[12px] text-error-700">
            {error}
          </span>
        ) : null}
        <Button size="sm" variant="secondary" disabled={pendiente} onClick={() => setEligiendo(false)}>
          Cancelar
        </Button>
        <Button size="sm" variant="danger" disabled={pendiente} onClick={() => revisar(false)}>
          {pendiente ? "Guardando…" : "Rechazar y mover"}
          <span className="sr-only"> {nombre}</span>
        </Button>
      </div>
    );
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
