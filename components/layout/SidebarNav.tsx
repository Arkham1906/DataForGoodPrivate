"use client";

// Menú lateral de la zona de usuario. Agrega "Supervisión" si el usuario tiene rol supervisor
// y "Revisor de aportes" si tiene rol revisor. "Supervisión" lleva el número de reportes pendientes
// (Reportes y Sanciones están dentro, 2026-10-13). La opción activa la marca una pastilla que
// se desliza entre opciones (components/ui/useIndicadorDeMenu.tsx).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { claseDeOpcionMarcada, useIndicadorDeMenu } from "@/components/ui/useIndicadorDeMenu";
import type { SessionUser } from "@/lib/session";

type Opcion = { href: string; label: string };

// Todas las opciones se marcan en azul (accent), el color principal del sistema.
const NAV_ITEMS: Opcion[] = [
  { href: "/campanas", label: "Explorar" },
  { href: "/mis-aportes", label: "Mis aportes" },
  { href: "/mis-campanas", label: "Mis campañas" },
];

export default function SidebarNav({
  usuario,
  reportesPendientes = 0,
}: {
  usuario: SessionUser;
  /** Lo cuenta el layout de (dashboard), solo para supervisores. */
  reportesPendientes?: number;
}) {
  const pathname = usePathname();
  const roles = Array.isArray(usuario.role) ? usuario.role : [];

  const opciones: Opcion[] = [
    ...NAV_ITEMS,
    ...(roles.includes("supervisor") ? [{ href: "/supervision", label: "Supervisión" }] : []),
    ...(roles.includes("revisor") ? [{ href: "/revisiones", label: "Revisor de aportes" }] : []),
  ];

  const activo = opciones.find((o) => pathname.startsWith(o.href))?.href ?? null;
  const { navRef, visual, indicador, alElegir } = useIndicadorDeMenu(activo);

  return (
    <aside aria-label="Menú de la cuenta" className="dashboard-user-nav dashboard-sidebar w-64 shrink-0 border-r border-system-200 bg-white p-4 lg:sticky lg:top-0 lg:h-[calc(100vh-61px)]">
      <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-system-500">
        Participar
      </p>
      <nav ref={navRef} aria-label="Secciones" className="dashboard-nav relative flex flex-col gap-1">
        {indicador}
        {opciones.map((item) => {
          const marcada = visual === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-menu-clave={item.href}
              aria-current={activo === item.href ? "page" : undefined}
              onClick={alElegir(item.href)}
              className={`relative rounded-pill px-3.5 py-2.5 text-sm font-medium transition-colors duration-300 ${
                marcada ? claseDeOpcionMarcada() : "text-system-600 hover:bg-system-100 hover:text-system-900"
              }`}
            >
              {item.label}
              {item.href === "/supervision" && reportesPendientes > 0 ? (
                <span className="ml-2 rounded-pill bg-error-700 px-2 py-0.5 font-mono text-[10.5px] font-bold text-white">
                  {reportesPendientes > 99 ? "99+" : reportesPendientes}
                  <span className="sr-only"> reportes pendientes</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Nota, no botón: fondo claro y franja lateral para no confundirse con la opción activa del menú. */}
      <div className="dashboard-sidebar-callout mt-6 rounded-r-lg border-l-4 border-brand-600 bg-brand-50 px-4 py-3.5">
        <p className="text-[13px] leading-snug text-system-600">
          Cada aporte transforma datos en impacto para tu comunidad.
        </p>
        <p className="mt-2 text-[13px] font-semibold text-brand-800">¡Súmate!</p>
      </div>
    </aside>
  );
}
