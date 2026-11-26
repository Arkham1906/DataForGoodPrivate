// Ícono de información con una de las ayudas comunes de gamificación (TEXTOS.ayudas): la misma explicación en todas
// las pantallas.

import AyudaEmergente from "@/components/ui/AyudaEmergente";
import { TEXTOS } from "@/lib/gamificacion/textos";

export type ConceptoDeAyuda = keyof typeof TEXTOS.ayudas;

export default function Ayuda({ concepto, tono }: { concepto: ConceptoDeAyuda; tono?: "normal" | "claro" }) {
  const { etiqueta, texto } = TEXTOS.ayudas[concepto];
  return (
    <AyudaEmergente etiqueta={etiqueta} tono={tono}>
      {texto}
    </AyudaEmergente>
  );
}
