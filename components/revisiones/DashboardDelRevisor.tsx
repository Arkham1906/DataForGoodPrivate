// Dashboard del revisor (2026-11-13, a pedido del usuario), arriba de la lista de /revisiones ("En curso").
// Server Component: recibe lo que arma obtenerDashboardDelRevisor() (lib/revisiones/dashboard.ts).
// - Cuatro cifras: por revisar (con la espera más larga), revisados hoy (y en 7 días), tasa de aceptación y
//   mediana del tiempo de respuesta en 30 días.
// - Actividad: tus decisiones por día (GraficaDeDecisiones, cliente, con detalle al pasar el cursor).
// - Estrellas que das: cuántos aceptados calificaste con cada número de estrellas (una sola serie, sin leyenda).
// - Campañas con pendientes: las que más tienen, con la espera más larga y "Revisar" a su bandeja.
// Se actualiza solo: ActualizacionEnVivo refresca la página del servidor cuando cambia algo.

import Link from "next/link";
import MetricCard from "@/components/ui/MetricCard";
import GraficaDeDecisiones from "@/components/revisiones/GraficaDeDecisiones";
import { DIAS_DE_ACTIVIDAD, type DashboardDelRevisor as Datos } from "@/lib/revisiones/dashboard";

const nf = new Intl.NumberFormat("es-MX");
const decimal = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "35 min", "5 h", "3 días". */
function duracion(segundos: number): string {
  const minutos = Math.max(1, Math.round(segundos / 60));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.round(horas / 24);
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

function esperaDesde(iso: string, ahora: number): string {
  return duracion(Math.max(0, (ahora - new Date(iso).getTime()) / 1000));
}

function Panel({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-system-200 bg-white p-4 ${className}`} aria-label={titulo}>
      <h3 className="mb-3 text-[15px] font-bold text-system-900">{titulo}</h3>
      {children}
    </section>
  );
}

export default function DashboardDelRevisor({ datos }: { datos: Datos }) {
  // eslint-disable-next-line react-hooks/purity -- Server Component: la espera se calcula al armar la página.
  const ahora = Date.now();
  const decididos = datos.aceptados + datos.rechazados;
  const tasa = decididos > 0 ? Math.round((datos.aceptados / decididos) * 100) : null;
  const maxEstrellas = Math.max(1, ...datos.porEstrellas);
  const conEstrellas = datos.porEstrellas.reduce((suma, n) => suma + n, 0);

  return (
    <section aria-labelledby="resumen-del-revisor" className="mb-8">
      <h2 id="resumen-del-revisor" className="sr-only">
        Tu resumen como revisor
      </h2>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Por revisar"
          value={nf.format(datos.porRevisar)}
          detalle={
            datos.pendienteMasAntiguo
              ? `El más antiguo espera desde hace ${esperaDesde(datos.pendienteMasAntiguo, ahora)}`
              : "Todo al día"
          }
        />
        <MetricCard label="Revisados hoy" value={nf.format(datos.hoy)} detalle={`${nf.format(datos.semana)} en los últimos 7 días`} />
        <MetricCard
          label="Aceptas"
          value={tasa === null ? "—" : `${tasa}%`}
          detalle={
            decididos > 0
              ? `${nf.format(datos.aceptados)} ${datos.aceptados === 1 ? "aceptado" : "aceptados"} · ${nf.format(datos.rechazados)} ${datos.rechazados === 1 ? "rechazado" : "rechazados"}`
              : "Aún no decides ningún aporte"
          }
        />
        <MetricCard
          label="Tiempo de respuesta"
          value={datos.medianaDeRespuesta === null ? "—" : duracion(datos.medianaDeRespuesta)}
          detalle="Mediana del envío a tu decisión, últimos 30 días"
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel titulo={`Tus decisiones, últimos ${DIAS_DE_ACTIVIDAD} días`}>
          <GraficaDeDecisiones dias={datos.actividad} />
        </Panel>

        <Panel titulo="Estrellas que das">
          {conEstrellas === 0 ? (
            <p className="rounded-lg bg-system-100 p-4 text-center text-[13px] text-system-600">
              Cuando aceptes aportes, aquí verás cómo los calificas.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[13px] text-system-600">
                Promedio{" "}
                <span className="font-semibold text-system-900">
                  {datos.promedioDeEstrellas === null ? "—" : `${decimal.format(datos.promedioDeEstrellas)} ★`}
                </span>{" "}
                en {nf.format(conEstrellas)} {conEstrellas === 1 ? "aporte aceptado" : "aportes aceptados"}
              </p>
              <ul className="space-y-2">
                {[5, 4, 3, 2, 1].map((estrellas) => {
                  const n = datos.porEstrellas[estrellas - 1];
                  return (
                    <li key={estrellas} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-[12.5px]">
                      <span className="font-mono text-system-600">{estrellas} ★</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-system-100" aria-hidden="true">
                        <span
                          className="block h-full rounded-full bg-brand-600"
                          style={{ width: `${n === 0 ? 0 : Math.max(4, (n / maxEstrellas) * 100)}%` }}
                        />
                      </span>
                      <span className="text-right font-mono text-system-700">
                        {nf.format(n)}
                        <span className="sr-only"> {n === 1 ? "aporte" : "aportes"} con {estrellas} estrellas</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <Panel titulo="Campañas con aportes por revisar">
        {datos.conPendientes.length === 0 ? (
          <p className="text-[13px] text-system-600">No tienes aportes pendientes en tus campañas en curso.</p>
        ) : (
          <ul className="divide-y divide-system-200">
            {datos.conPendientes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-system-900">{c.nombre}</p>
                  <p className="text-[12px] text-system-500">
                    {nf.format(c.pendientes)} {c.pendientes === 1 ? "pendiente" : "pendientes"} · el más antiguo desde hace{" "}
                    {esperaDesde(c.masAntiguo, ahora)}
                  </p>
                </div>
                <Link
                  href={`/revisiones/campanas/${c.id}`}
                  className="shrink-0 rounded-pill border border-system-300 px-3.5 py-1.5 text-[13px] font-semibold text-brand-700 transition-colors hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Revisar<span className="sr-only"> los aportes de {c.nombre}</span> →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
