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
    <header className="dashboard-topbar flex flex-wrap items-center justify-between gap-3 border-b border-system-200 bg-white px-4 py-3 sm:px-6">
      <Link href="/sistema" className="flex shrink-0 items-center">
        <Logo />
      </Link>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <span className="inline-flex text-system-600" aria-hidden="true">
          <IconoCampana className="h-4 w-4" />
        </span>

        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold tracking-tight text-white"
          >
            {iniciales}
          </span>
          <span className="hidden sm:block">
            <span className="block text-[13px] font-semibold leading-tight text-system-900">
              {identificador}
            </span>
            <span className="block text-[11px] text-system-400">Sesión raíz</span>
          </span>
        </span>
      </div>
    </header>
  );
}
