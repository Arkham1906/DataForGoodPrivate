// Layout de la zona de usuario (dashboard): TopBar + SidebarNav + VigilanteDeSesion.
// Guardia: exigirUsuario() → sin sesión a /entrar, cuenta sancionada a /cuenta-bloqueada.
// No basta por sí solo: cada página y cada endpoint vuelven a verificar (ver docs/permisos.md).

import TopBar from "@/components/layout/TopBar";
import SidebarNav from "@/components/layout/SidebarNav";
import VigilanteDeSesion from "@/components/layout/VigilanteDeSesion";
import { exigirUsuario } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sin sesión va a /entrar; una cuenta suspendida o baneada, a /cuenta-bloqueada.
  const usuario = await exigirUsuario();

  return (
    <div className="min-h-screen bg-system-50">
      <VigilanteDeSesion />
      <TopBar usuario={usuario} />
      <div className="dashboard-shell flex">
        <SidebarNav usuario={usuario} />
        <main className="min-w-0 flex-1">
          <div className="dashboard-content mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
