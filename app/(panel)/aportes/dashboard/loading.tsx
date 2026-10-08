// Esqueleto mientras el servidor arma la página (Next lo muestra solo; ver ui/Esqueletos).
// Dashboard de aportes.

import PantallaEsqueleto from "@/components/ui/Esqueletos";

export default function Loading() {
  return <PantallaEsqueleto tipo="tablero" etiqueta="Cargando el dashboard de aportes…" />;
}
