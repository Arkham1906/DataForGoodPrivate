// Piezas visuales compartidas por las pantallas de /supervisar (p. ej. BackLink).

import Link from "next/link";
import type { ReactNode } from "react";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="mb-5 inline-block text-[13px] text-system-600 hover:text-brand-600">← {children}</Link>;
}

export function DisabledAction({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "danger" | "primary" }) {
  const classes = {
    default: "border-system-300 bg-white text-system-600",
    danger: "border-error-700/40 bg-error-50 text-error-700",
    primary: "border-success-700/40 bg-success-50 text-success-700",
  };

  return <button type="button" disabled className={`rounded-pill border px-3.5 py-2 text-[12.5px] font-bold opacity-75 ${classes[tone]}`}>{children}</button>;
}
