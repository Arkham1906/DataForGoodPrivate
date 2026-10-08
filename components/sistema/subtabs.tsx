"use client";

// Pestañas secundarias del panel (p. ej. Dashboard / Directorio / Sanciones).

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Pestana = { href: string; etiqueta: string };

export default function Subtabs({
  pestanas,
  etiquetaAria,
  listaEnMovil = false,
  distribuidasEnMovil = false,
  volverAlMenuEnMovil = false,
  menuInicialMovil = false,
}: {
  pestanas: Pestana[];
  etiquetaAria: string;
  listaEnMovil?: boolean;
  distribuidasEnMovil?: boolean;
  volverAlMenuEnMovil?: boolean;
  menuInicialMovil?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={etiquetaAria} className="mb-6">
      {volverAlMenuEnMovil && (
        <Link
          href="/usuarios?movil=menu"
          className="mb-4 inline-flex items-center rounded-pill border border-system-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-system-600 hover:bg-system-100 md:hidden"
        >
          <span aria-hidden="true" className="mr-2">←</span>
          Menú de usuarios
        </Link>
      )}

      <div
        className={`${
          volverAlMenuEnMovil
            ? "hidden md:flex md:flex-wrap md:gap-1 md:border-b md:border-system-200"
            : listaEnMovil
              ? "grid min-h-[65svh] grid-cols-1 grid-rows-4 gap-3 md:min-h-0 md:grid-rows-none md:flex md:flex-wrap md:gap-1 md:border-b md:border-system-200"
              : distribuidasEnMovil
                ? "grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-1 md:border-b md:border-system-200"
              : "flex flex-wrap gap-1 border-b border-system-200"
        }`}
      >
        {pestanas.map(({ href, etiqueta }) => {
          const activa = pathname === href;
          const esDirectorioDesdeMenu = menuInicialMovil && href === "/usuarios" && activa;
          return (
            <Link
              key={href}
              href={href}
              aria-current={activa && !esDirectorioDesdeMenu ? "page" : undefined}
              className={
                listaEnMovil
                  ? esDirectorioDesdeMenu
                    ? "flex items-center rounded-lg border border-system-200 bg-white px-5 py-5 text-base font-medium text-system-600 transition-colors hover:bg-system-100 hover:text-system-900 md:-mb-px md:rounded-none md:border-0 md:border-b-2 md:border-brand-600 md:bg-transparent md:px-4 md:py-2.5 md:text-[13px] md:font-bold md:text-brand-600"
                    : `flex items-center rounded-lg border px-5 py-5 text-base font-medium transition-colors md:-mb-px md:rounded-none md:border-0 md:border-b-2 md:px-4 md:py-2.5 md:text-[13px] ${
                        activa
                          ? "border-brand-600 bg-brand-600 text-white md:bg-transparent md:font-bold md:text-brand-600"
                          : "border-system-200 bg-white text-system-600 hover:bg-system-100 hover:text-system-900 md:border-transparent"
                      }`
                  : distribuidasEnMovil
                    ? `flex items-center justify-center rounded-lg border px-2 py-3 text-center text-[13px] font-medium transition-colors md:-mb-px md:flex-none md:rounded-none md:border-0 md:border-b-2 md:px-4 md:py-2.5 ${
                        activa
                          ? "border-brand-600 bg-brand-600 font-bold text-white md:bg-transparent md:text-brand-600"
                          : "border-system-200 bg-white text-system-600 hover:bg-system-100 hover:text-system-900 md:border-transparent"
                      }`
                  : `-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                      activa
                        ? "border-brand-600 font-bold text-brand-600"
                        : "border-transparent text-system-600 hover:bg-system-100 hover:text-system-900"
                    }`
              }
            >
              {etiqueta}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
