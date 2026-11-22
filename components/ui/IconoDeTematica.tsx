// Ícono de línea de una temática (2026-11-11), para los mosaicos de "Elige tus temáticas"
// (ui/SelectorDeTemas). Dibujos propios, uno por cada temática base de lib/intereses.ts
// (TEMAS_DE_INTERES); las demás (propuestas o nuevas del catálogo) llevan el genérico.
// Desde el 2026-11-21 los dibujos viven en lib/tematicas/dibujos.ts, que comparte con la imagen
// predeterminada del banner: si se agrega una temática base, agregar ahí su dibujo.
// Toma currentColor; es decorativo (aria-hidden): el nombre va como texto junto al ícono.

import { dibujoDeTematica } from "@/lib/tematicas/dibujos";

export default function IconoDeTematica({ tematica, className = "" }: { tematica: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Textos fijos de lib/tematicas/dibujos.ts, nunca del usuario.
      dangerouslySetInnerHTML={{ __html: dibujoDeTematica(tematica) }}
    />
  );
}
