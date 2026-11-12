"use client";

import { useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";

export default function SelectorDeVistaCampanas({ children, toolbar }: { children: ReactNode; toolbar: ReactNode }) {
  const [vistaCuadricula, setVistaCuadricula] = useState(true);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">{toolbar}</div>
        <div role="group" aria-label="Cambiar vista de campañas" className="relative flex shrink-0 gap-0 overflow-hidden rounded-lg border border-system-300 bg-system-100 p-1">
          <span aria-hidden="true" className={`pointer-events-none absolute left-[3px] top-[3px] z-0 h-8 w-8 rounded-md bg-brand-600 shadow-inner transition-transform duration-200 ease-out motion-reduce:transition-none ${vistaCuadricula ? "translate-x-full" : "translate-x-0"}`} />
          <Button type="button" size="sm" className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${!vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`} onClick={() => setVistaCuadricula(false)} aria-label="Vista de lista" aria-pressed={!vistaCuadricula} title="Vista de lista">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Button>
          <Button type="button" size="sm" className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`} onClick={() => setVistaCuadricula(true)} aria-label="Vista cuadriculada" aria-pressed={vistaCuadricula} title="Vista cuadriculada">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
          </Button>
        </div>
      </div>
      <div className={vistaCuadricula ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3 [&_[data-campana-banner]]:hidden"}>
        {children}
      </div>
    </div>
  );
}
