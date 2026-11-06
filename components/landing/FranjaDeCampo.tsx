// Franja con la ilustración de campo (2026-11-06): en la portada de la landing lleva la campaña destacada; en
// /explorar, /datos y /leaderboard, el buscador o las categorías encima. `redondeada` es para usarla dentro de
// una columna (/leaderboard también se ve en el marco de la app); sin ella va a todo el ancho.

import type { CSSProperties, ReactNode } from "react";
import IlustracionDeCampo from "@/components/landing/IlustracionDeCampo";

export default function FranjaDeCampo({
  children,
  redondeada = false,
  className = "",
  style,
}: {
  /** Opcional: en /contacto, /sobre-nosotros y los textos legales la franja es solo decorativa. */
  children?: ReactNode;
  redondeada?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`relative overflow-hidden bg-gradient-to-br from-brand-200 via-brand-50 to-success-50 ${
        redondeada ? "rounded-[18px]" : ""
      } ${className}`}
    >
      <IlustracionDeCampo />
      {children}
    </div>
  );
}
