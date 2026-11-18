// Íconos del formulario para aportar (/campanas/[id]/aportar, 2026-11-18): uno por tipo de archivo y los de
// subir, listo, pendiente y aviso. Mismo trazo que components/sistema/icons.tsx.

import type { ReactNode, SVGProps } from "react";
import type { TipoDeArchivo } from "@/lib/aportes/archivo";

type IconoProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconoProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconoFoto(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M14.5 4h-5L7.5 6.5H4a1 1 0 0 0-1 1V19a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7.5a1 1 0 0 0-1-1h-3.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </Base>
  );
}

export function IconoVideo(props: IconoProps) {
  return (
    <Base {...props}>
      <rect x="2.5" y="6" width="13" height="12" rx="2" />
      <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
    </Base>
  );
}

export function IconoAudio(props: IconoProps) {
  return (
    <Base {...props}>
      <rect x="9" y="2.5" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3.5" />
    </Base>
  );
}

export function IconoDocumento(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M14 2.5H6.5a1 1 0 0 0-1 1v17a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V7z" />
      <path d="M14 2.5V7h4.5" />
      <path d="M9 12.5h6M9 16h6" />
    </Base>
  );
}

export function IconoTexto(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M4 6h16M4 10.5h16M4 15h10M4 19.5h7" />
    </Base>
  );
}

export function IconoSubir(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M7 17.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9a4 4 0 0 1-.5 7.97" />
      <path d="M12 12v9M8.5 15.5 12 12l3.5 3.5" />
    </Base>
  );
}

export function IconoListo(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Base>
  );
}

export function IconoReloj(props: IconoProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Base>
  );
}

export function IconoInfo(props: IconoProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5h.01" />
    </Base>
  );
}

export function IconoFlechaAtras(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Base>
  );
}

const ICONO_DE_TIPO: Record<TipoDeArchivo, (props: IconoProps) => ReactNode> = {
  foto: IconoFoto,
  video: IconoVideo,
  audio: IconoAudio,
  documento: IconoDocumento,
  texto: IconoTexto,
};

export function IconoDeTipoDeArchivo({ tipo, ...props }: IconoProps & { tipo: TipoDeArchivo }) {
  const Icono = ICONO_DE_TIPO[tipo];
  return <Icono {...props} />;
}
