// Íconos SVG del panel del SuperUsuario.

import type { ReactNode, SVGProps } from "react";

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

export function IconoInicio(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </Base>
  );
}

export function IconoUsuarios(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </Base>
  );
}

export function IconoCampanas(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </Base>
  );
}

export function IconoAportes(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Base>
  );
}

export function IconoEscudo(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Base>
  );
}

export function IconoEtiqueta(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </Base>
  );
}

/** Especialidades del perfil (2026-10-26): birrete. */
export function IconoBirrete(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M2 9l10-5 10 5-10 5-10-5z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 9v6" />
    </Base>
  );
}

/** Organizaciones del perfil (2026-10-26): edificio. */
export function IconoEdificio(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
      <path d="M15 10h4a1 1 0 0 1 1 1v10" />
      <path d="M3 21h18" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </Base>
  );
}

/** Reportes: triángulo de alerta (Campañas ya usa la bandera). */
export function IconoAlerta(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Base>
  );
}

export function IconoHoja(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M4 20c0-8 6-14 16-15 0 10-5 15-11 15-2.5 0-5 0-5 0z" />
      <path d="M9 15c2-3 5-5 8-6" />
    </Base>
  );
}

export function IconoBuscar(props: IconoProps) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Base>
  );
}

export function IconoCampana(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Base>
  );
}
