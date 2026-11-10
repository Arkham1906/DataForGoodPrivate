// Encabezado de las pantallas públicas (2026-11-03): etiqueta en mono, título y texto de entrada, con la
// misma animación escalonada en todas. Lo usan /explorar, /datos, /contacto, /sobre-nosotros,
// /terminos y /privacidad. `centrado` (2026-11-06) es el estilo de la landing, hoy en todas ellas: título más
// ligero y al centro.
// Sirve en servidor y cliente.

import type { ReactNode } from "react";
import { retraso } from "@/lib/animaciones";

export default function EncabezadoPublico({
  etiqueta,
  titulo,
  centrado = false,
  children,
}: {
  /** Texto corto sobre el título: la sección a la que pertenece la pantalla. */
  etiqueta: string;
  titulo: string;
  centrado?: boolean;
  /** Texto de entrada, debajo del título. */
  children?: ReactNode;
}) {
  return (
    <>
      <p
        className={`landing-entrada font-mono ${
          centrado ? "mb-4 text-center text-[13px] text-system-600" : "mb-2 text-[10.5px] uppercase tracking-widest text-brand-600"
        }`}
      >
        {etiqueta}
      </p>
      <h1
        style={retraso(80)}
        className={`landing-entrada tracking-tight text-system-900 ${
          centrado
            ? "mx-auto max-w-3xl text-center text-[36px] font-semibold leading-[1.1] md:text-[44px]"
            : "max-w-2xl text-[32px] font-extrabold leading-tight"
        }`}
      >
        {titulo}
      </h1>
      {children && (
        <div
          style={retraso(160)}
          className={`landing-entrada space-y-3 leading-relaxed text-system-600 ${
            centrado ? "mx-auto mt-5 max-w-2xl text-center text-[16.5px]" : "mt-4 max-w-2xl text-[14.5px]"
          }`}
        >
          {children}
        </div>
      )}
    </>
  );
}
