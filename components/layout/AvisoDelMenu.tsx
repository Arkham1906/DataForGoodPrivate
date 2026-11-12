// Recuadro azul al pie de los menús laterales (2026-11-10, a pedido del usuario): antes era una frase fija.
// Lo usan components/layout/SidebarNav (zona de usuario: "tu siguiente paso", lib/usuarios/aviso-del-menu.ts) y
// components/sistema/Sidebar (panel: pendientes del SuperUsuario, lib/sistema/aviso-del-menu.ts). Solo pinta lo
// que le llega; sin imports de servidor, así lo pueden usar componentes cliente. En móvil no se ve
// (.dashboard-sidebar-callout en globals.css): nada de lo que muestra puede depender solo de él.

import Link from "next/link";

export type AvisoDelMenu = {
  /** Frase principal. */
  texto: string;
  /** Un pendiente por renglón, cada uno con su enlace (panel del SuperUsuario). */
  renglones?: { texto: string; href: string }[];
  /** Acción del aviso; sin ella, la frase va con `cierre` (la de siempre). */
  enlace?: { href: string; etiqueta: string };
  /** Remate en negritas sin enlace ("¡Súmate!", "Gracias por moderar"). */
  cierre?: string;
};

export default function AvisoDelMenu({ aviso, className = "" }: { aviso: AvisoDelMenu; className?: string }) {
  return (
    <div
      className={`dashboard-sidebar-callout rounded-r-lg border-l-4 border-brand-600 bg-brand-50 px-4 py-3.5 ${className}`}
    >
      <p className="text-[13px] leading-snug text-system-600">{aviso.texto}</p>
      {aviso.renglones && aviso.renglones.length > 0 && (
        <ul className="mt-2 space-y-1">
          {aviso.renglones.map((r) => (
            <li key={r.href + r.texto}>
              <Link href={r.href} className="text-[12.5px] font-semibold text-brand-800 hover:underline">
                {r.texto} →
              </Link>
            </li>
          ))}
        </ul>
      )}
      {aviso.enlace ? (
        <Link href={aviso.enlace.href} className="mt-2 inline-block text-[13px] font-semibold text-brand-800 hover:underline">
          {aviso.enlace.etiqueta} →
        </Link>
      ) : aviso.cierre ? (
        <p className="mt-2 text-[13px] font-semibold text-brand-800">{aviso.cierre}</p>
      ) : null}
    </div>
  );
}
