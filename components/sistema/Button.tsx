// Botón del panel del SuperUsuario (kit components/sistema). La zona de usuario usa components/ui/Button.

import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-success-700 text-white border-success-700 hover:bg-success-800",
  secondary: "bg-white text-system-900 border-system-300 hover:border-brand-600",
  danger: "bg-white text-error-700 border-error-700 hover:bg-error-50",
  ghost: "bg-transparent text-system-600 border-transparent hover:text-system-900",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-[12.5px] py-2 px-3.5",
  md: "text-sm py-3 px-5",
};

export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-pill border font-bold transition-[color,background-color,border-color,scale,filter] disabled:opacity-45 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
