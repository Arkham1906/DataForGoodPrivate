// Esqueleto mientras el servidor arma la página (Next lo muestra solo; ver ui/Esqueletos).
// Esqueleto por defecto del panel del SuperUsuario (listas y tablas). Las secciones con otra forma tienen su propio loading.tsx.

import PantallaEsqueleto from "@/components/ui/Esqueletos";

export default function Loading() {
  return <PantallaEsqueleto tipo="tabla" etiqueta="Cargando…" />;
}
