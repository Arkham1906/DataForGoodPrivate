// Pantalla /aportes/dashboard (SCR-WEB-34): aportes recolectados en toda la plataforma.
// Acceso: sesión raíz (layout de (panel) + exigirSesionRoot()). Server Component.
// Datos: obtenerDashboardDeAportes() de lib/aportes/dashboard.ts, por rango (?rango=30d|90d|12m).
// Solo consulta: el SuperUsuario ve cifras, nunca el contenido de un aporte.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import GraficaDeColumnas from "@/components/sistema/grafica-columnas";
import MetricCard from "@/components/sistema/MetricCard";
import Subtabs from "@/components/sistema/subtabs";
import {
  Encabezado,
  EnlaceBoton,
  ListaClaveValor,
  Reparto,
  TituloDeSeccion,
  formatearNumero,
} from "@/components/sistema/ui";
import { PESTANAS_APORTES } from "@/lib/aportes/bandeja";
import { obtenerDashboardDeAportes } from "@/lib/aportes/dashboard";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { formatearCorte, type RangoDeFechas } from "@/lib/usuarios/dashboard";
import SelectorDeRango from "../../usuarios/dashboard/selector-de-rango";

export const metadata: Metadata = { title: "Dashboard de aportes" };
export const dynamic = "force-dynamic";

const RANGOS: RangoDeFechas[] = ["30d", "90d", "12m"];

function normalizarRango(valor?: string): RangoDeFechas {
  return RANGOS.includes(valor as RangoDeFechas) ? (valor as RangoDeFechas) : "30d";
}

function Vacio({ children }: { children: string }) {
  return <p className="text-[12.5px] text-ink-2">{children}</p>;
}

export default async function DashboardDeAportesPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  await exigirSesionRoot();
  const { rango } = await searchParams;
  const activo = normalizarRango(rango);
  const d = await obtenerDashboardDeAportes(activo);

  return (
    <div>
      <Subtabs pestanas={PESTANAS_APORTES} etiquetaAria="Secciones de aportes" distribuidasEnMovil />

      <Encabezado
        titulo="Aportes recolectados"
        subtitulo={`${formatearNumero(d.total)} en total · ${formatearNumero(d.enRango)} en el rango · ${formatearCorte(d.cortadoEn).toLowerCase()}`}
        subtituloMono
        acciones={
          <>
            <Suspense fallback={null}>
              <SelectorDeRango valor={activo} />
            </Suspense>
            <EnlaceBoton href="/aportes">Ver lista</EnlaceBoton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Aprobados" value={formatearNumero(d.aprobados)} />
        <MetricCard label="Pendientes de revisión" value={formatearNumero(d.pendientes)} />
        <MetricCard label="Rechazados" value={formatearNumero(d.rechazados)} />
        <MetricCard
          label="Tasa de aprobación"
          value={d.tasaDeAprobacion === null ? "—" : `${d.tasaDeAprobacion}%`}
        />
      </div>
      <p className="-mt-3 mb-6 text-[12px] text-ink-3">
        Aprobados, rechazados y tasa cuentan los aportes enviados en el rango; pendientes es la
        cola de hoy, los que aún esperan la decisión del creador o del revisor.
      </p>

      <TituloDeSeccion>{d.serie.titulo}</TituloDeSeccion>
      <div className="mb-6">
        {d.serie.columnas.length === 0 ? (
          <Vacio>Sin datos para la gráfica.</Vacio>
        ) : (
          <GraficaDeColumnas columnas={d.serie.columnas} descripcion={`Aportes recibidos: ${d.serie.titulo}`} />
        )}
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <section>
          <TituloDeSeccion>Por tipo de dato</TituloDeSeccion>
          {d.porTipo.length === 0 ? (
            <Vacio>No llegaron aportes en el rango.</Vacio>
          ) : (
            <Reparto filas={d.porTipo} anchoEtiqueta={96} anchoValor={48} />
          )}
          {d.sinCuenta > 0 ? (
            <p className="mt-2.5 text-[12px] text-ink-3">
              {formatearNumero(d.sinCuenta)} {d.sinCuenta === 1 ? "llegó" : "llegaron"} por enlace
              público, sin cuenta.
            </p>
          ) : null}
        </section>

        <section>
          <TituloDeSeccion>Por temática</TituloDeSeccion>
          {d.porTematica.length === 0 ? (
            <Vacio>No llegaron aportes en el rango.</Vacio>
          ) : (
            <ListaClaveValor
              filas={d.porTematica.map((t) => ({ clave: t.etiqueta, valor: formatearNumero(t.valor) }))}
            />
          )}
        </section>
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <section>
          <TituloDeSeccion>Motivos de rechazo</TituloDeSeccion>
          {d.motivosDeRechazo.length === 0 ? (
            <Vacio>No hubo rechazos en el rango.</Vacio>
          ) : (
            <ListaClaveValor
              filas={d.motivosDeRechazo.map((m) => ({
                clave: <span className="break-words">{m.etiqueta}</span>,
                valor: formatearNumero(m.valor),
              }))}
            />
          )}
        </section>

        <section>
          <TituloDeSeccion>Campañas que más aportan</TituloDeSeccion>
          {d.masAportan.length === 0 ? (
            <Vacio>No llegaron aportes en el rango.</Vacio>
          ) : (
            <ListaClaveValor
              filas={d.masAportan.map((c) => ({
                clave: (
                  <Link href={`/sistema/campanas/${c.id}`} className="break-words hover:text-accent">
                    {c.nombre}
                  </Link>
                ),
                valor: formatearNumero(c.aportes),
              }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
