"use client";

// Selector de estrellas de la calificación de un aporte (2026-10-31, a pedido del usuario; antes tres
// botones Bien / Muy bueno / Excelente). Radios ocultos, así funciona con teclado (flechas) y lector de
// pantalla; al pasar el cursor se iluminan las estrellas hasta la que está debajo.

import { useState } from "react";
import { ESTRELLAS_MAXIMAS, NOMBRES_DE_ESTRELLAS, type CalificacionDeAporte } from "@/lib/aportes/calificacion";

const ESTRELLAS = Array.from({ length: ESTRELLAS_MAXIMAS }, (_, i) => (i + 1) as CalificacionDeAporte);

export default function SelectorDeCalificacion({
  value,
  onChange,
  disabled = false,
}: {
  /** 0 = sin elegir. */
  value: CalificacionDeAporte | 0;
  onChange: (value: CalificacionDeAporte) => void;
  disabled?: boolean;
}) {
  const [bajoElCursor, setBajoElCursor] = useState(0);
  const iluminadas = bajoElCursor || value;
  const nombre = iluminadas ? NOMBRES_DE_ESTRELLAS[iluminadas as CalificacionDeAporte] : "Elige de 1 a 5 estrellas";

  return (
    <div className="flex flex-col items-center gap-1">
      <div role="radiogroup" aria-label="Calificación del aporte" className="flex gap-1" onMouseLeave={() => setBajoElCursor(0)}>
        {ESTRELLAS.map((n) => (
          <label
            key={n}
            title={`${n} ${n === 1 ? "estrella" : "estrellas"}: ${NOMBRES_DE_ESTRELLAS[n]}`}
            onMouseEnter={() => !disabled && setBajoElCursor(n)}
            className={`text-[28px] leading-none transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${n <= iluminadas ? "text-warning-500" : "text-system-300"}`}
          >
            <input
              type="radio"
              name="calificacion"
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              disabled={disabled}
              className="sr-only"
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}: ${NOMBRES_DE_ESTRELLAS[n]}`}
            />
            <span aria-hidden="true">★</span>
          </label>
        ))}
      </div>
      <span className="text-[12px] text-system-600" aria-live="polite">
        {nombre}
      </span>
    </div>
  );
}
