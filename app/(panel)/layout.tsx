// Layout del panel del SuperUsuario: Topbar + Sidebar de components/sistema.
// ActualizacionEnVivo vuelve a leer las pantallas cuando cambia algo en la base (lib/en-vivo.ts).
// Guardia: hasRootSession() (cookie root_session_token); sin sesión raíz → /root.
// Ojo: /sistema y /usuarios/** dependen solo de este layout (docs/README.md § 8).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import Sidebar from "@/components/sistema/Sidebar";
import Topbar from "@/components/sistema/Topbar";
import { hasRootSession } from "@/lib/rootSession";
import { contarReportesPendientes } from "@/lib/reportes/reportes";
import { contarTematicasPendientes } from "@/lib/tematicas/catalogo";
import { tituloDeSeccion } from "@/lib/titulo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: tituloDeSeccion("Panel"),
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const sesionValida = await hasRootSession();

  if (!sesionValida) {
    redirect("/root");
  }
  const [{ reportes }, tematicas] = await Promise.all([contarReportesPendientes(), contarTematicasPendientes()]);

  return (
    <div className="min-h-screen bg-system-50">
      <ActualizacionEnVivo />
      <Topbar identificador={process.env.ROOT_USER_ID ?? "raíz"} />
      <div className="dashboard-shell flex">
        <Sidebar reportesPendientes={reportes} tematicasPendientes={tematicas} />
        <main id="contenido" className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
