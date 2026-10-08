// Encabezado de las pantallas públicas (landing, /explorar, /datos...).

import Link from "next/link";
import ButtonLink from "@/components/ui/ButtonLink";
import Logo from "@/components/layout/Logo";

export default function PublicHeader() {
  return (
    <header className="public-header flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-system-200 px-6 py-4">
      <Link href="/" className="flex items-center">
        <Logo />
      </Link>
      <nav
        aria-label="Navegación principal"
        className="order-3 flex w-full min-w-0 items-center justify-center gap-5 overflow-x-auto whitespace-nowrap text-[13px] text-system-600 md:order-none md:w-auto md:justify-start md:gap-8 md:overflow-visible md:whitespace-normal md:text-sm"
      >
        <Link href="/#como-funciona" className="hover:text-system-900">
          Cómo funciona
        </Link>
        <Link href="/explorar" className="hover:text-system-900">
          Campañas
        </Link>
        <Link href="/datos" className="hover:text-system-900">
          Datos abiertos
        </Link>
      </nav>
      <ButtonLink href="/entrar" variant="primary" size="sm">
        Iniciar sesión
      </ButtonLink>
    </header>
  );
}
