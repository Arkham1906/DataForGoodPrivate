// Esqueleto mientras el servidor arma la página (Next lo muestra solo; ver ui/Esqueletos).

import PantallaEsqueleto from "@/components/ui/Esqueletos";

export default function Loading() {
  return <PantallaEsqueleto tipo="tablero" etiqueta="Cargando tu progreso…" />;
}
