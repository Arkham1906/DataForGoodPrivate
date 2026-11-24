// Recuadro azul al pie de los menús laterales (2026-11-10, a pedido del usuario): antes era una frase fija.
// Lo usan components/layout/SidebarNav (zona de usuario, lib/usuarios/aviso-del-menu.ts) y components/sistema/Sidebar
// (panel, lib/sistema/aviso-del-menu.ts). Desde el 2026-11-24 muestra los pendientes más urgentes (los urgentes con su
// etiqueta) y "Ver todos" a la pantalla de pendientes (avisoConPendientes de lib/pendientes/tipos.ts). Solo pinta lo
// que le llega; sin imports de servidor, así lo pueden usar componentes cliente. En móvil no se ve
// (.dashboard-sidebar-callout en globals.css): por eso "Pendientes" también está en el menú, con su número.

import Link from "next/link";
import type { AvisoDePendientes } from "@/lib/pendientes/tipos";

export type AvisoDelMenu = AvisoDePendientes;

export default function AvisoDelMenu({ aviso, className = "" }: { aviso: AvisoDelMenu; className?: string }) {
  return (
    <div
      className={`dashboard-sidebar-callout rounded-r-lg border-l-4 border-brand-600 bg-brand-50 px-4 py-3.5 ${className}`}
    >
      <p className="text-[13px] leading-snug text-system-600">{aviso.texto}</p>
      {aviso.renglones && aviso.renglones.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {aviso.renglones.map((r) => (
            <li key={r.href + r.texto}>
              <Link href={r.href} className="line-clamp-2 text-[12.5px] font-semibold text-brand-800 hover:underline">
                {r.urgencia === "urgente" ? (
                  <span className="mr-1 rounded-pill bg-error-700 px-1.5 py-px align-[1px] text-[10px] font-bold text-white">
                    Urgente
                  </span>
                ) : null}
                {r.texto} →
              </Link>
            </li>
          ))}
        </ul>
      )}
      {aviso.enlace ? (
        <Link
          href={aviso.enlace.href}
          className="mt-2.5 inline-block text-[13px] font-bold text-brand-800 underline-offset-2 hover:underline"
        >
          {aviso.enlace.etiqueta} →
        </Link>
      ) : aviso.cierre ? (
        <p className="mt-2 text-[13px] font-semibold text-brand-800">{aviso.cierre}</p>
      ) : null}
    </div>
  );
}
