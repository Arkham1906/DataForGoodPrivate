// Pantalla /aportes/dashboard (SCR-WEB-34): aportes recolectados en toda la plataforma.
// Acceso: sesión raíz (layout de (panel) + exigirSesionRoot()). Server Component.
// Datos: obtenerDashboardDeAportes() de lib/aportes/dashboard.ts, por periodo (?periodo=, o ?desde=&hasta=; desde el
// 2026-11-22 también todo el histórico y fechas específicas, ui/SelectorDePeriodo; ?rango= de antes sigue sirviendo).
// La gráfica (ui/GraficaDeTiempo) agrupa por día, semana, mes o año según el largo del periodo.
// Solo consulta: el SuperUsuario ve cifras, nunca el contenido de un aporte.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import GraficaDeTiempo from "@/components/ui/GraficaDeTiempo";
import SelectorDePeriodo from "@/components/ui/SelectorDePeriodo";
import MetricCard from "@/components/sistema/MetricCard";
import Subtabs from "@/components/sistema/subtabs";
import {
  Encabezado,
  ListaClaveValor,
  Reparto,
  TituloDeSeccion,
  formatearNumero,
} from "@/components/sistema/ui";
import { PESTANAS_APORTES } from "@/lib/aportes/bandeja";
import { obtenerDashboardDeAportes } from "@/lib/aportes/dashboard";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { formatearCorte } from "@/lib/usuarios/dashboard";
import { periodoDesde, textoDelPeriodo } from "@/lib/periodo";
import { NOMBRE_DE_UNIDAD } from "@/lib/series-de-tiempo";

export const metadata: Metadata = { title: "Dashboard de aportes" };
export const dynamic = "force-dynamic";

function Vacio({ children }: { children: string }) {
  return <p className="text-[12.5px] text-system-600">{children}</p>;
}

export default async function DashboardDeAportesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string; rango?: string }>;
}) {
  await exigirSesionRoot();
  const periodo = periodoDesde(await searchParams, "mes");
  const d = await obtenerDashboardDeAportes(periodo);
  const enElPeriodo = textoDelPeriodo(periodo);

  return (
    <div>
      <Subtabs pestanas={PESTANAS_APORTES} etiquetaAria="Secciones de aportes" distribuidasEnMovil />

      <Encabezado
        titulo="Aportes recolectados"
        descripcion="Cuántos aportes llegan a la plataforma, cómo se revisan y de qué campañas, tipos y temáticas vienen en el periodo elegido."
        subtitulo={`${formatearNumero(d.total)} en total · ${formatearNumero(d.enRango)} en el periodo · ${formatearCorte(d.cortadoEn).toLowerCase()}`}
        subtituloMono
        acciones={
          <Suspense fallback={null}>
            <SelectorDePeriodo periodo={periodo} defecto="mes" />
          </Suspense>
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
      <p className="-mt-3 mb-6 text-[12px] text-system-500">
        Aprobados, rechazados y tasa cuentan los aportes enviados en el periodo; pendientes es la
        cola de hoy, los que aún esperan la decisión del creador o del revisor.
      </p>

      <TituloDeSeccion>
        Aportes recibidos {d.serie ? NOMBRE_DE_UNIDAD[d.serie.unidad] : ""} · {enElPeriodo}
      </TituloDeSeccion>
      <div className="mb-6">
        {!d.serie ? (
          <Vacio>Sin datos para la gráfica.</Vacio>
        ) : (
          <GraficaDeTiempo
            serie={d.serie}
            series={[{ nombre: "Aportes", color: "brand" }]}
            descripcion={`Aportes recibidos ${NOMBRE_DE_UNIDAD[d.serie.unidad]}, ${enElPeriodo}`}
            vacio="No llegaron aportes en este periodo."
          />
        )}
      </div>

      <div className="mb-8 flex flex-col gap-8">
        <section>
          <TituloDeSeccion>Por tipo de dato</TituloDeSeccion>
          {d.porTipo.length === 0 ? (
            <Vacio>No llegaron aportes en el periodo.</Vacio>
          ) : (
            <Reparto filas={d.porTipo} anchoEtiqueta={96} anchoValor={48} />
          )}
          {d.sinCuenta > 0 ? (
            <p className="mt-2.5 text-[12px] text-system-500">
              {formatearNumero(d.sinCuenta)} {d.sinCuenta === 1 ? "llegó" : "llegaron"} por enlace
              público, sin cuenta.
            </p>
          ) : null}
        </section>

        <section>
          <TituloDeSeccion>Por temática</TituloDeSeccion>
          {d.porTematica.length === 0 ? (
            <Vacio>No llegaron aportes en el periodo.</Vacio>
          ) : (
            <ListaClaveValor
              filas={d.porTematica.map((t) => ({ clave: t.etiqueta, valor: formatearNumero(t.valor) }))}
            />
          )}
        </section>
      </div>

      <div className="mb-8 flex flex-col gap-8">
        <section>
          <TituloDeSeccion>Motivos de rechazo</TituloDeSeccion>
          {d.motivosDeRechazo.length === 0 ? (
            <Vacio>No hubo rechazos en el periodo.</Vacio>
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
            <Vacio>No llegaron aportes en el periodo.</Vacio>
          ) : (
            <ListaClaveValor
              filas={d.masAportan.map((c) => ({
                clave: (
                  <Link href={`/sistema/campanas/${c.id}`} className="break-words hover:text-brand-600">
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
