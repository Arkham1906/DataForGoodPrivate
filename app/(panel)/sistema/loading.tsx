// Esqueleto mientras el servidor arma la página (Next lo muestra solo; ver ui/Esqueletos).
// Inicio del panel (/sistema): cifras y gráficas.

import PantallaEsqueleto from "@/components/ui/Esqueletos";

export default function Loading() {
  return <PantallaEsqueleto tipo="tablero" etiqueta="Cargando el inicio…" />;
}
