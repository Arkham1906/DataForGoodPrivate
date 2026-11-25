// Barra superior de la zona de usuario: logo, pendientes (BotonDePendientes, 2026-11-24, antes en el menú lateral),
// notificaciones y avatar (EnlaceAlPerfil, que no aparece en /cuenta y anima su paso al encabezado del perfil).

import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { datosDeAvatar } from "@/lib/usuarios/avatar-opciones";
import BotonDePendientes from "./BotonDePendientes";
import EnlaceAlPerfil from "./EnlaceAlPerfil";
import Logo from "./Logo";
import NotificationsBell from "./NotificationsBell";

export default function TopBar({ usuario, pendientes = 0 }: { usuario: SessionUser; /** lib/pendientes/del-usuario.ts */ pendientes?: number }) {
  return (
    <header className="dashboard-user-topbar dashboard-topbar flex flex-wrap items-center justify-between gap-4 border-b border-system-200 bg-white px-4 py-3 sm:px-6 max-md:flex-nowrap">
      <Link href="/inicio" className="flex shrink-0 items-center">
        <Logo />
      </Link>

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-1">
          <BotonDePendientes href="/pendientes" cantidad={pendientes} />
          <NotificationsBell />
        </div>
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
