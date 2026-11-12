"use client";

// Menú lateral de la zona de usuario. Agrega "Supervisión" (bajo el título "Supervisar") si el usuario tiene rol supervisor
// y "Revisor de aportes" (bajo "Revisar") si tiene rol revisor. "Supervisión" lleva el número de reportes pendientes
// (Reportes y Sanciones están dentro, 2026-10-13). La opción activa la marca una pastilla que
// se desliza entre opciones (components/ui/useIndicadorDeMenu.tsx). Cada opción lleva su ícono, como el
// menú del SuperUsuario (2026-10-27; mismos íconos de components/sistema/icons.tsx).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ComponentType, type SVGProps } from "react";
import {
  IconoAportes,
  IconoBuscar,
  IconoCampanas,
  IconoEscudo,
  IconoInicio,
  IconoProgreso,
  IconoRevisar,
} from "@/components/sistema/icons";
import { claseDeOpcionMarcada, useIndicadorDeMenu } from "@/components/ui/useIndicadorDeMenu";
import type { SessionUser } from "@/lib/session";
import AvisoDelMenu, { type AvisoDelMenu as AvisoDelMenuTipo } from "@/components/layout/AvisoDelMenu";

type Opcion = {
  href: string;
  label: string;
  Icono: ComponentType<SVGProps<SVGSVGElement>>;
  /** Abre una sección aparte: línea y título como "Participar" (2026-11-12, a pedido del usuario). */
  seccion?: string;
};

// Mismo estilo que el título "Participar".
const CLASE_DE_TITULO = "px-2 text-[10px] font-semibold uppercase tracking-wider text-system-500";

// Todas las opciones se marcan en azul (accent), el color principal del sistema.
const NAV_ITEMS: Opcion[] = [
  // Inicio (2026-10-24): la primera pantalla al iniciar sesión.
  { href: "/inicio", label: "Inicio", Icono: IconoInicio },
  // Mi progreso (2026-11-02, decisión del responsable): solo lo de la gamificación (rango, misiones, racha).
  { href: "/progreso", label: "Mi progreso", Icono: IconoProgreso },
  // "Explorar campañas" desde el 2026-10-27 (antes "Explorar"), a pedido del usuario.
  { href: "/campanas", label: "Explorar campañas", Icono: IconoBuscar },
  { href: "/mis-aportes", label: "Mis aportes", Icono: IconoAportes },
  { href: "/mis-campanas", label: "Mis campañas", Icono: IconoCampanas },
];

// Sin contador de reportes junto a "Supervisión" (2026-10-15, a pedido del usuario): cada reporte llega
// como notificación a la campana (lib/notificaciones/avisos-a-supervisores.ts).
export default function SidebarNav({ usuario, aviso }: { usuario: SessionUser; aviso: AvisoDelMenuTipo }) {
  const pathname = usePathname();
  const roles = Array.isArray(usuario.role) ? usuario.role : [];

  const opciones: Opcion[] = [
    ...NAV_ITEMS,
    ...(roles.includes("supervisor")
      ? [{ href: "/supervision", label: "Supervisión", Icono: IconoEscudo, seccion: "Supervisar" }]
      : []),
    ...(roles.includes("revisor")
      ? [{
          href: "/revisiones",
          label: "Revisor de aportes",
          Icono: IconoRevisar,
          seccion: "Revisar",
        }]
      : []),
  ];

  const activo = opciones.find((o) => pathname.startsWith(o.href))?.href ?? null;
  const { navRef, visual, indicador, alElegir } = useIndicadorDeMenu(activo);

  return (
    <aside aria-label="Menú de la cuenta" className="dashboard-user-nav dashboard-sidebar w-64 shrink-0 border-r border-system-200 bg-white p-4 lg:sticky lg:top-0 lg:h-[calc(100vh-61px)]">
      <p className={`mb-3 ${CLASE_DE_TITULO}`}>Participar</p>
      <nav ref={navRef} aria-label="Secciones" className="dashboard-nav relative flex flex-col gap-1">
        {indicador}
        {opciones.map((item) => {
          const marcada = visual === item.href;
          return (
            <Fragment key={item.href}>
              {item.seccion ? <span aria-hidden="true" className="my-1.5 border-t border-system-200" /> : null}
              {/* En móvil el menú es una tira horizontal y "Participar" se oculta: los títulos también. */}
              {item.seccion ? <p className={`mb-1 max-md:hidden ${CLASE_DE_TITULO}`}>{item.seccion}</p> : null}
              <Link
                href={item.href}
                data-menu-clave={item.href}
                aria-current={activo === item.href ? "page" : undefined}
                onClick={alElegir(item.href)}
                className={`group relative flex items-center gap-2.5 rounded-pill px-3.5 py-2.5 text-sm font-medium transition-colors duration-300 ${
                  marcada ? claseDeOpcionMarcada() : "text-system-600 hover:bg-system-100 hover:text-system-900"
                }`}
              >
                <item.Icono className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                {item.label}
              </Link>
            </Fragment>
          );
        })}
      </nav>

      {/* Nota, no botón: fondo claro y franja lateral para no confundirse con la opción activa del menú. */}
      {/* "Tu siguiente paso" (2026-11-10): lo calcula ShellDeUsuario con lib/usuarios/aviso-del-menu.ts. */}
      <AvisoDelMenu aviso={aviso} className="mt-6" />
    </aside>
  );
}
