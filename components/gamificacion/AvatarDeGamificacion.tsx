// Avatar de gamificación (2026-11-02; SRS v1.1: RF-GAM-23, 52, 76): la representación visual de la progresión.
// NO es la foto de perfil (components/ui/Avatar): esa es otra cosa y se cambia en /cuenta. La forma base
// depende del mayor rango alcanzado (la etapa) y no retrocede; los cosméticos se gestionan aparte (RF-GAM-52).
//
// Hoy dibuja una ilustración de marcador: el diseño final de las 20 etapas es un recurso gráfico pendiente
// (SRS tabla 4.5). Cuando exista, este es el único archivo que cambia para dibujar la etapa o los cosméticos;
// quien lo usa (TarjetaDeAvatar, /inicio, /progreso) solo le pasa la etapa. Sin estado: sirve en servidor y cliente.

const TAMANOS = {
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

export type TamanoDeAvatarDeGamificacion = keyof typeof TAMANOS;

export default function AvatarDeGamificacion({
  etapa,
  tamano = "lg",
  etiqueta,
  className = "",
}: {
  /** Etapa que se dibuja (1 a 20). */
  etapa: number;
  tamano?: TamanoDeAvatarDeGamificacion;
  /** Texto para lectores de pantalla. Sin él, el avatar es decorativo (quien lo rodea ya dice qué es). */
  etiqueta?: string;
  className?: string;
}) {
  const accesibilidad = etiqueta ? { role: "img" as const, "aria-label": etiqueta } : { "aria-hidden": true as const };
  return (
    <span
      {...accesibilidad}
      data-etapa={etapa}
      className={`flex shrink-0 items-end justify-center overflow-hidden rounded-lg bg-brand-100 ${TAMANOS[tamano]} ${className}`}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className="h-full w-full">
        {/* Marcador: gorro, cabeza y hombros. */}
        <path className="fill-brand-800" d="M20 14h24l-3-6H23z" />
        <circle className="fill-brand-300" cx="32" cy="24" r="12" />
        <path className="fill-brand-600" d="M10 58c2-12 11-18 22-18s20 6 22 18z" />
      </svg>
    </span>
  );
}
