"use client";

// "Más temáticas ▾" de /campanas (2026-10-07, Ley de Hick): la fila de filtros muestra pocas
// temáticas y el resto se elige aquí, en un <dialog> nativo con buscador. Tocar una la aplica y
// cierra la ventana. Cada opción lleva cuántas campañas activas tiene.

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { claveDeTematica } from "@/lib/tematicas/analizar";

export default function MasTematicas({
  temas,
  onElegir,
  claseDelBoton,
}: {
  /** [temática, campañas activas], ya en el orden en que se ofrecen. */
  temas: [string, number][];
  onElegir: (tema: string) => void;
  /** Mismo estilo que los demás botones de la fila de filtros. */
  claseDelBoton: string;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [busqueda, setBusqueda] = useState("");

  function abrir() {
    setBusqueda("");
    dialogo.current?.showModal();
  }

  function elegir(tema: string) {
    onElegir(tema);
    dialogo.current?.close();
  }

  // Sin acentos ni mayúsculas: "educacion" encuentra "Educación".
  const termino = claveDeTematica(busqueda);
  const visibles = termino ? temas.filter(([tema]) => claveDeTematica(tema).includes(termino)) : temas;

  return (
    <>
      <button type="button" onClick={abrir} aria-haspopup="dialog" className={claseDelBoton}>
        Más temáticas <span className="ml-1 font-mono">{temas.length}</span>
        <span aria-hidden="true" className="ml-1">
          ▾
        </span>
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby="mas-tematicas-titulo"
        // Clic en el fondo (fuera de la caja): se cierra sin elegir.
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
      >
        <div className="flex max-h-[80vh] flex-col">
          <div className="border-b border-system-200 p-5">
            <h2 id="mas-tematicas-titulo" className="text-lg font-extrabold text-system-900">
              Más temáticas
            </h2>
            <p className="mt-1 text-[12.5px] text-system-600">Elige una para ver solo sus campañas.</p>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar temática"
              aria-label="Buscar temática"
              className="mt-3 w-full rounded border border-system-300 bg-white px-3 py-2 text-[13px] text-system-900 outline-none focus:border-brand-600"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {visibles.length === 0 ? (
              <p className="text-[12.5px] text-system-400">Ninguna temática coincide con «{busqueda}».</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visibles.map(([tema, cuantas]) => (
                  <button
                    key={tema}
                    type="button"
                    onClick={() => elegir(tema)}
                    className="rounded-pill border border-system-300 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-system-600 transition-colors hover:border-brand-600"
                  >
                    {tema}
                    <span className="ml-1.5 font-mono">{cuantas}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-system-200 p-4">
            <Button type="button" variant="secondary" size="sm" onClick={() => dialogo.current?.close()}>
              Cerrar
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
