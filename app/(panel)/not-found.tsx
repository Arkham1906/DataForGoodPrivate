// 404 dentro del panel del SuperUsuario (una página llamó a notFound(), p. ej. un supervisor que no
// existe): el aviso sin <main>, porque el layout de (panel) ya lo tiene.

import { AvisoNoEncontrado } from "@/components/ui/AvisoNoEncontrado";

export default function NoEncontrada() {
  return <AvisoNoEncontrado volverA="/sistema" textoVolver="Ir al inicio del panel" />;
}
