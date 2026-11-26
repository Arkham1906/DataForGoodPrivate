"use client";

import { useId, type ReactNode } from "react";

export default function PanelDeFiltrosMovil({ titulo, abierto, alternar, aplicar, children }: {
  titulo: string;
  abierto: boolean;
  alternar: () => void;
  aplicar: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="shrink-0 md:hidden">
      <button
        type="button"
        aria-label={abierto ? "Cerrar filtros" : "Abrir filtros"}
        aria-expanded={abierto}
        aria-controls={id}
        onClick={alternar}
        className={`grid size-[42px] place-items-center rounded border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
          abierto ? "border-brand-600 bg-brand-50 text-brand-600" : "border-system-300 bg-white text-system-600 hover:border-brand-600 hover:text-brand-600"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
          <path d="M4 7h9m4 0h3M4 17h3m4 0h9M13 5v4M7 15v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <section id={id} aria-label={titulo} hidden={!abierto} className="absolute inset-x-0 top-full z-30 mt-2 rounded-lg border border-system-200 bg-white p-4 shadow-lg">
        <h2 className="mb-3 text-sm font-bold text-system-900">{titulo}</h2>
        <div className="flex flex-col gap-2.5">{children}</div>
        <button type="button" onClick={aplicar} className="mt-4 w-full rounded border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-600/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          Filtrar
        </button>
      </section>
    </div>
  );
}
