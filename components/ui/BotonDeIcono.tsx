// Botón cuadrado que solo lleva un ícono (2026-11-10, a pedido del usuario: Compartir, Favorita y Reportar de
// /campanas/[id] pasaron de botones con texto a íconos en la fila de la temática). La etiqueta va en
// aria-label (lector de pantalla) y en title (texto al pasar el cursor); el ícono es decorativo.

import type { ButtonHTMLAttributes, ReactNode } from "react";

export default function BotonDeIcono({
  etiqueta,
  children,
  className = "",
  ...resto
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> & {
  /** Qué hace el botón; se lee y sale al pasar el cursor. */
  etiqueta: string;
  /** El ícono (svg con aria-hidden). */
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-system-200 bg-white text-system-600 transition-colors hover:bg-system-100 hover:text-system-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white ${className}`}
      {...resto}
    >
      {children}
    </button>
  );
}

/** Íconos de 18 px con trazo, para BotonDeIcono. */
export function IconoCompartir() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

export function IconoEstrella({ rellena = false }: { rellena?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill={rellena ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
    </svg>
  );
}

export function IconoBandera({ rellena = false }: { rellena?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" fill={rellena ? "currentColor" : "none"} />
    </svg>
  );
}
