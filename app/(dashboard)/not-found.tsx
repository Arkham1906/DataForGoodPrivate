// 404 dentro de la zona de usuario (una página llamó a notFound(), p. ej. una campaña ajena): el
// aviso sin <main>, porque el layout de (dashboard) ya lo tiene.

import { AvisoNoEncontrado } from "@/components/ui/AvisoNoEncontrado";

export default function NoEncontrada() {
  return <AvisoNoEncontrado volverA="/campanas" textoVolver="Ir a campañas" />;
}
