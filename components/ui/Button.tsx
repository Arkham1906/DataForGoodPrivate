// Botón de la zona de usuario y buttonClasses() para dar forma de botón a otros elementos.

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

export function buttonClasses(variant: Variant = "secondary", size: Size = "md", className = "") {
  return `inline-flex items-center justify-center gap-2 rounded-pill border font-bold transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
}

export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}
