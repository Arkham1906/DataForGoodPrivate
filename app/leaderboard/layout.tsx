// Layout de /leaderboard (pública). El marco cambia según la sesión:
// - Con sesión: el mismo marco que la zona de usuario (TopBar + SidebarNav), como en /cuenta.
// - Sin sesión: PublicHeader + PublicFooter, igual que el resto de las pantallas públicas.
// Aquí NO se redirige: la tabla de líderes es pública. getSessionUser() devuelve null si no hay
// sesión o si la cuenta está sancionada (esa persona la ve como visitante).
// Está en caché por petición (React cache), así que la página lo vuelve a llamar sin otra consulta.

import type { ReactNode } from "react";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import ShellDeUsuario from "@/components/layout/ShellDeUsuario";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LeaderboardLayout({ children }: { children: ReactNode }) {
  const usuario = await getSessionUser().catch(() => null);

  if (usuario) {
    return <ShellDeUsuario usuario={usuario}>{children}</ShellDeUsuario>;
  }

  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />
      <main id="contenido" className="px-6 pb-24 pt-14">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
