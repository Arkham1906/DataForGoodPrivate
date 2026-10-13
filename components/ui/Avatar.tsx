// Ícono del perfil (2026-10-13): las iniciales, uno de los íconos predefinidos (masculino, femenino,
// otro) o la foto propia (GET /api/usuarios/[id]/avatar, con la versión en la URL para que el
// navegador no muestre una foto vieja). Lo usan la barra superior (EnlaceAlPerfil), el encabezado de
// /cuenta y su editor (EditarAvatar). Es decorativo: el nombre siempre va al lado.

import { BASE_PATH } from "@/lib/base-path";
import { inicialesDe, type DatosDeAvatar, type IconoPredefinido } from "@/lib/usuarios/avatar-opciones";

const TAMANOS = {
  sm: "h-9 w-9 text-[12px] font-bold",
  md: "h-12 w-12 text-sm font-extrabold",
  lg: "h-16 w-16 text-lg font-extrabold",
};

const FONDO: Record<IconoPredefinido, string> = {
  masculino: "bg-brand-200",
  femenino: "bg-success-200",
  otro: "bg-system-200",
};

/** Colores de cada ícono (clases de la paleta de globals.css, nada de colores sueltos). */
const ESTILO: Record<IconoPredefinido, { cabello: string; ropa: string }> = {
  masculino: { cabello: "fill-system-800", ropa: "fill-brand-700" },
  femenino: { cabello: "fill-warning-800", ropa: "fill-success-700" },
  otro: { cabello: "fill-system-900", ropa: "fill-system-600" },
};

/**
 * Ilustración de busto (2026-10-13, más detallada a pedido del usuario): cara con ojos, cejas,
 * sonrisa y mejillas, orejas, cuello y camisa con cuello; cambia el peinado: corto (masculino),
 * largo con fleco y aretes (femenino) y despeinado con lentes (otro).
 */
export function IconoDePerfil({ tipo }: { tipo: IconoPredefinido }) {
  const { cabello, ropa } = ESTILO[tipo];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-full w-full">
      {tipo === "femenino" && (
        // Cabello largo, detrás de la cabeza y hasta los hombros.
        <path className={cabello} d="M17.5 31c0-10.8 6.4-18 14.5-18s14.5 7.2 14.5 18v16.5c-2.6 1.3-5.4 1.6-8.5 1.1V31H26v17.6c-3.1.5-5.9.2-8.5-1.1z" />
      )}
      {/* Cuello y camisa */}
      <rect className="fill-error-200" x="27.5" y="37" width="9" height="10" rx="3" />
      <path className={ropa} d="M9 64c0-12.6 10.3-21 23-21s23 8.4 23 21z" />
      <path className="fill-white" fillOpacity="0.9" d="M26.2 44.2 32 51.5l5.8-7.3c-1.8-.8-3.8-1.2-5.8-1.2s-4 .4-5.8 1.2z" />
      {/* Orejas y cara */}
      <circle className="fill-error-200" cx="20.6" cy="30.5" r="3.1" />
      <circle className="fill-error-200" cx="43.4" cy="30.5" r="3.1" />
      <ellipse className="fill-error-100" cx="32" cy="29.5" rx="11.6" ry="12.6" />
      {/* Peinado */}
      {tipo === "masculino" && (
        <path className={cabello} d="M20.4 28.8c-1-8.7 4.3-14.8 11.6-14.8 7.6 0 12.7 5.8 11.6 14.8-1.1-3.6-3.3-6-6.6-7.1-2.6 2.1-7.6 3.2-13 2.8-1.6 1-2.9 2.4-3.6 4.3z" />
      )}
      {tipo === "femenino" && (
        <path className={cabello} d="M20.4 29.2c.6-8.8 5.4-13.7 11.6-13.7 6.3 0 11.1 4.9 11.6 13.4-4.8-.5-9.4-3-12.1-6.8-2.4 3.7-6.5 6.3-11.1 7.1z" />
      )}
      {tipo === "otro" && (
        <path className={cabello} d="M20.5 27.6c-1.8-7.8 3.6-13.8 11.5-13.8 8 0 13.3 6 11.5 13.8-1.4-2.6-3.3-4.1-5.6-4.5-1.6 1.5-3.7 2.2-5.9 2.2s-4.3-.7-5.9-2.2c-2.3.4-4.2 1.9-5.6 4.5z" />
      )}
      {/* Cejas, ojos, mejillas y sonrisa */}
      <path d="M25.5 26.3c1.2-.8 2.6-.9 4-.4M34.5 25.9c1.4-.5 2.8-.4 4 .4" className="stroke-system-900" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle className="fill-system-900" cx="27.6" cy="30.2" r="1.35" />
      <circle className="fill-system-900" cx="36.4" cy="30.2" r="1.35" />
      <circle className="fill-error-300" fillOpacity="0.7" cx="25" cy="34.2" r="1.8" />
      <circle className="fill-error-300" fillOpacity="0.7" cx="39" cy="34.2" r="1.8" />
      <path d="M28.6 35.6c1 1.2 2.1 1.8 3.4 1.8s2.4-.6 3.4-1.8" className="stroke-system-900" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      {tipo === "otro" && (
        // Lentes redondos.
        <g className="stroke-system-900" strokeWidth="1.1" fill="none">
          <circle cx="27.6" cy="30.2" r="3.4" />
          <circle cx="36.4" cy="30.2" r="3.4" />
          <path d="M31 30.2h2" />
        </g>
      )}
      {tipo === "femenino" && (
        // Aretes.
        <>
          <circle className="fill-warning-500" cx="20.6" cy="34.6" r="1.2" />
          <circle className="fill-warning-500" cx="43.4" cy="34.6" r="1.2" />
        </>
      )}
    </svg>
  );
}

export default function Avatar({ datos, tamano = "sm" }: { datos: DatosDeAvatar; tamano?: keyof typeof TAMANOS }) {
  const base = `flex shrink-0 items-center justify-center overflow-hidden rounded-full ${TAMANOS[tamano]}`;

  if (datos.avatar === "foto" && datos.version) {
    return (
      <div className={`${base} bg-system-200`}>
        {/* La sirve un route handler con sesión (no pasa por next/image). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BASE_PATH}/api/usuarios/${datos.usuarioId}/avatar?v=${encodeURIComponent(datos.version)}`}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (datos.avatar && datos.avatar !== "foto") {
    return (
      <div className={`${base} ${FONDO[datos.avatar]}`}>
        <IconoDePerfil tipo={datos.avatar} />
      </div>
    );
  }

  return <div className={`${base} bg-brand-600 text-white`}>{inicialesDe(datos.nombre)}</div>;
}
