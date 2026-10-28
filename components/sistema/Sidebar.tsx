"use client";

// Menú lateral del panel del SuperUsuario (/sistema, /usuarios, /supervisar).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ComponentType, type SVGProps } from "react";

import { claseDeOpcionMarcada, useIndicadorDeMenu } from "@/components/ui/useIndicadorDeMenu";

import {
  IconoAportes,
  IconoBirrete,
  IconoCampanas,
  IconoEdificio,
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
  // Lleva el número de temáticas nuevas por revisar (2026-10-19).
  { href: "/sistema/tematicas", etiqueta: "Temáticas", Icono: IconoEtiqueta, seccion: ["/sistema/tematicas"] },
  // Catálogo de especialidades del perfil (2026-10-26).
  { href: "/sistema/especialidades", etiqueta: "Especialidades", Icono: IconoBirrete, seccion: ["/sistema/especialidades"] },
  // Catálogo de organizaciones del perfil (2026-10-26).
  { href: "/sistema/organizaciones", etiqueta: "Organizaciones", Icono: IconoEdificio, seccion: ["/sistema/organizaciones"] },
  {
    // Reportes y sanciones están dentro (2026-10-13): lleva el número de reportes pendientes.
    href: "/supervisar",
    etiqueta: "Modo supervisor",
    Icono: IconoEscudo,
    seccion: ["/supervisar"],
    apartado: true,
  },
];

/**
 * reportesPendientes y tematicasPendientes los cuenta el layout de (panel) (contarReportesPendientes,
 * contarTematicasPendientes); cada uno va como número junto a su opción.
 */
export default function Sidebar({
  reportesPendientes = 0,
  tematicasPendientes = 0,
}: {
  reportesPendientes?: number;
  tematicasPendientes?: number;
}) {
  const pendientes: Record<string, { numero: number; texto: string }> = {
    "/supervisar": { numero: reportesPendientes, texto: "reportes pendientes" },
    // Temáticas y etiquetas (subtemáticas, 2026-10-27) por revisar: se revisan en la misma pantalla.
    "/sistema/tematicas": { numero: tematicasPendientes, texto: "temáticas o etiquetas por revisar" },
  };
  const pathname = usePathname();
  const activo =
    MENU.find(({ seccion, exacto }) =>
      seccion.some((base) => pathname === base || (!exacto && pathname.startsWith(`${base}/`))),
    )?.href ?? null;
  // La opción activa la marca una pastilla que se desliza (components/ui/useIndicadorDeMenu.tsx).
  const { navRef, visual, indicador, alElegir } = useIndicadorDeMenu(activo);

  return (
    <aside className="dashboard-root-sidebar dashboard-sidebar w-64 shrink-0 border-r border-system-200 bg-white p-3 lg:sticky lg:top-0 lg:h-[calc(100vh-61px)]">
      <p className="mb-1 px-3 pt-3 text-[10px] font-semibold uppercase tracking-wider text-system-500">
        Sistema
      </p>

      <nav ref={navRef} aria-label="Secciones del panel" className="dashboard-nav relative flex flex-col gap-1">
        {indicador}
        {MENU.map(({ href, etiqueta, Icono, apartado }) => {
          const marcada = visual === href;

          return (
            <Fragment key={href}>
              {/* Separador aparte, no en el enlace: así no queda dentro de la pastilla. */}
              {apartado ? <span aria-hidden="true" className="my-1.5 border-t border-system-200" /> : null}
              <Link
                href={href}
                data-menu-clave={href}
                aria-current={activo === href ? "page" : undefined}
                onClick={alElegir(href)}
                className={`group relative flex items-center gap-2.5 rounded-pill px-3.5 py-2.5 text-sm font-medium transition-colors duration-300 ${
                  marcada ? claseDeOpcionMarcada() : "text-system-600 hover:bg-system-100 hover:text-system-900"
                }`}
              >
                <Icono className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                {etiqueta}
                {(pendientes[href]?.numero ?? 0) > 0 ? (
                  <span className="ml-auto rounded-pill bg-error-700 px-2 py-0.5 font-mono text-[10.5px] font-bold text-white">
                    {pendientes[href].numero > 99 ? "99+" : pendientes[href].numero}
                    <span className="sr-only"> {pendientes[href].texto}</span>
                  </span>
                ) : null}
              </Link>
            </Fragment>
          );
        })}
      </nav>

      {/* Nota, no botón: fondo claro y franja lateral para no confundirse con la opción activa del menú. */}
      <div className="dashboard-sidebar-callout mt-5 rounded-r-lg border-l-4 border-brand-600 bg-brand-50 px-4 py-3.5">
        <p className="text-[12.5px] leading-relaxed text-system-600">
          Revisa con criterio: cada validación sostiene la calidad de los datos.
        </p>
        <p className="mt-2 text-[13px] font-semibold text-brand-800">Gracias por moderar</p>
      </div>
    </aside>
  );
}
