// Barra de tramos de lo que pide completar tu rango (2026-11-02; RF-GAM-22): un tramo por requisito, los cumplidos
// primero y en azul claro los que faltan. 2026-11-23: los cumplidos toman la paleta «azul a verde» según cuántos llevas
// (color-de-avance.ts). La imagen lleva su texto para lectores de pantalla, porque el color solo no basta.
// Sin estado: sirve en servidor y cliente.

import { colorDeAvance } from "@/lib/gamificacion/color-de-avance";

export default function BarraDeRequisitos({ pasos, etiqueta }: { pasos: boolean[]; etiqueta: string }) {
  const color = colorDeAvance(pasos.filter(Boolean).length / Math.max(1, pasos.length));
  return (
    <div role="img" aria-label={etiqueta} className="flex gap-1">
      {pasos.map((cumplido, i) => (
        <span key={i} className={`h-2 flex-1 rounded-pill ${cumplido ? "" : "bg-brand-100"}`} style={cumplido ? { background: color } : undefined} />
      ))}
    </div>
  );
}
