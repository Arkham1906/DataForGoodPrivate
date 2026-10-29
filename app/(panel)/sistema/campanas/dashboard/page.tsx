// Pantalla /sistema/campanas/dashboard: gráficas de campañas.
// Server Component. Datos: obtenerDashboardDeCampanas() de lib/campanas/sistema.ts.

import type { Metadata } from "next";

import MetricCard from "@/components/sistema/MetricCard";
import ProgressBar from "@/components/sistema/ProgressBar";
import Subtabs from "@/components/sistema/subtabs";
import Tag from "@/components/sistema/Tag";
import {
  Encabezado,
  EnlaceBoton,
  ListaClaveValor,
  Reparto,
  TituloDeSeccion,
  formatearNumero,
} from "@/components/sistema/ui";
import {
  ETIQUETA_DE_CAMPANA,
  NOMBRE_DE_TIPO,
  ORDEN_DE_ESTADOS,
  PESTANAS_CAMPANAS,
  obtenerDashboardDeCampanas,
  porcentajeDeMeta,
} from "@/lib/campanas/sistema";
import { exigirSesionRoot } from "@/lib/supervision/root";

export const metadata: Metadata = { title: "Dashboard de campañas" };
export const dynamic = "force-dynamic";

const corte = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function DashboardDeCampanasPage() {
  await exigirSesionRoot();
  const d = await obtenerDashboardDeCampanas();
  const v = d.vigencia;

  return (
    <div>
      <Subtabs
        pestanas={PESTANAS_CAMPANAS}
        etiquetaAria="Secciones de campañas"
        distribuidasEnMovil
      />

      <Encabezado
        titulo="Campañas"
        subtitulo={`${formatearNumero(d.registradas)} registradas · ${formatearNumero(d.activas)} activas · corte al ${corte.format(d.cortadoEn)}`}
        subtituloMono
        acciones={<EnlaceBoton href="/sistema/campanas">Ver lista</EnlaceBoton>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Activas" value={formatearNumero(d.activas)} />
        <MetricCard label="Participantes únicos" value={formatearNumero(d.participantesUnicos)} />
        <MetricCard label="Aportes recibidos" value={formatearNumero(d.aportesRecibidos)} />
        <MetricCard label="Avance medio de meta" value={`${d.avanceMedio}%`} />
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <section>
          <TituloDeSeccion>Por temática · activas</TituloDeSeccion>
          {d.porTematica.length === 0 ? (
            <p className="text-[12.5px] text-system-600">No hay campañas activas.</p>
          ) : (
            <Reparto filas={d.porTematica} anchoEtiqueta={130} anchoValor={30} />
          )}
        </section>

        <section>
          <TituloDeSeccion>Por tipo de dato solicitado · activas</TituloDeSeccion>
          {d.porTipoDeDato.length === 0 ? (
            <p className="text-[12.5px] text-system-600">No hay campañas activas.</p>
          ) : (
            <>
              <Reparto filas={d.porTipoDeDato} anchoEtiqueta={96} anchoValor={30} />
              <p className="mt-2.5 text-[12px] text-system-500">
                Una campaña puede pedir varios tipos de dato, por eso la suma puede superar el total de campañas.
              </p>
            </>
          )}
        </section>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <section>
          <TituloDeSeccion>Por estado</TituloDeSeccion>
          <ListaClaveValor
            filas={ORDEN_DE_ESTADOS.map((e) => {
              const et = ETIQUETA_DE_CAMPANA[e];
              return { clave: <Tag tone={et.tono}>{et.texto}</Tag>, valor: formatearNumero(d.porEstado[e]) };
            })}
          />
        </section>

        <section>
          <TituloDeSeccion>Tiempo restante de las activas</TituloDeSeccion>
          <ListaClaveValor
            filas={[
              { clave: "Vencen en menos de 7 días", valor: formatearNumero(v.menosDe7) },
              { clave: "Entre 7 y 30 días", valor: formatearNumero(v.entre7y30) },
              { clave: "Más de 30 días", valor: formatearNumero(v.masDe30) },
              ...(v.sinFecha > 0 ? [{ clave: "Sin fecha de cierre", valor: formatearNumero(v.sinFecha) }] : []),
              {
                clave: "Duración media configurada",
                valor: v.duracionMediaEnDias === null ? "—" : `${v.duracionMediaEnDias} días`,
              },
              {
                clave: "Antigüedad media de las activas",
                valor: v.antiguedadMediaEnDias === null ? "—" : `${v.antiguedadMediaEnDias} días`,
              },
            ]}
          />
        </section>
      </div>

      <TituloDeSeccion>Campañas activas con mayor participación</TituloDeSeccion>
      {d.masParticipacion.length === 0 ? (
        <p className="py-4 text-[13px] text-system-600">No hay campañas activas.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {d.masParticipacion.map((c) => {
              const pct = porcentajeDeMeta(c.aprobados, c.meta);
              return (
                <article key={c.id} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
                  <div className="min-w-0">
                    <p className="break-words text-[14px] font-bold leading-snug text-system-900">{c.nombre}</p>
                    <p className="mt-1 break-words text-[11px] text-system-500">
                      {c.tiposDeDato.map((t) => NOMBRE_DE_TIPO[t]).join(" · ") || "—"}
                    </p>
                  </div>

                  <p className="mt-3 break-words border-t border-system-200 pt-3 text-[12px] text-system-600">
                    {c.tematica || "Sin temática"}
                  </p>

                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[11px] text-system-600">Participantes</dt>
                      <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-system-900">
                        {formatearNumero(c.participantes)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-system-600">Aportes</dt>
                      <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-system-900">
                        {formatearNumero(c.aportes)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-system-600">
                      <span>Avance de meta</span>
                      <span className="font-mono tabular-nums">
                        {formatearNumero(c.aprobados)}/{formatearNumero(c.meta)}
                      </span>
                    </div>
                    <ProgressBar pct={pct} tone="ok" />
                  </div>

                  <div className="mt-3 grid">
                    <EnlaceBoton href={`/sistema/campanas/${c.id}`}>
                      Ver campaña<span className="sr-only"> {c.nombre}</span>
                    </EnlaceBoton>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm md:block">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
              <tr>
                <th className="pb-3 font-medium">Campaña</th>
                <th className="pb-3 font-medium">Temática</th>
                <th className="pb-3 text-right font-medium">Participantes</th>
                <th className="pb-3 text-right font-medium">Aportes</th>
                <th className="pb-3 pl-4 font-medium">Avance</th>
                <th className="pb-3 text-right font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {d.masParticipacion.map((c) => {
                const pct = porcentajeDeMeta(c.aprobados, c.meta);
                return (
                  <tr key={c.id} className="border-b border-system-200 last:border-0">
                    <td className="py-4 pr-3">
                      <p className="font-bold text-system-900">{c.nombre}</p>
                      <p className="text-[12px] text-system-500">{c.tiposDeDato.map((t) => NOMBRE_DE_TIPO[t]).join(" · ") || "—"}</p>
                    </td>
                    <td className="text-[12.5px] text-system-600">{c.tematica || "Sin temática"}</td>
                    <td className="text-right font-mono tabular-nums">{formatearNumero(c.participantes)}</td>
                    <td className="text-right font-mono tabular-nums">{formatearNumero(c.aportes)}</td>
                    <td className="w-44 pl-4">
                      <ProgressBar pct={pct} tone="ok" />
                      <span className="font-mono text-[11px] text-system-500">
                        {formatearNumero(c.aprobados)}/{formatearNumero(c.meta)}
                      </span>
                    </td>
                    <td className="text-right">
                      <EnlaceBoton href={`/sistema/campanas/${c.id}`}>
                        Ver<span className="sr-only"> el panel de {c.nombre}</span>
                      </EnlaceBoton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
