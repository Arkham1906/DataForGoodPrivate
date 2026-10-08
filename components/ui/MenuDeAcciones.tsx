"use client";

// Menú "Más ▾" de la zona de usuario (2026-10-07, Ley de Hick): junta las acciones secundarias de
// una tarjeta o renglón para que a la vista quede solo la principal. Cada opción es un enlace
// (`href`) o una acción (`alElegir`); las de `peligro` van en rojo y al final.
// Accesible: botón con aria-haspopup/aria-expanded, lista role="menu"; al abrir enfoca la primera
// opción, las flechas recorren, Esc o un clic fuera cierran y el foco vuelve al botón.

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { buttonClasses } from "./Button";

export type OpcionDeMenu = {
  etiqueta: string;
  href?: string;
  alElegir?: () => void;
  peligro?: boolean;
  deshabilitado?: boolean;
};

export default function MenuDeAcciones({
  opciones,
  etiqueta = "Más acciones",
  texto = "Más",
  discreto = false,
  alinear = "derecha",
  className = "",
}: {
  opciones: OpcionDeMenu[];
  /** Lo que oye el lector de pantalla, p. ej. "Más acciones de Campaña X". */
  etiqueta?: string;
  /** Texto visible del botón. */
  texto?: string;
  /** Botón como enlace de texto (renglones con acciones en texto, p. ej. /notificaciones). */
  discreto?: boolean;
  /** Borde del botón con el que se alinea la lista: "derecha" si el botón está al final del
   *  renglón (crece hacia la izquierda), "izquierda" si está al inicio (crece hacia la derecha). */
  alinear?: "derecha" | "izquierda";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idMenu = useId();

  // Clic fuera: cierra.
  useEffect(() => {
    if (!abierto) return;
    function alClic(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClic);
    return () => document.removeEventListener("mousedown", alClic);
  }, [abierto]);

  // Al abrir, el foco va a la primera opción.
  useEffect(() => {
    if (abierto) contenedor.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
  }, [abierto]);

  function cerrar(devolverFoco = true) {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (!abierto) return;
    const items = [...(contenedor.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? [])];
    const actual = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(actual + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(actual - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Tab") {
      cerrar(false);
    }
  }

  // Las de peligro, al final.
  const ordenadas = [...opciones.filter((o) => !o.peligro), ...opciones.filter((o) => o.peligro)];
  const claseOpcion = (o: OpcionDeMenu) =>
    `block w-full px-3.5 py-2 text-left text-[13px] font-semibold outline-none transition-colors focus:bg-system-100 hover:bg-system-100 ${
      o.peligro ? "text-error-700" : "text-system-900"
    } ${o.deshabilitado ? "pointer-events-none opacity-50" : ""}`;

  return (
    <div ref={contenedor} onKeyDown={alTeclear} className={`relative inline-block ${className}`}>
      <button
        ref={boton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        aria-label={etiqueta}
        onClick={() => setAbierto((a) => !a)}
        className={
          discreto
            ? "inline-flex min-h-6 items-center gap-1 px-1 text-[12px] font-semibold text-system-600 hover:text-system-900"
            : buttonClasses("secondary", "sm", "max-md:px-2 max-md:py-1.5 max-md:text-[11px]")
        }
      >
        {texto}
        <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div
          id={idMenu}
          role="menu"
          aria-label={etiqueta}
          className={`absolute ${alinear === "izquierda" ? "left-0" : "right-0"} z-30 mt-1.5 min-w-44 overflow-hidden rounded-lg border border-system-200 bg-white py-1 shadow-lg`}
        >
          {ordenadas.map((o) =>
            o.href && !o.deshabilitado ? (
              <Link key={o.etiqueta} href={o.href} role="menuitem" onClick={() => cerrar(false)} className={claseOpcion(o)}>
                {o.etiqueta}
              </Link>
            ) : (
              <button
                key={o.etiqueta}
                type="button"
                role="menuitem"
                aria-disabled={o.deshabilitado || undefined}
                onClick={() => {
                  if (o.deshabilitado) return;
                  cerrar();
                  o.alElegir?.();
                }}
                className={claseOpcion(o)}
              >
                {o.etiqueta}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
