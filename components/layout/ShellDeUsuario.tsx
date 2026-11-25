// Estructura de la zona de usuario con sesión: TopBar + SidebarNav + VigilanteDeSesion +
// ActualizacionEnVivo + DetectorDeUbicacion (zona por GPS) + Celebraciones (rango, medalla y racha, 2026-11-16) + <main id="contenido">. La usan el layout de (dashboard) y las pantallas
// públicas que, si hay sesión, deben verse igual que el resto de la app (hoy ninguna: /leaderboard pasó a /progreso/leaderboard el 2026-11-09).
// Server Component: no valida la sesión, recibe el usuario ya validado por quien lo llama.
// Calcula aquí el aviso del menú lateral ("tu siguiente paso", lib/usuarios/aviso-del-menu.ts, 2026-11-10): se
// vuelve a calcular con cada router.refresh de ActualizacionEnVivo.

import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/session";
import { avisoDelMenuParaUsuario } from "@/lib/usuarios/aviso-del-menu";
import TopBar from "@/components/layout/TopBar";
import SidebarNav from "@/components/layout/SidebarNav";
import VigilanteDeSesion from "@/components/layout/VigilanteDeSesion";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import DetectorDeUbicacion from "@/components/layout/DetectorDeUbicacion";
import Celebraciones from "@/components/gamificacion/celebraciones/Celebraciones";

export default async function ShellDeUsuario({ usuario, children }: { usuario: SessionUser; children: ReactNode }) {
  // Recuadro del menú y número del botón "Pendientes" de la barra superior (2026-11-24): la misma fuente que /pendientes.
  const { aviso, pendientes } = await avisoDelMenuParaUsuario(usuario);
  return (
    <div className="min-h-screen bg-system-50">
      <VigilanteDeSesion />
      <ActualizacionEnVivo />
      <DetectorDeUbicacion />
      <Celebraciones />
      <TopBar usuario={usuario} pendientes={pendientes} />
      <div className="dashboard-shell flex min-w-0">
        <SidebarNav usuario={usuario} aviso={aviso} />
        <main id="contenido" className="min-w-0 flex-1">
          <div className="dashboard-content mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
