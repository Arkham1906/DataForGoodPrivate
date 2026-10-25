// Esqueleto mientras el servidor arma la página (Next lo muestra solo; ver ui/Esqueletos).
// Inicio del usuario: cifras, campañas para ti y actividad.

import PantallaEsqueleto from "@/components/ui/Esqueletos";

export default function Loading() {
  return <PantallaEsqueleto tipo="tablero" etiqueta="Cargando tu inicio…" />;
}
