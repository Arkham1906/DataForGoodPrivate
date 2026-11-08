"use client";

// Barra superior del panel del SuperUsuario.

import Link from "next/link";
import Logo from "@/components/layout/Logo";
import { IconoCampana } from "./icons";

type TopbarProps = {
  /** Valor configurado en ROOT_USER_ID. La sesión raíz no es una persona con nombre propio. */
  identificador: string;
};

export default function Topbar({ identificador }: TopbarProps) {
  const iniciales = identificador.slice(0, 2).toUpperCase();

  return (
    <header className="dashboard-root-topbar dashboard-topbar flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-system-200 bg-white px-4 py-3 sm:px-6">
      <Link href="/sistema" className="flex shrink-0 items-center">
        <Logo />
      </Link>

      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
        <span className="inline-flex text-system-600" aria-hidden="true">
          <IconoCampana className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold tracking-tight text-white"
          >
            {iniciales}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[min(28vw,16rem)] truncate text-[13px] font-semibold leading-tight text-system-900" title={identificador}>
              {identificador}
            </span>
            <span className="block text-[11px] text-system-500">Sesión raíz</span>
          </span>
        </span>
      </div>
    </header>
  );
}
