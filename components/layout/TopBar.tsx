// Barra superior de la zona de usuario: logo, notificaciones y avatar (EnlaceAlPerfil, que
// no aparece en /cuenta y anima su paso al encabezado del perfil).

import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { datosDeAvatar } from "@/lib/usuarios/avatar-opciones";
import EnlaceAlPerfil from "./EnlaceAlPerfil";
import Logo from "./Logo";
import NotificationsBell from "./NotificationsBell";

export default function TopBar({ usuario }: { usuario: SessionUser }) {
  return (
    <header className="dashboard-user-topbar dashboard-topbar flex flex-wrap items-center justify-between gap-4 border-b border-system-200 bg-white px-4 py-3 sm:px-6 max-md:flex-nowrap">
      <Link href="/inicio" className="flex shrink-0 items-center">
        <Logo />
      </Link>

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
        <NotificationsBell />
        <div className="min-w-0 flex items-center gap-2.5">
          <EnlaceAlPerfil
            avatar={datosDeAvatar({ ...usuario, nombre: usuario.nombre ?? "" })}
            nombre={`${usuario.nombre ?? ""} ${usuario.apellidos ?? ""}`.trim()}
          />
        </div>
      </div>
    </header>
  );
}
