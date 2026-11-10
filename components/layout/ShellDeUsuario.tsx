// Estructura de la zona de usuario con sesión: TopBar + SidebarNav + VigilanteDeSesion +
// ActualizacionEnVivo + DetectorDeUbicacion (zona por GPS) + <main id="contenido">. La usan el layout de (dashboard) y las pantallas
// públicas que, si hay sesión, deben verse igual que el resto de la app (hoy ninguna: /leaderboard pasó a /progreso/leaderboard el 2026-11-09).
// Server Component: no valida la sesión, recibe el usuario ya validado por quien lo llama.

import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/session";
import TopBar from "@/components/layout/TopBar";
import SidebarNav from "@/components/layout/SidebarNav";
import VigilanteDeSesion from "@/components/layout/VigilanteDeSesion";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import DetectorDeUbicacion from "@/components/layout/DetectorDeUbicacion";

export default function ShellDeUsuario({ usuario, children }: { usuario: SessionUser; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-system-50">
      <VigilanteDeSesion />
      <ActualizacionEnVivo />
      <DetectorDeUbicacion />
      <TopBar usuario={usuario} />
      <div className="dashboard-shell flex min-w-0">
        <SidebarNav usuario={usuario} />
        <main id="contenido" className="min-w-0 flex-1">
          <div className="dashboard-content mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
