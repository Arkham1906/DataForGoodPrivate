// Barra de tramos de los requisitos del rango siguiente (2026-11-02; RF-GAM-22): un tramo por requisito, en
// verde los cumplidos (van primero) y en azul claro los que faltan. La imagen lleva su texto para lectores de
// pantalla, porque el color solo no basta. Sin estado: sirve en servidor y cliente.

export default function BarraDeRequisitos({ pasos, etiqueta }: { pasos: boolean[]; etiqueta: string }) {
  return (
    <div role="img" aria-label={etiqueta} className="flex gap-1">
      {pasos.map((cumplido, i) => (
        <span key={i} className={`h-2 flex-1 rounded-pill ${cumplido ? "bg-success-700" : "bg-brand-100"}`} />
      ))}
    </div>
  );
}
