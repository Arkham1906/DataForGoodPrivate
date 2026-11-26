// Pantalla /usuarios/supervisores: lista de supervisores y resumen de su actividad.
// Server Component. Datos: lib/usuarios/supervisores.ts. Búsqueda en buscador.tsx.

import type { Metadata } from "next";
import { Suspense } from "react";

import Subtabs from "@/components/sistema/subtabs";
import { Encabezado, EnlaceBoton, formatearNumero } from "@/components/sistema/ui";
import MetricCard from "@/components/sistema/MetricCard";
import { ListaDeRenglones, Renglon } from "@/components/sistema/Renglones";
import Tag from "@/components/sistema/Tag";
import { PESTANAS_USUARIOS } from "@/lib/usuarios/dashboard";
import {
  formatearFechaHoraSup,
  formatearFechaSup,
  listarSupervisores,
  obtenerResumenDeSupervisores,
} from "@/lib/usuarios/supervisores";
import BuscadorDeSupervisores from "./buscador";
import { exigirSesionRoot } from "@/lib/supervision/root";

export const metadata: Metadata = { title: "Supervisores" };
export const dynamic = "force-dynamic";

export default async function SupervisoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await exigirSesionRoot();
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
        descripcion="Las personas con el rol de Supervisor y lo que han hecho: campañas que dictaminaron, reportes y sanciones."
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
                    {s.conRol ? `Supervisor desde ${formatearFechaSup(s.desde)}` : "Ya no tiene el rol"}
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
                    <dt className="text-[11px] text-system-600">Dictámenes</dt>
                    <dd className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-system-900">
                      {formatearNumero(s.dictamenes)}
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

          {/* Escritorio: renglones como la vista de lista de Mis aportes (2026-11-25); toda la tarjeta abre su actividad. */}
          <ListaDeRenglones etiqueta="Supervisores" soloEscritorio>
            {supervisores.map((s) => (
              <Renglon
                key={s.id}
                href={`/usuarios/supervisores/${s.id}`}
                titulo={s.nombre}
                detalles={[
                  // Sin fecha de alta (rol dado fuera del panel), solo "Supervisor": "desde sin registrar" no se lee bien.
                  s.conRol ? (s.desde ? `Supervisor desde ${formatearFechaSup(s.desde)}` : "Supervisor") : null,
                  `${formatearNumero(s.campanasACargo)} ${s.campanasACargo === 1 ? "campaña" : "campañas"} a su cargo`,
                  `${formatearNumero(s.dictamenes)} ${s.dictamenes === 1 ? "dictamen" : "dictámenes"}`,
                  `${formatearNumero(s.accionesEnRango)} ${s.accionesEnRango === 1 ? "acción" : "acciones"} en 30 días`,
                  `Última actividad: ${formatearFechaHoraSup(s.ultimaActividad)}`,
                ]}
                lateral={s.conRol ? null : <Tag tone="warn">Ya no tiene el rol</Tag>}
              />
            ))}
          </ListaDeRenglones>
        </>
      )}
    </div>
  );
}
