// Pantalla /usuarios/supervisores/[id]: historial de dictámenes de un supervisor.
// Server Component. Datos: obtenerActividad() de lib/usuarios/supervisores.ts.
// Filtros (2026-11-22): campañas a su cargo con ?qc= y ?estado=; historial de decisiones con ?qd= y ?accion=.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  EnlaceBoton,
  ListaClaveValor,
  TituloDeSeccion,
  Volver,
  formatearNumero,
} from "@/components/sistema/ui";
import MetricCard from "@/components/sistema/MetricCard";
import Tag from "@/components/sistema/Tag";
import { ListaDeRenglones, Renglon } from "@/components/sistema/Renglones";
import {
  ETIQUETA_DE_ACCION,
  ETIQUETA_DE_ESTADO_DE_CAMPANA,
  formatearFechaHoraSup,
  formatearFechaSup,
  obtenerActividad,
} from "@/lib/usuarios/supervisores";
import { exigirSesionRoot } from "@/lib/supervision/root";
import FiltrosEnLaUrl from "@/components/sistema/FiltrosEnLaUrl";
import { busquedaDeLaUrl, coincideConLaBusqueda, cuantosDeCuantos, opcionDeLaUrl } from "@/lib/filtros-en-la-url";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await exigirSesionRoot();
  const { id } = await params;
  const s = await obtenerActividad(id);
  return { title: s ? `Actividad de ${s.nombre}` : "Actividad" };
}

export default async function ActividadDeSupervisorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ qc?: string; estado?: string; qd?: string; accion?: string }>;
}) {
  await exigirSesionRoot();
  const { id } = await params;
  const s = await obtenerActividad(id);
  if (!s) notFound();

  const filtros = await searchParams;
  const qc = busquedaDeLaUrl(filtros.qc);
  const estado = opcionDeLaUrl(filtros.estado, Object.keys(ETIQUETA_DE_ESTADO_DE_CAMPANA) as (keyof typeof ETIQUETA_DE_ESTADO_DE_CAMPANA)[]);
  const campanas = s.campanas.filter((c) => (!estado || c.estado === estado) && coincideConLaBusqueda(qc, c.nombre, c.id));
  const qd = busquedaDeLaUrl(filtros.qd);
  const accion = opcionDeLaUrl(filtros.accion, Object.keys(ETIQUETA_DE_ACCION) as (keyof typeof ETIQUETA_DE_ACCION)[]);
  const acciones = s.acciones.filter(
    (a) => (!accion || a.tipo === accion) && coincideConLaBusqueda(qd, a.sobre, a.motivo, ETIQUETA_DE_ACCION[a.tipo].texto),
  );

  return (
    <div>
      <Volver href="/usuarios/supervisores">Volver a supervisores</Volver>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">Actividad de {s.nombre}</h1>
          <p className="mt-1 text-[13px] text-system-600">
            Las campañas a su cargo y el historial de sus decisiones. Desde aquí puedes revertir una decisión suya.
          </p>
          <p className="mt-1 text-[13px] text-system-500">
            <span className="font-mono">{s.correo}</span> ·{" "}
            {s.conRol ? `Supervisor desde ${formatearFechaSup(s.desde)}` : "Ya no tiene el rol de Supervisor"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EnlaceBoton href={`/usuarios/${s.id}`}>Ver ficha</EnlaceBoton>
          <EnlaceBoton href={`/usuarios/${s.id}/roles`}>Gestionar rol</EnlaceBoton>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Campañas a su cargo" value={formatearNumero(s.campanasACargo)} />
        <MetricCard label="Dictámenes" value={formatearNumero(s.dictamenes)} />
        <MetricCard label="Acciones (30 días)" value={formatearNumero(s.accionesEnRango)} />
        <MetricCard label="Revertidas" value={formatearNumero(s.revertidas)} />
      </div>

      <TituloDeSeccion>Campañas a su cargo</TituloDeSeccion>
      {s.campanas.length === 0 ? (
        <p className="mb-6 text-[13px] text-system-600">Todavía no ha tomado ninguna campaña.</p>
      ) : (
        <FiltrosEnLaUrl
          busqueda={{ clave: "qc", etiqueta: "Buscar campañas a su cargo", placeholder: "Buscar campaña" }}
          listas={[
            {
              clave: "estado",
              etiqueta: "Filtrar campañas por estado",
              todas: "Estado: todos",
              opciones: Object.entries(ETIQUETA_DE_ESTADO_DE_CAMPANA).map(([valor, e]) => ({ valor, etiqueta: e.texto })),
            },
          ]}
          className="mb-3"
        />
      )}
      {s.campanas.length > 0 && campanas.length === 0 && (
        <p className="mb-6 text-[13px] text-system-600">Ninguna campaña coincide con los filtros.</p>
      )}
      {campanas.length < s.campanas.length && campanas.length > 0 && (
        <p className="mb-2 text-[12.5px] text-system-500">{cuantosDeCuantos(campanas.length, s.campanas.length)} campañas</p>
      )}
      <div className="mb-6">
        <ListaClaveValor
          filas={campanas.map((c) => {
            const e = ETIQUETA_DE_ESTADO_DE_CAMPANA[c.estado];
            return {
              clave: (
                // La ficha del panel: /campanas/[id] es de la zona de usuario y pide otra sesión.
                <Link href={`/sistema/campanas/${c.id}`} className="hover:text-brand-600">
                  {c.nombre}
                </Link>
              ),
              valor: <Tag tone={e.tono}>{e.texto}</Tag>,
            };
          })}
        />
      </div>

      <TituloDeSeccion>Historial de decisiones</TituloDeSeccion>
      {s.acciones.length > 0 && (
        <FiltrosEnLaUrl
          busqueda={{ clave: "qd", etiqueta: "Buscar en el historial de decisiones", placeholder: "Buscar por campaña, persona o motivo" }}
          listas={[
            {
              clave: "accion",
              etiqueta: "Filtrar decisiones por acción",
              todas: "Acción: todas",
              opciones: Object.entries(ETIQUETA_DE_ACCION).map(([valor, e]) => ({ valor, etiqueta: e.texto })),
            },
          ]}
          className="mb-3"
        />
      )}
      {s.acciones.length === 0 ? (
        <p className="text-[13px] text-system-600">Todavía no tiene acciones registradas.</p>
      ) : acciones.length === 0 ? (
        <p className="text-[13px] text-system-600">Ninguna decisión coincide con los filtros.</p>
      ) : (
      // Renglones como la vista de lista de Mis aportes (2026-11-25). Sin tarjetas propias para el teléfono: se ven así
      // en todos los anchos.
      <ListaDeRenglones etiqueta="Historial de decisiones">
        {acciones.map((a) => {
          const et = ETIQUETA_DE_ACCION[a.tipo];
          return (
            <Renglon
              key={a.id}
              titulo={
                a.campanaId ? (
                  <Link href={`/sistema/campanas/${a.campanaId}`} className="hover:text-brand-600">
                    {a.sobre}
                  </Link>
                ) : (
                  a.sobre
                )
              }
              detalles={[
                a.motivo && a.motivo !== "—" ? a.motivo : null,
                formatearFechaHoraSup(a.ejecutadaEn),
                a.revertidaEn ? `Revertida el ${formatearFechaSup(a.revertidaEn)}` : null,
                // Reglas en puedeRevertirse (lib/usuarios/supervisores.ts).
                !a.revertidaEn && !a.reversible ? a.noReversiblePorque : null,
              ]}
              lateral={
                <>
                  <Tag tone={et.tono}>{et.texto}</Tag>
                  {!a.revertidaEn && a.reversible && (
                    <EnlaceBoton href={`/usuarios/supervisores/${s.id}/revertir/${a.id}`}>
                      Revertir<span className="sr-only"> la acción sobre {a.sobre}</span>
                    </EnlaceBoton>
                  )}
                </>
              }
            />
          );
        })}
      </ListaDeRenglones>
      )}

      <p className="sr-only">{cuantosDeCuantos(acciones.length, s.acciones.length)} decisiones registradas.</p>

      {/* Lo que dejó el SuperUsuario al revertir con "Registrar una observación en el expediente". */}
      {s.observaciones.length > 0 && (
        <>
          <div className="mt-6">
            <TituloDeSeccion>Observaciones en su expediente</TituloDeSeccion>
          </div>
          <ul className="space-y-3">
            {s.observaciones.map((o, i) => (
              <li key={i} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
                <p className="text-[13px] font-semibold text-system-900">
                  {o.causal}
                  {o.sobre ? <span className="font-normal text-system-600"> · {o.sobre}</span> : null}
                </p>
                <p className="mt-1 text-[13px] text-system-600">{o.descripcion}</p>
                <p className="mt-2 font-mono text-[11px] text-system-500">{formatearFechaHoraSup(o.fecha)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
