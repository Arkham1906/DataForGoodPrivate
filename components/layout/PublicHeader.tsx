// Encabezado de las pantallas públicas (landing, /explorar, /datos...).
// `variante="portada"` (landing, 2026-11-06): fijo arriba también en escritorio, contenido al ancho de la
// página, menú junto al logo y "Registrarse" como botón principal.

import Link from "next/link";
import ButtonLink from "@/components/ui/ButtonLink";
import Logo from "@/components/layout/Logo";

export default function PublicHeader({
  mostrarInicio = true,
  variante = "normal",
}: {
  mostrarInicio?: boolean;
  variante?: "normal" | "portada";
}) {
  const portada = variante === "portada";
  return (
    <header className={`public-header border-b border-system-200 ${portada ? "sticky top-0 z-50 !bg-white" : ""}`}>
      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 ${
          portada ? "mx-auto max-w-[1180px] py-3" : "py-4"
        }`}
      >
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>
        <nav
          aria-label="Navegación principal"
          className={`order-3 flex w-full min-w-0 items-center justify-center gap-5 overflow-x-auto whitespace-nowrap text-[13px] text-system-600 md:order-none md:w-auto md:justify-start md:gap-8 md:overflow-visible md:whitespace-normal md:text-sm ${
            portada ? "md:ml-4 md:mr-auto" : ""
          }`}
        >
          {mostrarInicio && (
            <Link href="/" className="hover:text-system-900">
              Inicio
            </Link>
          )}
          <Link href="/explorar" className="hover:text-system-900">
            Campañas
          </Link>
          <Link href="/datos" className="hover:text-system-900">
            Datos abiertos
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <ButtonLink href="/entrar" variant={portada ? "ghost" : "primary"} size="sm">
            Iniciar sesión
          </ButtonLink>
          <ButtonLink href="/registro" variant={portada ? "primary" : "secondary"} size="sm">
            Registrarse
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
