// Etiquetas de una campaña (subtemáticas de su temática, 2026-10-27), en tarjetas y en el detalle.
// Las pendientes solo llegan al creador y a la supervisión; se marcan "por aprobar". Sin etiquetas,
// no dibuja nada.

import type { EtiquetaDeCampana } from "@/lib/etiquetas/reglas";

export default function EtiquetasDeCampana({
  etiquetas,
  className = "",
}: {
  etiquetas: (EtiquetaDeCampana | string)[] | undefined;
  className?: string;
}) {
  const lista = (etiquetas ?? []).map((e) => (typeof e === "string" ? { nombre: e, pendiente: false } : e));
  if (lista.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Etiquetas">
      {lista.map((e) => (
        <li
          key={e.nombre}
          className={`rounded-pill border px-2 py-0.5 text-[11.5px] font-medium ${
            e.pendiente ? "border-dashed border-warning-600 text-warning-800" : "border-system-300 text-system-600"
          }`}
          title={e.pendiente ? "Etiqueta por aprobar: solo la ven quien organiza y la supervisión" : undefined}
        >
          #{e.nombre}
          {e.pendiente ? <span className="sr-only"> (por aprobar)</span> : null}
        </li>
      ))}
    </ul>
  );
}
