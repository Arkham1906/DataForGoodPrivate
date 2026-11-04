// Encabezado de las pantallas públicas (2026-11-03): etiqueta en mono, título y texto de entrada, con la
// misma animación escalonada en todas. Lo usan /explorar, /datos, /contacto, /sobre-nosotros, /terminos y
// /privacidad, siempre en un <main> de max-w-5xl para que todas alineen igual. Sirve en servidor y cliente.

import type { ReactNode } from "react";
import { retraso } from "@/lib/animaciones";

export default function EncabezadoPublico({
  etiqueta,
  titulo,
  children,
}: {
  /** Texto corto sobre el título: la sección a la que pertenece la pantalla. */
  etiqueta: string;
  titulo: string;
  /** Texto de entrada, debajo del título. */
  children?: ReactNode;
}) {
  return (
    <>
      <p className="landing-entrada mb-2 font-mono text-[10.5px] uppercase tracking-widest text-brand-600">
        {etiqueta}
      </p>
      <h1
        style={retraso(80)}
        className="landing-entrada max-w-2xl text-[32px] font-extrabold leading-tight tracking-tight text-system-900"
      >
        {titulo}
      </h1>
      {children && (
        <div
          style={retraso(160)}
          className="landing-entrada mt-4 max-w-2xl space-y-3 text-[14.5px] leading-relaxed text-system-600"
        >
          {children}
        </div>
      )}
    </>
  );
}
