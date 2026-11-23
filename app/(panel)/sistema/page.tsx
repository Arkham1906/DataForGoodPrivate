// Pantalla /sistema: inicio del SuperUsuario. Desde el 2026-11-22 (a pedido del usuario: "un dashboard con resumen,
// que tenga niveles de información") es un resumen de toda la plataforma que va de lo general al detalle:
//   1. De un vistazo: cuatro cifras clave del periodo, comparadas con el periodo anterior equivalente.
//   2. Requiere atención: lo pendiente ahora, con su enlace (o "Todo al día").
//   3. Actividad: aportes recibidos en el periodo (ui/GraficaDeTiempo).
//   4. Por área (Usuarios, Campañas, Aportes, Moderación): cuatro cifras de cada una y un "Ver detalle" desplegable
//      con sus repartos; desde cada área, su dashboard completo.
// Todo en una sola columna (regla del panel) y con el selector de periodo de los dashboards (?periodo=, "mes").
// Antes: tres tarjetas (usuarios, campañas activas, aportes) y el aviso de que no hay supervisores.
// Server Component. Datos: lib/sistema/resumen.ts y los dashboards de cada área.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import GraficaDeTiempo from "@/components/ui/GraficaDeTiempo";
import SelectorDePeriodo from "@/components/ui/SelectorDePeriodo";
import Tag from "@/components/sistema/Tag";
import {
  Encabezado,
  EnlaceBoton,
  ListaClaveValor,
  Reparto,
  TituloDeSeccion,
  formatearNumero,
} from "@/components/sistema/ui";
import { obtenerDashboardDeAportes } from "@/lib/aportes/dashboard";
import { ETIQUETA_DE_CAMPANA, obtenerDashboardDeCampanas } from "@/lib/campanas/sistema";
import { fechaCorta, periodoDesde, textoDelPeriodo } from "@/lib/periodo";
import { NOMBRE_DE_UNIDAD } from "@/lib/series-de-tiempo";
import { obtenerResumenDelSistema, type Comparada, type Rango } from "@/lib/sistema/resumen";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { obtenerDashboardDeUsuarios } from "@/lib/usuarios/dashboard";

export const metadata: Metadata = { title: "Panel del sistema" };
export const dynamic = "force-dynamic";

/* ── presentación ───────────────────────────────────────────────────────── */

function textoDelRango(r: Rango): string {
  return r.desde === r.hasta ? `el ${fechaCorta(r.desde)}` : `del ${fechaCorta(r.desde)} al ${fechaCorta(r.hasta)}`;
}

/** Con menos que esto en el periodo anterior, el porcentaje engaña (de 1 a 60 es "5900 %"): se da la diferencia. */
const MINIMO_PARA_PORCENTAJE = 10;

/**
 * "↑ 25 %", "↑ 59 más", "↓ 3 menos", "= sin cambio"; null en el histórico. La flecha y el texto dicen el sentido, no
 * solo el color.
 */
function cambio(actual: number | null, anterior: number | null, enPuntos = false): string | null {
  if (actual === null || anterior === null) return null;
  const diferencia = actual - anterior;
  if (diferencia === 0) return "= sin cambio";
  const flecha = diferencia > 0 ? "↑" : "↓";
  const cuanto = Math.abs(diferencia);
  if (enPuntos) return `${flecha} ${cuanto} ${cuanto === 1 ? "punto" : "puntos"}`;
  if (anterior < MINIMO_PARA_PORCENTAJE) return `${flecha} ${formatearNumero(cuanto)} ${diferencia > 0 ? "más" : "menos"}`;
  return `${flecha} ${Math.round((cuanto / anterior) * 100)} %`;
}

/** Nivel 1: una cifra clave con su comparación. */
function CifraClave({
  etiqueta,
  valor,
  variacion,
  anterior,
  pie,
}: {
  etiqueta: string;
  valor: string;
  variacion: string | null;
  /** El valor del periodo anterior, ya formateado. */
  anterior: string | null;
  pie: string;
}) {
  return (
    <div className="rounded-lg border border-system-200 bg-white p-4">
      <p className="text-[12px] text-system-600">{etiqueta}</p>
      <p className="mt-1 text-[26px] font-extrabold leading-tight text-system-900">{valor}</p>
      {variacion ? (
        <p className="mt-1 text-[12.5px] font-semibold text-system-900">
          {variacion}
          {anterior !== null ? <span className="font-normal text-system-500"> · antes {anterior}</span> : null}
        </p>
      ) : null}
      <p className="mt-2 border-t border-system-200 pt-2 text-[12px] text-system-500">{pie}</p>
    </div>
  );
}

/** Nivel 3: un área con sus cuatro cifras, su detalle desplegable y el enlace a su dashboard. */
function Area({
  titulo,
  descripcion,
  dashboard,
  cifras,
  children,
}: {
  titulo: string;
  descripcion: string;
  dashboard: { href: string; texto: string };
  cifras: { etiqueta: string; valor: string; nota?: string }[];
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-system-900">{titulo}</h3>
          <p className="mt-0.5 text-[12.5px] text-system-600">{descripcion}</p>
        </div>
        <EnlaceBoton href={dashboard.href}>{dashboard.texto}</EnlaceBoton>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
        {cifras.map((c) => (
          <div key={c.etiqueta} className="min-w-0">
            <dt className="text-[11.5px] text-system-600">{c.etiqueta}</dt>
            <dd className="mt-0.5 font-mono text-[18px] font-semibold tabular-nums text-system-900">{c.valor}</dd>
            {c.nota ? <dd className="text-[11px] text-system-500">{c.nota}</dd> : null}
          </div>
        ))}
      </dl>

      <details className="group mt-4 border-t border-system-200 pt-3">
        <summary className="flex min-h-6 cursor-pointer select-none list-none items-center gap-2 text-[12.5px] font-semibold text-brand-600 hover:text-brand-800 [&::-webkit-details-marker]:hidden">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          >
            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="group-open:hidden">Ver detalle</span>
          <span className="hidden group-open:inline">Ocultar detalle</span>
          <span className="sr-only"> de {titulo.toLowerCase()}</span>
        </summary>
        <div className="mt-4 flex flex-col gap-6">{children}</div>
      </details>
    </section>
  );
}

/** Un bloque dentro del detalle de un área. */
function Detalle({ titulo, vacio, children }: { titulo: string; vacio?: string | false; children?: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2.5 text-[13px] font-semibold text-system-900">{titulo}</h4>
      {vacio ? <p className="text-[12.5px] text-system-600">{vacio}</p> : children}
    </div>
  );
}

/* ── página ─────────────────────────────────────────────────────────────── */

export default async function PanelDelSistemaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  await exigirSesionRoot();
  const periodo = periodoDesde(await searchParams, "mes");
  const enElPeriodo = textoDelPeriodo(periodo);

  // Campañas primero: pone al día activas y finalizadas por fecha antes de contar lo demás.
  const campanas = await obtenerDashboardDeCampanas();
  const [r, usuarios, aportes] = await Promise.all([
    obtenerResumenDelSistema(periodo),
    obtenerDashboardDeUsuarios(periodo),
    obtenerDashboardDeAportes(periodo),
  ]);

  const frente = r.anterior ? textoDelRango(r.anterior) : null;
  const antes = (c: Comparada) => (c.anterior === null ? null : formatearNumero(c.anterior));
  const m = r.moderacion;
  const e = usuarios.estadoDeCuenta;
  const v = campanas.vigencia;

  return (
    <div>
      <Encabezado
        titulo="Panel del sistema"
        subtitulo="Resumen de la plataforma, de lo general al detalle"
        acciones={
          <Suspense fallback={null}>
            <SelectorDePeriodo periodo={periodo} defecto="mes" />
          </Suspense>
        }
      />

      {/* ── 1. De un vistazo ─────────────────────────────────────────────── */}
      <section aria-labelledby="vistazo" className="mb-8">
        <h2 id="vistazo" className="mb-1 text-[15px] font-bold text-system-900">
          De un vistazo · {enElPeriodo}
        </h2>
        <p className="mb-3 text-[12.5px] text-system-500">
          {frente
            ? `Cada cifra se compara con el periodo anterior equivalente, ${frente}.`
            : "En todo el histórico no hay periodo anterior con qué comparar."}
        </p>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <CifraClave
            etiqueta="Usuarios nuevos"
            valor={formatearNumero(r.usuariosNuevos.actual)}
            variacion={cambio(r.usuariosNuevos.actual, r.usuariosNuevos.anterior)}
            anterior={antes(r.usuariosNuevos)}
            pie={`${formatearNumero(usuarios.totalRegistrados)} registrados en total`}
          />
          <CifraClave
            etiqueta="Aportes recibidos"
            valor={formatearNumero(r.aportesRecibidos.actual)}
            variacion={cambio(r.aportesRecibidos.actual, r.aportesRecibidos.anterior)}
            anterior={antes(r.aportesRecibidos)}
            pie={`${formatearNumero(aportes.total)} en total · ${formatearNumero(aportes.pendientes)} por revisar hoy`}
          />
          <CifraClave
            etiqueta="Tasa de aprobación"
            valor={r.tasaDeAprobacion.actual === null ? "—" : `${r.tasaDeAprobacion.actual}%`}
            variacion={cambio(r.tasaDeAprobacion.actual, r.tasaDeAprobacion.anterior, true)}
            anterior={r.tasaDeAprobacion.anterior === null ? null : `${r.tasaDeAprobacion.anterior}%`}
            pie="Aprobados entre los revisados que se enviaron en el periodo"
          />
          <CifraClave
            etiqueta="Campañas nuevas"
            valor={formatearNumero(r.campanasNuevas.actual)}
            variacion={cambio(r.campanasNuevas.actual, r.campanasNuevas.anterior)}
            anterior={antes(r.campanasNuevas)}
            pie={`${formatearNumero(campanas.activas)} activas ahora`}
          />
        </div>
      </section>

      {/* ── 2. Requiere atención ─────────────────────────────────────────── */}
      <section aria-labelledby="atencion" className="mb-8">
        <h2 id="atencion" className="mb-3 text-[15px] font-bold text-system-900">
          Requiere atención
        </h2>
        {r.haySupervisores && r.pendientes.length === 0 ? (
          <p className="rounded-lg border border-system-200 bg-white p-4 text-[13px] text-system-600">
            Todo al día: no hay campañas por supervisar, reportes, temáticas ni aportes atrasados.
          </p>
        ) : (
          <ul className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
            {!r.haySupervisores && (
              <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-system-900">
                    <Tag tone="danger">Urgente</Tag>
                    Ningún usuario tiene el rol de Supervisor
                  </p>
                  <p className="mt-1 text-[12.5px] text-system-600">
                    Mientras no haya uno, solo tú puedes aceptar campañas. Puedes asignar el rol o validarlas como respaldo.
                  </p>
                </div>
                <span className="flex shrink-0 flex-wrap gap-2">
                  <EnlaceBoton href="/usuarios">Asignar el rol</EnlaceBoton>
                  <EnlaceBoton href="/supervisar">Validar como respaldo</EnlaceBoton>
                </span>
              </li>
            )}
            {r.pendientes.map((p) => (
              <li key={p.clave} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-system-900">
                    <Tag tone={p.tono === "urgente" ? "danger" : "warn"}>{p.tono === "urgente" ? "Urgente" : "Revisar"}</Tag>
                    {p.texto}
                  </p>
                  <p className="mt-1 text-[12.5px] text-system-600">{p.detalle}</p>
                </div>
                <Link
                  href={p.href}
                  className="shrink-0 self-center text-[12.5px] font-semibold text-brand-600 hover:text-brand-800 hover:underline"
                >
                  Ir<span className="sr-only"> a {p.texto}</span> <span aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 3. Actividad ─────────────────────────────────────────────────── */}
      <section aria-labelledby="actividad" className="mb-8">
        <TituloDeSeccion>
          <span id="actividad">
            Aportes recibidos {aportes.serie ? NOMBRE_DE_UNIDAD[aportes.serie.unidad] : ""} · {enElPeriodo}
          </span>
        </TituloDeSeccion>
        {aportes.serie ? (
          <GraficaDeTiempo
            serie={aportes.serie}
            series={[{ nombre: "Aportes", color: "brand" }]}
            descripcion={`Aportes recibidos ${NOMBRE_DE_UNIDAD[aportes.serie.unidad]}, ${enElPeriodo}`}
            vacio="No llegaron aportes en este periodo."
          />
        ) : (
          <p className="text-[12.5px] text-system-600">Sin datos para la gráfica.</p>
        )}
      </section>

      {/* ── 4. Por área ──────────────────────────────────────────────────── */}
      <section aria-labelledby="areas">
        <h2 id="areas" className="mb-1 text-[15px] font-bold text-system-900">
          Por área
        </h2>
        <p className="mb-3 text-[12.5px] text-system-500">
          Cuatro cifras de cada área; «Ver detalle» despliega sus repartos y el botón lleva a su dashboard completo.
        </p>

        <div className="flex flex-col gap-4">
          <Area
            titulo="Usuarios"
            descripcion={`Cuentas de la plataforma · nuevas y con aportes ${enElPeriodo}`}
            dashboard={{ href: "/usuarios/dashboard", texto: "Dashboard de usuarios" }}
            cifras={[
              { etiqueta: "Registrados", valor: formatearNumero(usuarios.totalRegistrados) },
              { etiqueta: "Nuevos", valor: formatearNumero(r.usuariosNuevos.actual), nota: enElPeriodo },
              { etiqueta: "Con aportes", valor: formatearNumero(usuarios.conAportesEnRango), nota: enElPeriodo },
              { etiqueta: "Cuentas restringidas", valor: formatearNumero(usuarios.cuentasRestringidas), nota: "suspendidas o baneadas" },
            ]}
          >
            <Detalle titulo="Estado de las cuentas">
              <ListaClaveValor
                filas={[
                  { clave: <Tag tone="ok">Activas</Tag>, valor: formatearNumero(e.activas) },
                  { clave: <Tag tone="warn">Con avisos acumulados</Tag>, valor: formatearNumero(e.conStrikes) },
                  { clave: <Tag tone="danger">Suspendidas</Tag>, valor: formatearNumero(e.suspendidas) },
                  { clave: <Tag tone="danger">Baneadas</Tag>, valor: formatearNumero(e.baneadas) },
                  { clave: "Correo sin verificar", valor: formatearNumero(e.correoSinVerificar) },
                ]}
              />
            </Detalle>
            <Detalle titulo="Por rol asignado" vacio={usuarios.porRol.length === 0 && "Sin datos."}>
              <Reparto filas={usuarios.porRol} anchoEtiqueta={150} />
            </Detalle>
          </Area>

          <Area
            titulo="Campañas"
            descripcion="Estado actual de todas las campañas"
            dashboard={{ href: "/sistema/campanas/dashboard", texto: "Dashboard de campañas" }}
            cifras={[
              { etiqueta: ETIQUETA_DE_CAMPANA.en_revision.texto, valor: formatearNumero(campanas.porEstado.en_revision) },
              { etiqueta: "Activas", valor: formatearNumero(campanas.porEstado.activa) },
              { etiqueta: ETIQUETA_DE_CAMPANA.pausada.texto + "s", valor: formatearNumero(campanas.porEstado.pausada) },
              { etiqueta: ETIQUETA_DE_CAMPANA.finalizada.texto + "s", valor: formatearNumero(campanas.porEstado.finalizada) },
            ]}
          >
            <Detalle titulo="Tiempo restante de las activas">
              <ListaClaveValor
                filas={[
                  { clave: "Vencen en menos de 7 días", valor: formatearNumero(v.menosDe7) },
                  { clave: "Entre 7 y 30 días", valor: formatearNumero(v.entre7y30) },
                  { clave: "Más de 30 días", valor: formatearNumero(v.masDe30) },
                  ...(v.sinFecha > 0 ? [{ clave: "Sin fecha de cierre", valor: formatearNumero(v.sinFecha) }] : []),
                ]}
              />
            </Detalle>
            <Detalle titulo="Activas por temática" vacio={campanas.porTematica.length === 0 && "No hay campañas activas."}>
              <Reparto filas={campanas.porTematica.slice(0, 5)} anchoEtiqueta={150} anchoValor={30} />
            </Detalle>
          </Area>

          <Area
            titulo="Aportes"
            descripcion={`Aportes enviados ${enElPeriodo}; por revisar es la cola de hoy`}
            dashboard={{ href: "/aportes/dashboard", texto: "Dashboard de aportes" }}
            cifras={[
              { etiqueta: "Recibidos", valor: formatearNumero(aportes.enRango) },
              { etiqueta: "Aprobados", valor: formatearNumero(aportes.aprobados) },
              { etiqueta: "Rechazados", valor: formatearNumero(aportes.rechazados) },
              { etiqueta: "Por revisar", valor: formatearNumero(aportes.pendientes), nota: "hoy" },
            ]}
          >
            <Detalle titulo="Por tipo de dato" vacio={aportes.porTipo.length === 0 && "No llegaron aportes en el periodo."}>
              <Reparto filas={aportes.porTipo} anchoEtiqueta={96} anchoValor={48} />
            </Detalle>
            <Detalle titulo="Campañas que más aportan" vacio={aportes.masAportan.length === 0 && "No llegaron aportes en el periodo."}>
              <ListaClaveValor
                filas={aportes.masAportan.slice(0, 5).map((c) => ({
                  clave: (
                    <Link href={`/sistema/campanas/${c.id}`} className="break-words hover:text-brand-600">
                      {c.nombre}
                    </Link>
                  ),
                  valor: formatearNumero(c.aportes),
                }))}
              />
            </Detalle>
          </Area>

          <Area
            titulo="Moderación"
            descripcion={`Reportes y sanciones ${enElPeriodo}`}
            dashboard={{ href: "/supervisar/reportes", texto: "Ir a reportes" }}
            cifras={[
              {
                etiqueta: "Reportes recibidos",
                valor: formatearNumero(m.reportesRecibidos.actual),
                nota: cambio(m.reportesRecibidos.actual, m.reportesRecibidos.anterior) ?? enElPeriodo,
              },
              { etiqueta: "Reportes pendientes", valor: formatearNumero(m.reportesPendientes), nota: "hoy" },
              {
                etiqueta: "Sanciones aplicadas",
                valor: formatearNumero(m.sancionesAplicadas.actual),
                nota: cambio(m.sancionesAplicadas.actual, m.sancionesAplicadas.anterior) ?? enElPeriodo,
              },
              { etiqueta: "Supervisores", valor: formatearNumero(m.supervisores), nota: "con el rol" },
            ]}
          >
            <Detalle titulo="Reportes por tipo" vacio={m.reportesPorTipo.length === 0 && "No hubo reportes en el periodo."}>
              <Reparto filas={m.reportesPorTipo} anchoEtiqueta={110} anchoValor={30} />
            </Detalle>
            <Detalle titulo="Sanciones por tipo" vacio={m.sancionesPorTipo.length === 0 && "No hubo sanciones en el periodo."}>
              <Reparto filas={m.sancionesPorTipo} anchoEtiqueta={150} anchoValor={30} />
            </Detalle>
            <p className="text-[12.5px] text-system-600">
              Las sanciones y la supervisión se gestionan en{" "}
              <Link href="/supervisar/sanciones" className="font-semibold text-brand-600 hover:underline">
                Modo supervisor
              </Link>
              ; aquí solo se consultan.
            </p>
          </Area>
        </div>
      </section>
    </div>
  );
}
