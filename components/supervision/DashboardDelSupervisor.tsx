// Dashboard del supervisor (2026-11-13, a pedido del usuario), arriba de la lista de /supervision.
// Server Component: recibe lo que arma obtenerDashboardDelSupervisor() (lib/supervision/dashboard.ts).
// - Cuatro cifras: por dictaminar (con la espera más larga), dictámenes de hoy (y en 7 días), tasa de aceptación
//   y mediana del envío a revisión al dictamen en 30 días.
// - Tus dictámenes por día, semana, mes o año del periodo elegido (ui/GraficaDeTiempo y ui/SelectorDePeriodo,
//   2026-11-22; este mes por defecto) y "Motivos de tus
//   rechazos" (una sola serie, sin leyenda).
// - "Esperan tu dictamen": las que más llevan en revisión, con "Revisar" a su ficha, y "Campañas que supervisas"
//   (cuántas por estado y lo que espera algo de ti: reportes, datos abiertos por decidir, pausadas ya ajustadas).
// Se actualiza solo: ActualizacionEnVivo refresca la página del servidor cuando cambia algo.

import Link from "next/link";
import MetricCard from "@/components/ui/MetricCard";
import Panel from "@/components/ui/PanelDeDashboard";
import Tag from "@/components/ui/Tag";
import { Suspense } from "react";
import GraficaDeTiempo from "@/components/ui/GraficaDeTiempo";
import SelectorDePeriodo from "@/components/ui/SelectorDePeriodo";
import { duracion, esperaDesde } from "@/lib/duracion";
import type { DashboardDelSupervisor as Datos } from "@/lib/supervision/dashboard";
import { NOMBRE_DE_UNIDAD, textoDelPeriodo, type Periodo } from "@/lib/periodo";

const nf = new Intl.NumberFormat("es-MX");

const CLASE_DE_ENLACE =
  "shrink-0 rounded-pill border border-system-300 px-3.5 py-1.5 text-[13px] font-semibold text-brand-700 transition-colors hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

function plural(n: number, uno: string, varios: string) {
  return `${nf.format(n)} ${n === 1 ? uno : varios}`;
}

export default function DashboardDelSupervisor({ datos, periodo }: { datos: Datos; periodo: Periodo }) {
  // eslint-disable-next-line react-hooks/purity -- Server Component: la espera se calcula al armar la página.
  const ahora = Date.now();
  const dictaminadas = datos.aceptadas + datos.rechazadas;
  const tasa = dictaminadas > 0 ? Math.round((datos.aceptadas / dictaminadas) * 100) : null;
  const totalDeMotivos = datos.motivos.reduce((suma, m) => suma + m.total, 0);
  const maxMotivo = Math.max(1, ...datos.motivos.map((m) => m.total));
  const estados = [
    { etiqueta: "Activas", total: datos.supervisadas.activas },
    { etiqueta: "Programadas", total: datos.supervisadas.programadas },
    { etiqueta: "Pausadas", total: datos.supervisadas.pausadas },
    { etiqueta: "Finalizadas", total: datos.supervisadas.finalizadas },
  ];
  const nadaPorResolver = datos.reportes === 0 && datos.porResolver.length === 0;

  return (
    <section aria-labelledby="resumen-del-supervisor" className="mb-8">
      <h2 id="resumen-del-supervisor" className="sr-only">
        Tu resumen como supervisor
      </h2>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Por dictaminar"
          value={nf.format(datos.porDictaminar)}
          detalle={
            datos.esperaMasLarga
              ? `La más antigua espera desde hace ${esperaDesde(datos.esperaMasLarga, ahora)}`
              : datos.porDictaminar > 0
                ? "Esperando tu dictamen"
                : "Todo al día"
          }
        />
        <MetricCard
          label="Dictámenes de hoy"
          value={nf.format(datos.hoy)}
          detalle={`${nf.format(datos.semana)} en los últimos 7 días`}
        />
        <MetricCard
          label="Aceptas"
          value={tasa === null ? "—" : `${tasa}%`}
          detalle={
            dictaminadas > 0
              ? `${plural(datos.aceptadas, "aceptada", "aceptadas")} · ${plural(datos.rechazadas, "rechazada", "rechazadas")}`
              : "Aún no dictaminas ninguna campaña"
          }
        />
        <MetricCard
          label="Tiempo de dictamen"
          value={datos.medianaDeDictamen === null ? "—" : duracion(datos.medianaDeDictamen)}
          detalle="Mediana del envío a revisión a tu dictamen, últimos 30 días"
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel titulo={`Tus dictámenes ${NOMBRE_DE_UNIDAD[datos.actividad.unidad]} · ${textoDelPeriodo(periodo)}`}>
          <div className="mb-3">
            <Suspense fallback={null}>
              <SelectorDePeriodo periodo={periodo} defecto="mes" />
            </Suspense>
          </div>
          <GraficaDeTiempo
            serie={datos.actividad}
            series={[
              { nombre: "Aceptadas", color: "brand" },
              { nombre: "Rechazadas", color: "error" },
            ]}
            descripcion={`Tus dictámenes ${NOMBRE_DE_UNIDAD[datos.actividad.unidad]}, ${textoDelPeriodo(periodo)}`}
            vacio="Aún no dictaminas campañas en este periodo."
          />
        </Panel>

        <Panel titulo="Motivos de tus rechazos">
          {totalDeMotivos === 0 ? (
            <p className="rounded-lg bg-system-100 p-4 text-center text-[13px] text-system-600">
              Cuando rechaces campañas, aquí verás por qué motivos.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[13px] text-system-600">
                {plural(totalDeMotivos, "campaña rechazada", "campañas rechazadas")}
              </p>
              <ul className="space-y-2.5">
                {datos.motivos.map((m) => (
                  <li key={m.motivo} className="text-[12.5px]">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="min-w-0 text-system-700">{m.motivo}</span>
                      <span className="shrink-0 font-mono text-system-700">{nf.format(m.total)}</span>
                    </div>
                    <span className="block h-2.5 overflow-hidden rounded-full bg-system-100" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-brand-600"
                        style={{ width: `${Math.max(4, (m.total / maxMotivo) * 100)}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel titulo="Esperan tu dictamen">
          {datos.enEspera.length === 0 ? (
            <p className="text-[13px] text-system-600">No hay campañas en revisión esperándote.</p>
          ) : (
            <ul className="divide-y divide-system-200">
              {datos.enEspera.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-system-900">{c.nombre}</span>
                      {c.tuya ? <Tag tone="ok">La supervisas tú</Tag> : <Tag tone="warn">Disponible</Tag>}
                    </p>
                    <p className="text-[12px] text-system-500">
                      {c.creador}
                      {c.desde ? ` · en revisión desde hace ${esperaDesde(c.desde, ahora)}` : ""}
                    </p>
                  </div>
                  <Link href={`/supervision/${c.id}`} className={CLASE_DE_ENLACE}>
                    Revisar<span className="sr-only"> {c.nombre}</span> →
                  </Link>
                </li>
              ))}
              {datos.porDictaminar > datos.enEspera.length && (
                <li className="pt-2.5 text-[12px] text-system-500">
                  Y {nf.format(datos.porDictaminar - datos.enEspera.length)} más en &quot;Por supervisar&quot;, en la pestaña{" "}
                  <Link href="/supervision/campanas" className="font-semibold text-brand-700 underline">
                    Campañas
                  </Link>
                  .
                </li>
              )}
            </ul>
          )}
        </Panel>

        <Panel titulo="Campañas que supervisas">
          <dl className="grid grid-cols-2 gap-2">
            {estados.map((e) => (
              <div key={e.etiqueta} className="rounded-lg bg-system-100 px-3 py-2">
                <dt className="text-[12px] text-system-600">{e.etiqueta}</dt>
                <dd className="font-mono text-[18px] font-semibold text-system-900">{nf.format(e.total)}</dd>
              </div>
            ))}
          </dl>

          <h4 className="mb-2 mt-4 text-[13px] font-semibold text-system-900">Por resolver</h4>
          {nadaPorResolver ? (
            <p className="text-[13px] text-system-600">Nada pendiente: no hay reportes, datos abiertos ni reanudaciones esperándote.</p>
          ) : (
            <ul className="divide-y divide-system-200 text-[13px]">
              {datos.reportes > 0 && (
                <li className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <span className="min-w-0 text-system-700">{plural(datos.reportes, "reporte por resolver", "reportes por resolver")}</span>
                  <Link href="/supervision/reportes" className={CLASE_DE_ENLACE}>
                    Ver<span className="sr-only"> los reportes</span> →
                  </Link>
                </li>
              )}
              {datos.porResolver.map((p) => (
                <li key={`${p.tipo}-${p.id}`} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-system-900">{p.nombre}</p>
                    <p className="text-[12px] text-system-500">
                      {p.tipo === "datos" ? "Finalizó: decide si se publican sus datos" : "El creador ya la ajustó: puedes reanudarla"}
                    </p>
                  </div>
                  <Link href={`/supervision/${p.id}`} className={CLASE_DE_ENLACE}>
                    Abrir<span className="sr-only"> {p.nombre}</span> →
                  </Link>
                </li>
              ))}
              {datos.datosPorDecidir + datos.porReanudar > datos.porResolver.length && (
                <li className="pt-2 text-[12px] text-system-500">
                  Y {nf.format(datos.datosPorDecidir + datos.porReanudar - datos.porResolver.length)} más.
                </li>
              )}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}
