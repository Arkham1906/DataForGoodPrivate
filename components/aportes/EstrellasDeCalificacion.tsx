// Calificación de un aporte en estrellas, solo para ver (2026-10-31). Sin calificación no dibuja nada.
// El lector de pantalla oye "4 de 5 estrellas (Muy bueno)". Sirve en componentes de servidor y cliente.

import { ESTRELLAS_MAXIMAS, calificacionDesde, textoDeCalificacion } from "@/lib/aportes/calificacion";

export default function EstrellasDeCalificacion({ valor, className = "" }: { valor: unknown; className?: string }) {
  const n = calificacionDesde(valor);
  if (n === null) return null;
  const texto = textoDeCalificacion(n) ?? "";
  return (
    <span className={`inline-flex items-center gap-0.5 leading-none ${className}`} title={texto}>
      <span className="sr-only">{texto}</span>
      {Array.from({ length: ESTRELLAS_MAXIMAS }, (_, i) => (
        <span key={i} aria-hidden="true" className={i < n ? "text-warning-500" : "text-system-300"}>
          ★
        </span>
      ))}
    </span>
  );
}
