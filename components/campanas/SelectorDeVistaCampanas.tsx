"use client";

import { useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";

export default function SelectorDeVistaCampanas({ children, toolbar }: { children: ReactNode | ((vistaCuadricula: boolean) => ReactNode); toolbar: ReactNode }) {
  const [vistaCuadricula, setVistaCuadricula] = useState(true);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">{toolbar}</div>
        <Button
          type="button"
          size="sm"
          className="!size-10 !rounded-lg !p-0"
          onClick={() => setVistaCuadricula((actual) => !actual)}
          aria-label={vistaCuadricula ? "Cambiar a vista de lista" : "Cambiar a vista cuadriculada"}
          aria-pressed={vistaCuadricula}
          title={vistaCuadricula ? "Vista de lista" : "Vista cuadriculada"}
        >
          {vistaCuadricula ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
          )}
        </Button>
      </div>
      <div className={vistaCuadricula ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"}>
        {typeof children === "function" ? children(vistaCuadricula) : children}
      </div>
    </div>
  );
}
