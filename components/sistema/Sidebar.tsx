"use client";

// Menú lateral del panel del SuperUsuario (/sistema, /usuarios, /supervisar).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ComponentType, type SVGProps } from "react";

import { claseDeOpcionMarcada, useIndicadorDeMenu } from "@/components/ui/useIndicadorDeMenu";

import {
  IconoAportes,
  IconoCampanas,
  IconoEscudo,
  IconoEtiqueta,
  IconoInicio,
  IconoUsuarios,
} from "./icons";

type Entrada = {
  href: string;
  etiqueta: string;
  Icono: ComponentType<SVGProps<SVGSVGElement>>;
  /** Rutas que también deben marcar esta entrada como activa. */
  seccion: string[];
  /** Separado del resto: no es una sección más, es un cambio de modo. */
  apartado?: boolean;
  /** Activa solo en la ruta exacta (Inicio, para no marcarse en /sistema/campanas). */
  exacto?: boolean;
};

const MENU: Entrada[] = [
  { href: "/sistema", etiqueta: "Inicio", Icono: IconoInicio, seccion: ["/sistema"], exacto: true },
  {
    href: "/usuarios?movil=menu",
    etiqueta: "Usuarios",
    Icono: IconoUsuarios,
    seccion: ["/usuarios", "/supervisores"],
  },
  {
    // Bajo /sistema: /campanas es la pantalla del usuario común.
    href: "/sistema/campanas",
    etiqueta: "Campañas",
    Icono: IconoCampanas,
    seccion: ["/sistema/campanas"],
  },
  { href: "/aportes", etiqueta: "Aportes", Icono: IconoAportes, seccion: ["/aportes"] },
  { href: "/sistema/tematicas", etiqueta: "Temáticas", Icono: IconoEtiqueta, seccion: ["/sistema/tematicas"] },
  {
    href: "/supervisar",
    etiqueta: "Modo supervisor",
    Icono: IconoEscudo,
    seccion: ["/supervisar"],
    apartado: true,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const activo =
    MENU.find(({ seccion, exacto }) =>
      seccion.some((base) => pathname === base || (!exacto && pathname.startsWith(`${base}/`))),
    )?.href ?? null;
  // La opción activa la marca una pastilla que se desliza (components/ui/useIndicadorDeMenu.tsx).
  const { navRef, visual, indicador, alElegir } = useIndicadorDeMenu(activo);

  return (
    <aside className="dashboard-sidebar w-64 shrink-0 border-r border-line bg-surface p-3 lg:sticky lg:top-0 lg:h-[calc(100vh-61px)]">
      <p className="mb-1 px-3 pt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
        Sistema
      </p>

      <nav ref={navRef} aria-label="Secciones del panel" className="dashboard-nav relative flex flex-col gap-1">
        {indicador}
        {MENU.map(({ href, etiqueta, Icono, apartado }) => {
          const marcada = visual === href;

          return (
            <Fragment key={href}>
              {/* Separador aparte, no en el enlace: así no queda dentro de la pastilla. */}
              {apartado ? <span aria-hidden="true" className="my-1.5 border-t border-line" /> : null}
              <Link
                href={href}
                data-menu-clave={href}
                aria-current={activo === href ? "page" : undefined}
                onClick={alElegir(href)}
                className={`group relative flex items-center gap-2.5 rounded-pill px-3.5 py-2.5 text-sm font-medium transition-colors duration-300 ${
                  marcada ? claseDeOpcionMarcada() : "text-ink-2 hover:bg-sunken hover:text-ink"
                }`}
              >
                <Icono className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                {etiqueta}
              </Link>
            </Fragment>
          );
        })}
      </nav>

      {/* Nota, no botón: fondo claro y franja lateral para no confundirse con la opción activa del menú. */}
      <div className="dashboard-sidebar-callout mt-5 rounded-r-lg border-l-4 border-accent bg-accent-tint px-4 py-3.5">
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Revisa con criterio: cada validación sostiene la calidad de los datos.
        </p>
        <p className="mt-2 text-[13px] font-semibold text-accent-deep">Gracias por moderar</p>
      </div>
    </aside>
  );
}
