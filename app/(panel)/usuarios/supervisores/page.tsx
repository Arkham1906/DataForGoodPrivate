// Pantalla /usuarios/supervisores: lista de supervisores y resumen de su actividad.
// Server Component. Datos: lib/usuarios/supervisores.ts. Búsqueda en buscador.tsx.

import type { Metadata } from "next";
import { Suspense } from "react";

import Subtabs from "@/components/sistema/subtabs";
import { Encabezado, EnlaceBoton, formatearNumero } from "@/components/sistema/ui";
import MetricCard from "@/components/sistema/MetricCard";
import { PESTANAS_USUARIOS } from "@/lib/usuarios/dashboard";
import {
  formatearFechaHoraSup,
  formatearFechaSup,
  listarSupervisores,
  obtenerResumenDeSupervisores,
} from "@/lib/usuarios/supervisores";
import BuscadorDeSupervisores from "./buscador";

export const metadata: Metadata = { title: "Supervisores" };
export const dynamic = "force-dynamic";

export default async function SupervisoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [resumen, supervisores] = await Promise.all([
    obtenerResumenDeSupervisores(),
    listarSupervisores(q),
  ]);

  return (
    <div>
      <Subtabs
        pestanas={PESTANAS_USUARIOS}
        etiquetaAria="Secciones de usuarios"
        volverAlMenuEnMovil
      />

      <Encabezado
        titulo="Supervisores"
        subtitulo={`${resumen.conRolActivo} con el rol activo · ${resumen.accionesEjecutadas} acciones en los últimos 30 días`}
        acciones={
          <Suspense fallback={null}>
            <BuscadorDeSupervisores q={q ?? ""} />
          </Suspense>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <div className="max-md:text-center">
          <MetricCard label="Con rol activo" value={formatearNumero(resumen.conRolActivo)} />
        </div>
        <div className="max-md:text-center">
          <MetricCard label="Campañas a su cargo" value={formatearNumero(resumen.campanasACargo)} />
        </div>
        <div className="max-md:text-center">
          <MetricCard label="Acciones ejecutadas" value={formatearNumero(resumen.accionesEjecutadas)} />
        </div>
        <div className="max-md:text-center">
          <MetricCard label="Acciones revertidas" value={formatearNumero(resumen.accionesRevertidas)} />
        </div>
      </div>

      {supervisores.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">Ningún supervisor coincide con la búsqueda.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {supervisores.map((s) => (
              <article key={s.id} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
                <div className="min-w-0">
                  <p className="break-words text-[14px] font-bold leading-snug text-system-900">{s.nombre}</p>
                  <p className="mt-1 text-[11px] text-system-500">
                    Supervisor desde {formatearFechaSup(s.desde)}
                  </p>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-system-200 pt-3">
                  <div>
                    <dt className="text-[11px] text-system-600">Campañas</dt>
                    <dd className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-system-900">
                      {formatearNumero(s.campanasACargo)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-system-600">Aportes validados</dt>
                    <dd className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-system-900">
                      {formatearNumero(s.aportesValidados)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-system-600">Acciones (30 días)</dt>
                    <dd className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-system-900">
                      {formatearNumero(s.accionesEnRango)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] text-system-600">Última actividad</dt>
                    <dd className="mt-0.5 break-words text-[12px] leading-snug text-system-900">
                      {formatearFechaHoraSup(s.ultimaActividad)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 grid">
                  <EnlaceBoton href={`/usuarios/supervisores/${s.id}`}>
                    Ver actividad<span className="sr-only"> de {s.nombre}</span>
                  </EnlaceBoton>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm md:block">
            <table className="w-full min-w-[720px] text-left text-[13.5px]">
              <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
                <tr>
                  <th className="pb-3 font-medium">Supervisor</th>
                  <th className="pb-3 font-medium">Campañas</th>
                  <th className="pb-3 font-medium">Aportes validados</th>
                  <th className="pb-3 font-medium">Acciones</th>
                  <th className="pb-3 font-medium">Última actividad</th>
                  <th className="pb-3 text-right font-medium">Actividad</th>
                </tr>
              </thead>
              <tbody>
                {supervisores.map((s) => (
                  <tr key={s.id} className="border-b border-system-200 last:border-0">
                    <td className="py-4">
                      <p className="font-bold text-system-900">{s.nombre}</p>
                      <p className="font-mono text-[11px] text-system-500">
                        Supervisor desde {formatearFechaSup(s.desde)}
                      </p>
                    </td>
                    <td className="font-mono tabular-nums">{s.campanasACargo}</td>
                    <td className="font-mono tabular-nums">{formatearNumero(s.aportesValidados)}</td>
                    <td className="font-mono tabular-nums">{s.accionesEnRango}</td>
                    <td className="font-mono text-[11px] text-system-500">
                      {formatearFechaHoraSup(s.ultimaActividad)}
                    </td>
                    <td className="text-right">
                      <EnlaceBoton href={`/usuarios/supervisores/${s.id}`}>
                        Ver<span className="sr-only"> la actividad de {s.nombre}</span>
                      </EnlaceBoton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
