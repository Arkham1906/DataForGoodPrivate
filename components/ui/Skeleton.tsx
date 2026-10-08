// Bloque de esqueleto de la zona de usuario (2026-10-07, experimental): un rectángulo gris que late
// mientras llegan los datos del servidor, con la forma del contenido que va a ocupar su lugar.
// El tamaño y la forma se dan con `className` (p. ej. "h-4 w-2/3", "rounded-pill"). Late con
// animate-pulse de Tailwind; con movimiento reducido se queda quieto. Es decorativo (aria-hidden):
// el contenedor que lo usa anuncia la carga con role="status" y un texto para lector de pantalla.

import type { CSSProperties } from "react";

/** Con `enLinea`, va dentro de un texto (p. ej. el contador de un botón) en vez de ocupar su renglón. */
export default function Skeleton({
  className = "",
  enLinea = false,
  style,
}: {
  className?: string;
  enLinea?: boolean;
  /** Para medidas calculadas (p. ej. el alto de cada barra de una gráfica). */
  style?: CSSProperties;
}) {
  // "rounded" de base solo si no viene otro redondeo: dos clases de radio chocan en Tailwind.
  const redondeo = /(^|\s)rounded-/.test(className) ? "" : "rounded";
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`${enLinea ? "inline-block" : "block"} animate-pulse ${redondeo} bg-system-200 motion-reduce:animate-none ${className}`}
    />
  );
}
