"use client";

// Pestañas de «Mi progreso» (2026-11-04; diseño v10). Cada una es una ruta: el subrayado sale de la URL. Las pantallas
// que aún no existen se ven deshabilitadas, sin enlace (lib/gamificacion/pantallas-de-progreso.ts).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PANTALLAS_DE_PROGRESO } from "@/lib/gamificacion/pantallas-de-progreso";

const BASE = "-mb-px whitespace-nowrap border-b-2 px-0.5 py-1.5 text-sm font-semibold";

export default function PestanasDeProgreso() {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones de Mi progreso" className="relative overflow-x-auto border-b border-system-200">
      <ul className="flex gap-x-5">
        {PANTALLAS_DE_PROGRESO.map((p) => (
          <li key={p.clave}>
            {p.href ? (
              <Link
                href={p.href}
                aria-current={ruta === p.href ? "page" : undefined}
                className={`${BASE} inline-block ${
                  ruta === p.href
                    ? "border-brand-600 text-system-900"
                    : "border-transparent text-system-700 hover:text-system-900"
                }`}
              >
                {p.etiqueta}
              </Link>
            ) : (
              <span aria-disabled="true" title="Próximamente" className={`${BASE} inline-block cursor-not-allowed border-transparent text-system-500`}>
                {p.etiqueta}
                <span className="sr-only"> (próximamente)</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
