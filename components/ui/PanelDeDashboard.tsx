// Recuadro blanco con título de los dashboards de la zona de usuario (2026-11-13): /revisiones y /supervision.
// Server o cliente (sin estado). `aria-label` con el título para que el lector de pantalla lo anuncie como región.

import type { ReactNode } from "react";

export default function PanelDeDashboard({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-system-200 bg-white p-4 ${className}`} aria-label={titulo}>
      <h3 className="mb-3 text-[15px] font-bold text-system-900">{titulo}</h3>
      {children}
    </section>
  );
}
