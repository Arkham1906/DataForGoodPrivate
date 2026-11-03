// Insignia de rango (2026-11-02; SRS v1.1: RF-GAM-82): el emblema de cada rango, en el estado que le toca a la
// persona (RF-GAM-78). «Insignia» designa solo esto: no es una medalla ni la etapa del avatar (RA-GAM-16).
//
// Hoy dibuja un marcador con el número del rango: el diseño final de las 20 insignias es un recurso gráfico
// pendiente (SRS tabla 4.5). Cuando exista, este es el único archivo que cambia. El rango avistado y los
// ocultos no dibujan su insignia ni su número real salvo el que el servidor ya envió (RNF-GAM-14): el avistado
// muestra «?». Es solo la figura; el botón o el enlace que la rodea lo pone quien la usa. Sin estado.

import type { EstadoDeRango } from "@/lib/gamificacion/rangos";

const ESTILOS: Record<EstadoDeRango, string> = {
  alcanzado: "border-2 border-transparent bg-brand-900 text-brand-200",
  actual: "border-2 border-transparent bg-brand-700 text-white",
  siguiente: "border-2 border-dashed border-success-700 bg-white text-success-800",
  avistado: "border-2 border-dashed border-brand-300 bg-white text-brand-700",
  oculto: "border-2 border-dashed border-system-300 bg-transparent text-system-500",
};

const TAMANOS = {
  md: "h-13 w-13 text-xl",
  lg: "h-16 w-16 text-2xl",
};

export default function InsigniaDeRango({
  numero,
  estado,
  tamano = "md",
}: {
  numero: number;
  estado: EstadoDeRango;
  tamano?: keyof typeof TAMANOS;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-extrabold ${ESTILOS[estado]} ${TAMANOS[tamano]}`}
    >
      {estado === "avistado" || estado === "oculto" ? "?" : numero}
    </span>
  );
}
