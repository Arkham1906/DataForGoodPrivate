"use client";

import { CALIFICACIONES_DE_APORTE, type CalificacionDeAporte } from "@/lib/aportes/calificacion";

export default function SelectorDeCalificacion({
  value,
  onChange,
  disabled = false,
}: {
  value: CalificacionDeAporte | "";
  onChange: (value: CalificacionDeAporte) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CALIFICACIONES_DE_APORTE.map((calificacion) => (
        <label
          key={calificacion.valor}
          className={`cursor-pointer rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            value === calificacion.valor
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-system-300 bg-white text-system-600 hover:border-brand-600"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <input
            type="radio"
            name="calificacion"
            value={calificacion.valor}
            checked={value === calificacion.valor}
            onChange={() => onChange(calificacion.valor)}
            disabled={disabled}
            className="sr-only"
          />
          {calificacion.etiqueta}
        </label>
      ))}
    </div>
  );
}
