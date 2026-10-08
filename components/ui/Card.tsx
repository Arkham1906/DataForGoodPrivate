// Contenedor tipo tarjeta de la zona de usuario.

import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  highlighted?: boolean;
}

export default function Card({
  children,
  highlighted,
  className = "",
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm ${
        highlighted ? "border-brand-600" : "border-system-200"
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
