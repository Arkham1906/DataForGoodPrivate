"use client";

// "Aprobar" / "Rechazar" de una temática pendiente en /sistema/tematicas (2026-10-19). Llama a la
// server action revisarTematica (lib/tematicas/acciones-tematicas.ts), que revalida la página.
// Rechazar la borra (2026-10-22): desaparece de la lista, ya no queda "Aprobar".
// Desde el 2026-10-29 una campaña puede usar una temática propuesta: si alguna la usa, "Rechazar"
// pide primero a qué temática aprobada pasan (decisión del usuario) y se confirma con "Rechazar y mover".
// Desde el 2026-11-22, aprobar y rechazar piden confirmación ("¿Seguro que quieres…?", components/sistema/useConfirmacion).

import { useState } from "react";

import Button from "@/components/sistema/Button";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
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
  const { pedirConfirmacion, ventana, ocupado: pendiente } = useConfirmacion();
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
    setError(null);
    pedirConfirmacion(
      aprobada
        ? {
            pregunta: `¿Seguro que quieres aprobar «${nombre}»?`,
            detalle: (
              <p>
                Pasa al catálogo y se ofrece a todos al crear campañas y al elegir intereses. Se avisa a quien la propuso
                {campanas > 0 ? " y a quienes la usan en su campaña" : ""}.
              </p>
            ),
            textoConfirmar: "Sí, aprobar",
            accion: () => revisarTematica(id, true),
          }
        : {
            pregunta: `¿Seguro que quieres rechazar «${nombre}»?`,
            detalle: (
              <>
                <p>
                  Se borra del catálogo y se quita de los perfiles de quienes la escribieron. Se avisa a quien la propuso.
                </p>
                {campanas > 0 ? (
                  <p>
                    {campanas === 1 ? "La campaña que la usa pasa" : `Las ${campanas} campañas que la usan pasan`} a «{reemplazo}».
                  </p>
                ) : null}
                <p>No se puede deshacer.</p>
              </>
            ),
            textoConfirmar: campanas > 0 ? "Sí, rechazar y mover" : "Sí, rechazar",
            peligro: true,
            accion: () => revisarTematica(id, false, reemplazo || undefined),
            alTerminar: () => setEligiendo(false),
          },
    );
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
          Rechazar y mover
          <span className="sr-only"> {nombre}</span>
        </Button>
        {ventana}
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
        Aprobar
        <span className="sr-only"> {nombre}</span>
      </Button>
      {ventana}
    </>
  );
}
