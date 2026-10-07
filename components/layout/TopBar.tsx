// Barra superior de la zona de usuario: logo, notificaciones y avatar.

import Link from "next/link";
import type { SessionUser } from "@/lib/session";
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
          <Link href="/cuenta" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">
              {(usuario.nombre ?? "")
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px] font-semibold text-ink">{`${usuario.nombre ?? ""} ${usuario.apellidos ?? ""}`.trim()}</p>
              <p className="text-[11.5px] text-ink-3">Ver perfil</p>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
