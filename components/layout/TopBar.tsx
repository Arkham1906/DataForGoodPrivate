// Barra superior de la zona de usuario: logo, notificaciones y avatar (EnlaceAlPerfil, que
// no aparece en /cuenta y anima su paso al encabezado del perfil).

import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import EnlaceAlPerfil from "./EnlaceAlPerfil";
import Logo from "./Logo";
import NotificationsBell from "./NotificationsBell";

export default function TopBar({ usuario }: { usuario: SessionUser }) {
  return (
    <header className="dashboard-user-topbar dashboard-topbar flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 sm:px-6">
      <Link href="/campanas" className="flex shrink-0 items-center">
        <Logo />
      </Link>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
        <NotificationsBell />
        <div className="flex items-center gap-2.5">
          <EnlaceAlPerfil
            iniciales={(usuario.nombre ?? "")
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)}
            nombre={`${usuario.nombre ?? ""} ${usuario.apellidos ?? ""}`.trim()}
          />
        </div>
      </div>
    </header>
  );
}
