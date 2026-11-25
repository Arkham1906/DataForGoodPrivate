// Pantalla /usuarios/dashboard: métricas de usuarios por rango de fechas.
// Server Component. Datos: lib/usuarios/dashboard.ts. Periodo en ui/SelectorDePeriodo (2026-11-22: atajos, todo el
// histórico o fechas específicas; ?rango= de antes sigue sirviendo). Altas en ui/GraficaDeTiempo. "Usuarios por aportes"
// (2026-11-22): las cuentas agrupadas por cuántos aportes enviaron y cuántos les aprobaron en el periodo.

import type { Metadata } from "next";
import { Suspense } from "react";

import GraficaDeTiempo from "@/components/ui/GraficaDeTiempo";
import SelectorDePeriodo from "@/components/ui/SelectorDePeriodo";
import Subtabs from "@/components/sistema/subtabs";
import {
  Encabezado,
  EnlaceBoton,
  ListaClaveValor,
  Reparto,
  TituloDeSeccion,
  formatearNumero,
} from "@/components/sistema/ui";
import MetricCard from "@/components/sistema/MetricCard";
import Tag from "@/components/sistema/Tag";
import {
  PESTANAS_USUARIOS,
  formatearCorte,
  obtenerDashboardDeUsuarios,
} from "@/lib/usuarios/dashboard";
import { periodoDesde, textoDelPeriodo } from "@/lib/periodo";
import { NOMBRE_DE_UNIDAD } from "@/lib/series-de-tiempo";
import { exigirSesionRoot } from "@/lib/supervision/root";

export const metadata: Metadata = { title: "Dashboard de usuarios" };
export const dynamic = "force-dynamic";

export default async function DashboardDeUsuariosPage({
  searchParams,
}: {
  // En Next 16 searchParams llega como promesa.
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string; rango?: string }>;
}) {
  await exigirSesionRoot();
  const periodo = periodoDesde(await searchParams, "mes");
  const d = await obtenerDashboardDeUsuarios(periodo);
  const enElPeriodo = textoDelPeriodo(periodo);

  const e = d.estadoDeCuenta;

  return (
    <div>
      <Subtabs
        pestanas={PESTANAS_USUARIOS}
        etiquetaAria="Secciones de usuarios"
        volverAlMenuEnMovil
      />

      <Encabezado
        titulo="Usuarios registrados"
        descripcion="Altas de cuentas en el periodo elegido y cómo se reparten por rol, estado, ubicación y aportes."
        subtitulo={formatearCorte(d.cortadoEn)}
        subtituloMono
        acciones={
          <>
            <Suspense fallback={null}>
              <SelectorDePeriodo periodo={periodo} defecto="mes" />
            </Suspense>
            <EnlaceBoton href="/usuarios">Ver lista</EnlaceBoton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="max-md:text-center">
          <MetricCard label="Total registrados" value={formatearNumero(d.totalRegistrados)} />
        </div>
        <div className="max-md:text-center">
          <MetricCard label="Altas del mes" value={formatearNumero(d.altasDelMes)} />
        </div>
        <div className="max-md:text-center">
          <MetricCard label="Con aportes en el periodo" value={formatearNumero(d.conAportesEnRango)} />
        </div>
        <div className="max-md:text-center">
          <MetricCard label="Cuentas restringidas" value={formatearNumero(d.cuentasRestringidas)} />
        </div>
      </div>

      <TituloDeSeccion>
        Altas {d.altas ? NOMBRE_DE_UNIDAD[d.altas.unidad] : ""} · {enElPeriodo}
      </TituloDeSeccion>
      <div className="mb-6">
        {d.altas ? (
          <GraficaDeTiempo
            serie={d.altas}
            series={[{ nombre: "Altas", color: "brand" }]}
            descripcion={`Altas de usuarios ${NOMBRE_DE_UNIDAD[d.altas.unidad]}, ${enElPeriodo}`}
            vacio="No hubo altas en este periodo."
          />
        ) : (
          <p className="text-[12.5px] text-system-600">Sin datos para la gráfica.</p>
        )}
      </div>

      {/* Usuarios por aportes (2026-11-22, a pedido del usuario): cuántas cuentas enviaron 0, 1, 2 a 5... aportes en el
          periodo, y cuántas tienen esa cantidad de aprobados. Mismos grupos en las dos (GRUPOS_POR_APORTES). */}
      <div className="mb-8 flex flex-col gap-8">
        {([
          ["Usuarios por aportes enviados", d.porAportes.enviados],
          ["Usuarios por aportes aprobados", d.porAportes.aprobados],
        ] as const).map(([titulo, grupos]) => (
          <section key={titulo}>
            <TituloDeSeccion>
              {titulo} · {enElPeriodo}
            </TituloDeSeccion>
            {grupos.length === 0 ? (
              <p className="text-[12.5px] text-system-600">Sin datos.</p>
            ) : (
              <Reparto
                anchoEtiqueta={90}
                anchoValor={76}
                maximo={Math.max(1, d.totalRegistrados)}
                filas={grupos.map((g) => ({
                  etiqueta: g.etiqueta,
                  valor: g.valor,
                  display: `${formatearNumero(g.valor)} · ${d.totalRegistrados > 0 ? Math.round((g.valor / d.totalRegistrados) * 100) : 0}%`,
                }))}
              />
            )}
          </section>
        ))}
      </div>
      <p className="-mt-5 mb-8 text-[12.5px] text-system-500">
        Cuántas cuentas hay en cada grupo según los aportes que enviaron con su cuenta en el periodo, y cuántos de
        esos se aprobaron; el porcentaje es del total de usuarios registrados. Los aportes sin cuenta no cuentan.
      </p>

      <div className="mb-8 flex flex-col gap-8">
        <section>
          <TituloDeSeccion>Por rol asignado</TituloDeSeccion>
          <Reparto filas={d.porRol} />
          <p className="mt-2.5 text-[12.5px] text-system-500">
            Un mismo usuario puede aparecer en más de una fila: crear campañas no
            excluye tener rol de revisor.
          </p>
        </section>

        <section>
          <TituloDeSeccion>Estado de la cuenta</TituloDeSeccion>
          <ListaClaveValor
            filas={[
              { clave: <Tag tone="ok">Activas</Tag>, valor: formatearNumero(e.activas) },
              {
                clave: <Tag tone="warn">Con avisos acumulados</Tag>,
                valor: formatearNumero(e.conStrikes),
              },
              {
                clave: <Tag tone="danger">Suspendidas</Tag>,
                valor: formatearNumero(e.suspendidas),
              },
              {
                clave: <Tag tone="danger">Baneadas</Tag>,
                valor: formatearNumero(e.baneadas),
              },
              { clave: "Correo sin verificar", valor: formatearNumero(e.correoSinVerificar) },
            ]}
          />
        </section>
      </div>

      <div className="mb-8 flex flex-col gap-8">
        <section>
          <TituloDeSeccion>Temáticas de interés declaradas</TituloDeSeccion>
          {d.interesesDeclarados.length === 0 ? (
            <p className="text-[13px] text-system-600">Ningún usuario ha declarado intereses todavía.</p>
          ) : (
            <Reparto
              anchoEtiqueta={150}
              anchoValor={38}
              maximo={100}
              filas={d.interesesDeclarados.map((i) => ({
                etiqueta: i.etiqueta,
                valor: i.porcentaje,
                display: `${i.porcentaje}%`,
              }))}
            />
          )}
          <p className="mt-2.5 text-[12.5px] text-system-500">
            Los cinco temas más elegidos, en porcentaje del total de usuarios registrados.
          </p>
        </section>

        {/* Por estado y, al desplegarlo, por municipio (2026-11-22, a pedido del usuario). */}
        <section>
          <TituloDeSeccion>Por ubicación</TituloDeSeccion>
          {d.porUbicacion.estados.length === 0 && d.porUbicacion.sinUbicacion === 0 ? (
            <p className="text-[12.5px] text-system-600">Sin datos.</p>
          ) : (
            <div className="divide-y divide-system-200">
              {d.porUbicacion.estados.map((e) => (
                <details key={e.estado} className="group">
                  <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3.5 py-2.5 text-[13.5px] [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-2">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 16 16"
                        className="h-3.5 w-3.5 shrink-0 text-system-500 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                      >
                        <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="break-words font-semibold text-system-900">{e.estado}</span>
                      <span className="shrink-0 text-[12px] text-system-500">
                        · {e.municipios.length} {e.municipios.length === 1 ? "municipio" : "municipios"}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums">{formatearNumero(e.valor)}</span>
                  </summary>
                  <ul className="mb-2.5 ml-[22px] divide-y divide-system-100 border-l border-system-200 pl-3">
                    {e.municipios.map((m) => (
                      <li
                        key={m.municipio ?? ""}
                        className="flex items-center justify-between gap-3.5 py-2 text-[13px]"
                      >
                        <span className={m.municipio ? "break-words text-system-700" : "text-system-500"}>
                          {m.municipio ?? "Sin municipio declarado"}
                        </span>
                        <span className="shrink-0 font-mono tabular-nums text-system-700">
                          {formatearNumero(m.valor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
              {d.porUbicacion.sinUbicacion > 0 && (
                <div className="flex items-center justify-between gap-3.5 py-2.5 pl-[22px] text-[13.5px]">
                  <span className="text-system-500">Sin ubicación declarada</span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {formatearNumero(d.porUbicacion.sinUbicacion)}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <TituloDeSeccion>Usuarios con mayor participación</TituloDeSeccion>
      <div className="space-y-3 md:hidden">
        {d.masActivos.map((u) => (
          <article key={u.id} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <p className="break-words text-[14px] font-bold leading-snug text-system-900">{u.nombre}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-system-500">{u.correo}</p>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-system-200 pt-3">
              <div>
                <dt className="text-[11px] text-system-600">Aportes aprobados</dt>
                <dd className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-system-900">
                  {formatearNumero(u.aportesAprobados)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-system-600">Campañas</dt>
                <dd className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums text-system-900">
                  {formatearNumero(u.campanas)}
                </dd>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-3">
                <dt className="text-[11px] text-system-600">Estado</dt>
                <dd>
                  <Tag tone={u.estado.tono}>{u.estado.texto}</Tag>
                </dd>
              </div>
            </dl>

            <div className="mt-3 grid">
              <EnlaceBoton href={`/usuarios/${u.id}`}>
                Ver ficha<span className="sr-only"> de {u.nombre}</span>
              </EnlaceBoton>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm md:block">
        <table className="w-full min-w-[640px] text-left text-[13.5px]">
          <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
            <tr>
              <th className="pb-3 font-medium">Usuario</th>
              <th className="pb-3 font-medium">Aportes aprobados</th>
              <th className="pb-3 font-medium">Campañas</th>
              <th className="pb-3 font-medium">Estado</th>
              <th className="pb-3 text-right font-medium">Ficha</th>
            </tr>
          </thead>
          <tbody>
            {d.masActivos.map((u) => (
              <tr key={u.id} className="border-b border-system-200 last:border-0">
                <td className="py-4">
                  <p className="font-bold text-system-900">{u.nombre}</p>
                  <p className="font-mono text-[11px] text-system-500">{u.correo}</p>
                </td>
                <td className="font-mono tabular-nums">{formatearNumero(u.aportesAprobados)}</td>
                <td className="font-mono tabular-nums">{u.campanas}</td>
                <td>
                  <Tag tone={u.estado.tono}>{u.estado.texto}</Tag>
                </td>
                <td className="text-right">
                  <EnlaceBoton href={`/usuarios/${u.id}`}>
                    Abrir<span className="sr-only"> la ficha de {u.nombre}</span>
                  </EnlaceBoton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
