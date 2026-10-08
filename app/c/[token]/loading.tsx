// Esqueleto mientras el servidor arma la página (Next lo muestra solo; ver ui/Esqueletos).
// Ficha pública de una campaña compartida (/c/[token]).

import PantallaEsqueleto from "@/components/ui/Esqueletos";

export default function Loading() {
  return <PantallaEsqueleto tipo="detalle" etiqueta="Cargando campaña…" className="mx-auto max-w-5xl px-4 py-10" />;
}
