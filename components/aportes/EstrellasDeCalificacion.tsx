// Calificación de un aporte en estrellas, solo para ver (2026-10-31). Sin calificación no dibuja nada.
// El lector de pantalla oye "4 de 5 estrellas (Muy bueno)". Sirve en componentes de servidor y cliente.

import { ESTRELLAS_MAXIMAS, calificacionDesde, textoDeCalificacion } from "@/lib/aportes/calificacion";

export default function EstrellasDeCalificacion({
  valor,
  className = "",
  mostrarVacias = false,
}: {
  valor: unknown;
  className?: string;
  /** Muestra las cinco estrellas neutras cuando todavía no hay calificación. */
  mostrarVacias?: boolean;
}) {
  const n = calificacionDesde(valor);
  if (n === null && !mostrarVacias) return null;
  const estrellas = n ?? 0;
  const texto = textoDeCalificacion(n) ?? "";
  return (
    <span className={`inline-flex items-center gap-0.5 leading-none ${className}`} title={texto || "Sin calificación"}>
      <span className="sr-only">{texto || "Sin calificación"}</span>
      {Array.from({ length: ESTRELLAS_MAXIMAS }, (_, i) => (
        <span key={i} aria-hidden="true" className={i < estrellas ? "text-warning-500" : "text-system-300"}>
          ★
        </span>
      ))}
    </span>
  );
}
