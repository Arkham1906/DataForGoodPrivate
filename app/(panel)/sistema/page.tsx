// Pantalla /sistema: métricas generales del sistema (solo consulta).
// Server Component. Datos: lib/sistema/metricas.ts. Protegida solo por el layout del panel.

import type { Metadata } from "next";
import Link from "next/link";
import MetricCard from "@/components/sistema/MetricCard";
import { IconoCampanas } from "@/components/sistema/icons";
import { obtenerMetricasDelSistema } from "@/lib/sistema/metricas";

export const metadata: Metadata = { title: "Panel del sistema" };

export default async function PanelDelSistemaPage() {
  const m = await obtenerMetricasDelSistema();

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-extrabold text-system-900">Panel del sistema</h1>
        <p className="mt-1 font-mono text-[13px] text-system-600">
          Vista de solo lectura del estado global de la plataforma
        </p>
      </header>

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Usuarios registrados"
          value={m.usuariosRegistrados}
          centrado
          links={[
            { label: "Dashboard", href: "/usuarios/dashboard" },
            { label: "Lista", href: "/usuarios" },
          ]}
        />
        <MetricCard
          label="Campañas activas"
          value={m.campanasActivas}
          secundario={{ label: "Campañas finalizadas", value: m.campanasFinalizadas }}
          centrado
          links={[
            { label: "Dashboard", href: "/sistema/campanas/dashboard" },
            { label: "Lista", href: "/sistema/campanas" },
          ]}
        />
        <MetricCard
          label="Aportes recolectados"
          value={m.aportesRecolectados}
          centrado
          links={[
            { label: "Dashboard", href: "/aportes/dashboard" },
            { label: "Lista", href: "/aportes" },
          ]}
        />
      </div>

      {m.haySupervisores ? null : (
        <section className="mb-6 flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 p-5">
          <IconoCampanas className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning-800" />
          <div>
            <h2 className="mb-1 text-[14.5px] font-bold text-system-900">
              Ningún usuario tiene el rol de Supervisor
            </h2>
            <p className="mb-3 text-[13px] leading-relaxed text-system-600">
              Mientras no exista un supervisor, ninguna campaña puede pasar de
              «En revisión» a «Activa». Puedes promover al primero o validarlas
              tú mismo como respaldo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/usuarios"
                className="rounded-pill border border-system-300 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-system-900 transition-colors hover:border-system-400 hover:bg-system-100"
              >
                Asignar rol de Supervisor
              </Link>
              <Link
                href="/supervisar"
                className="rounded-pill border border-system-300 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-system-900 transition-colors hover:border-system-400 hover:bg-system-100"
              >
                Validar como respaldo
              </Link>
            </div>
          </div>
        </section>
      )}

      <p className="rounded-lg bg-system-100 p-4 text-[13px] leading-relaxed text-system-600">
        En modo SuperUsuario todo es de consulta: se revisa el estado global, se
        gestionan roles y se aplican sanciones. Para pausar, finalizar o eliminar
        una campaña hay que entrar en{" "}
        <b className="font-semibold text-system-900">Modo supervisor</b>.
      </p>
    </div>
  );
}
