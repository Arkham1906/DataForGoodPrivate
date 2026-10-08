// Pantalla /usuarios/supervisores/[id]: historial de dictámenes de un supervisor.
// Server Component. Datos: obtenerActividad() de lib/usuarios/supervisores.ts.

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
import {
  ETIQUETA_DE_ACCION,
  ETIQUETA_DE_ESTADO_DE_CAMPANA,
  formatearFechaHoraSup,
  formatearFechaSup,
  obtenerActividad,
} from "@/lib/usuarios/supervisores";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const s = await obtenerActividad(id);
  return { title: s ? `Actividad de ${s.nombre}` : "Actividad" };
}

export default async function ActividadDeSupervisorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await obtenerActividad(id);
  if (!s) notFound();

  const mitad = Math.ceil(s.campanas.length / 2);
  const columnas = [s.campanas.slice(0, mitad), s.campanas.slice(mitad)];

  return (
    <div>
      <Volver href="/usuarios/supervisores">Volver a supervisores</Volver>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">Actividad de {s.nombre}</h1>
          <p className="mt-1 text-[13px] text-system-600">
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
      {s.campanas.length === 0 && (
        <p className="mb-6 text-[13px] text-system-600">Todavía no ha tomado ninguna campaña.</p>
      )}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {columnas.map((col, i) => (
          <ListaClaveValor
            key={i}
            filas={col.map((c) => {
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
        ))}
      </div>

      <TituloDeSeccion>Historial de decisiones</TituloDeSeccion>
      {s.acciones.length === 0 ? (
        <p className="text-[13px] text-system-600">Todavía no tiene acciones registradas.</p>
      ) : (
      <div className="overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm">
        <table className="w-full min-w-[720px] text-left text-[13.5px]">
          <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
            <tr>
              <th className="pb-3 font-medium">Acción</th>
              <th className="pb-3 font-medium">Sobre</th>
              <th className="pb-3 font-medium">Motivo registrado</th>
              <th className="pb-3 font-medium">Cuándo</th>
              <th className="pb-3 text-right font-medium">Revertir</th>
            </tr>
          </thead>
          <tbody>
            {s.acciones.map((a) => {
              const et = ETIQUETA_DE_ACCION[a.tipo];
              return (
                <tr key={a.id} className="border-b border-system-200 last:border-0">
                  <td className="py-4">
                    <Tag tone={et.tono}>{et.texto}</Tag>
                  </td>
                  <td className="text-system-600">
                    {a.campanaId ? (
                      <Link href={`/sistema/campanas/${a.campanaId}`} className="hover:text-brand-600">
                        {a.sobre}
                      </Link>
                    ) : (
                      a.sobre
                    )}
                  </td>
                  <td className="text-system-600">{a.motivo}</td>
                  <td className="font-mono text-[11px] text-system-500">
                    {formatearFechaHoraSup(a.ejecutadaEn)}
                  </td>
                  <td className="text-right">
                    {a.revertidaEn ? (
                      <span className="text-[12.5px] text-system-600">
                        Revertida el {formatearFechaSup(a.revertidaEn)}
                      </span>
                    ) : a.reversible ? (
                      <EnlaceBoton href={`/usuarios/supervisores/${s.id}/revertir/${a.id}`}>
                        Revertir<span className="sr-only"> la acción sobre {a.sobre}</span>
                      </EnlaceBoton>
                    ) : (
                      // Reglas en puedeRevertirse (lib/usuarios/supervisores.ts).
                      <span className="text-[12.5px] text-system-500">{a.noReversiblePorque}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      <p className="sr-only">{formatearNumero(s.acciones.length)} decisiones registradas.</p>

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
