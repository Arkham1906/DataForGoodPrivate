"use client";

// Filtro de tipo de dato con varias opciones a la vez (2026-11-03, a pedido del usuario): se ve como los
// demás selects de BarraDeFiltros y abre una lista de casillas. Cada tipo marcado reduce la lista: salen
// las campañas que los piden todos. El valor son los tipos separados por comas ("foto,video"; ver tiposDesde() en
// lib/campanas/sistema-opciones.ts). Se cierra con Escape o al hacer clic afuera.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { NOMBRE_DE_TIPO, alternarTipo, tiposDesde, type TipoDeDato } from "@/lib/campanas/sistema-opciones";

const TIPOS = Object.keys(NOMBRE_DE_TIPO) as TipoDeDato[];

export default function SelectorDeTipos({
  valor,
  onCambiar,
  clase,
}: {
  valor: string;
  onCambiar: (valor: string) => void;
  /** Clase de los selects de la barra, para que el botón se vea igual. */
  clase: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idLista = useId();
  const elegidos = tiposDesde(valor);

  useEffect(() => {
    if (!abierto) return;
    function alClic(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClic);
    return () => document.removeEventListener("mousedown", alClic);
  }, [abierto]);

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && abierto) {
      setAbierto(false);
      boton.current?.focus();
    }
  }

  const texto = elegidos.length === 0 ? "todos" : elegidos.map((t) => NOMBRE_DE_TIPO[t]).join(", ");

  return (
    <div ref={contenedor} className="relative min-w-0 flex-1" onKeyDown={alTeclear}>
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls={idLista}
        onClick={() => setAbierto((a) => !a)}
        className={`${clase} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">Tipo de dato: {texto}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 text-system-500">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        id={idLista}
        role="group"
        aria-label="Filtrar por tipo de dato, uno o varios"
        hidden={!abierto}
        className="absolute left-0 top-full z-40 mt-1 w-full min-w-[190px] rounded border border-system-200 bg-white p-1.5 shadow-lg"
      >
        {TIPOS.map((tipo) => (
          <label
            key={tipo}
            className="flex min-h-[34px] cursor-pointer items-center gap-2.5 rounded px-2 text-sm text-system-900 hover:bg-system-100"
          >
            <input
              type="checkbox"
              checked={elegidos.includes(tipo)}
              onChange={() => onCambiar(alternarTipo(valor, tipo))}
              className="size-4 accent-brand-600"
            />
            {NOMBRE_DE_TIPO[tipo]}
          </label>
        ))}
        {elegidos.length > 0 && (
          <button
            type="button"
            onClick={() => onCambiar("")}
            className="mt-1 w-full rounded border-t border-system-200 px-2 py-1.5 text-left text-[12.5px] font-semibold text-brand-600 hover:bg-system-100"
          >
            Quitar selección
          </button>
        )}
      </div>
    </div>
  );
}
