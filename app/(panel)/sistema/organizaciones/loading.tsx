// Esqueleto mientras el servidor arma la página (Next lo muestra solo; ver ui/Esqueletos).
// Catálogo de organizaciones.

import PantallaEsqueleto from "@/components/ui/Esqueletos";

export default function Loading() {
  return <PantallaEsqueleto tipo="tabla" etiqueta="Cargando organizaciones…" />;
}
