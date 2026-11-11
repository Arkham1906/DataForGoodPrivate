"use client";

// Ayuda emergente icono de ! para especificacion de racha.

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Margen mínimo, en px, entre la leyenda y el borde de la pantalla o de la ventana que la contiene. */
const MARGEN = 8;
/** Tras recibir el foco por un toque, el clic que sigue no debe cerrarla. */
const TOQUE_MS = 400;

export default function AyudaEmergente({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  const id = useId();
  const [abierta, setAbierta] = useState(false);
  const contenedor = useRef<HTMLSpanElement>(null);
  const burbuja = useRef<HTMLSpanElement>(null);
  const flecha = useRef<HTMLSpanElement>(null);
  const enfocadaEn = useRef(0);

  // Escape la cierra aunque el foco esté en otro lado (se abrió con el cursor).
  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setAbierta(false);
    };
    document.addEventListener("keydown", alPulsar, true);
    return () => document.removeEventListener("keydown", alPulsar, true);
  }, [abierta]);

  // Que no se salga: se mide centrada y se corre lo justo hacia dentro. Se aplica en el DOM antes de pintar, sin
  // estado, para no provocar un segundo render.
  useLayoutEffect(() => {
    const cont = contenedor.current;
    const el = burbuja.current;
    const punta = flecha.current;
    if (!abierta || !cont || !el || !punta) return;
    cont.style.transform = "translateX(-50%)";
    punta.style.transform = "";
    const caja = el.getBoundingClientRect();
    const limite = el.closest("dialog")?.getBoundingClientRect();
    const izquierda = Math.max(0, limite?.left ?? 0) + MARGEN;
    const derecha = Math.min(window.innerWidth, limite?.right ?? window.innerWidth) - MARGEN;
    let dx = 0;
    if (caja.right > derecha) dx = derecha - caja.right;
    if (caja.left + dx < izquierda) dx = izquierda - caja.left;
    cont.style.transform = `translateX(calc(-50% + ${dx}px))`;
    punta.style.transform = `translateX(${-dx}px)`;
  }, [abierta]);

  return (
    <span className="relative inline-flex align-middle" onMouseEnter={() => setAbierta(true)} onMouseLeave={() => setAbierta(false)}>
      <button
        type="button"
        aria-label={etiqueta}
        aria-describedby={id}
        onFocus={() => {
          enfocadaEn.current = Date.now();
          setAbierta(true);
        }}
        onBlur={() => setAbierta(false)}
        onClick={() => {
          if (Date.now() - enfocadaEn.current < TOQUE_MS) setAbierta(true);
          else setAbierta((a) => !a);
        }}
        className="-my-1.5 inline-flex h-7 w-7 cursor-help items-center justify-center rounded-pill text-system-600 transition-colors hover:bg-system-100 hover:text-system-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </button>
      {/* El relleno inferior (pb-2) cubre el espacio entre el icono y la leyenda: es parte del área que escucha el cursor. */}
      <span
        ref={contenedor}
        className={`absolute bottom-full left-1/2 z-20 pb-2 ${abierta ? "block" : "hidden"}`}
      >
        <span
          ref={burbuja}
          id={id}
          role="tooltip"
          className="relative block w-60 max-w-[calc(100vw-2rem)] rounded-md bg-system-900 px-2.5 py-2 text-left text-[12.5px] font-medium leading-snug text-white shadow-lg"
        >
          {children}
          <span
            ref={flecha}
            aria-hidden="true"
            className="absolute top-full left-1/2 -ml-[5px] border-[5px] border-transparent border-t-system-900"
          />
        </span>
      </span>
    </span>
  );
}
