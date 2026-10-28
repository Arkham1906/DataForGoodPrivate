// Etiqueta de estado de la zona de usuario (tonos: default, ok, warn, danger...).

import { ReactNode } from "react";

type Tone = "default" | "ok" | "warn" | "danger" | "info" | "on";

interface TagProps {
  children: ReactNode;
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  default: "bg-white border-system-300 text-system-600",
  ok: "bg-success-50 border-success-50 text-success-700",
  warn: "bg-warning-50 border-warning-200 text-warning-800",
  danger: "bg-error-50 border-error-50 text-error-700",
  // Novedades (2026-10-27, notificaciones "Novedades para participar").
  info: "bg-brand-50 border-brand-200 text-brand-800",
  on: "bg-brand-600 border-brand-600 text-white",
};

export default function Tag({ children, tone = "default" }: TagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2.5 py-1 text-[12.5px] font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
