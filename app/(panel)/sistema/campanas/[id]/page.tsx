// Pantalla /sistema/campanas/[id]: panel de una campaña (solo consulta).
// Server Component. Datos: obtenerCabeceraDeCampana() y lib/campanas/panel.ts.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import GraficaDeColumnas from "@/components/sistema/grafica-columnas";
import MetricCard from "@/components/sistema/MetricCard";
import ProgressBar from "@/components/sistema/ProgressBar";
import Tag from "@/components/sistema/Tag";
import { Aviso, EnlaceBoton, Reparto, Tarjeta, TituloDeSeccion, formatearNumero } from "@/components/sistema/ui";
import RefrescoEnVivo from "@/components/supervision/RefrescoEnVivo";
import { obtenerPanelDeCampana } from "@/lib/campanas/panel";
import { hasRootSession } from "@/lib/rootSession";
import {
  ETIQUETA_DE_CAMPANA,
  esEstado,
  formatearFechaCampana,
  obtenerCabeceraDeCampana,
} from "@/lib/campanas/sistema";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // Sin sesión raíz no se lee nada, ni siquiera el nombre para el título.
  const panel = /^\d+$/.test(id) && (await hasRootSession()) ? await obtenerPanelDeCampana(id) : null;
  return { title: panel ? panel.nombre : "Campaña" };
}

export default async function PanelDeCampanaSistemaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // La cabecera exige sesión raíz; va primero para no leer nada sin ella.
  const cabecera = await obtenerCabeceraDeCampana(id);
  if (!cabecera) notFound();
  const c = await obtenerPanelDeCampana(id);
  if (!c) notFound();

  const estado = esEstado(c.status) ?? "borrador";
  const et = ETIQUETA_DE_CAMPANA[estado];
  const finalizada = estado === "finalizada";
  const enVivo = estado === "activa";
  const duracion =
    c.fechaInicio && c.fechaFin ? Math.round((Date.parse(c.fechaFin) - Date.parse(c.fechaInicio)) / 86_400_000) : null;

  let proyeccion: string;
  if (finalizada) {
    proyeccion = `Cerró con ${formatearNumero(c.metricas.recibidos)} de ${formatearNumero(c.meta)} aportes (${c.porcentajeMeta}% de la meta).`;
  } else if (estado !== "activa" && estado !== "pausada") {
    proyeccion = "La campaña todavía no recolecta aportes: la proyección aparece cuando esté activa.";
  } else if (c.meta > 0 && c.metricas.recibidos >= c.meta) {
    proyeccion = "La meta ya está cubierta. La campaña sigue admitiendo aportes hasta su fecha de cierre.";
  } else if (!c.ritmo.fechaEstimadaMeta) {
    proyeccion = "Sin aportes en los últimos 14 días: no hay ritmo para estimar cuándo se alcanza la meta.";
  } else {
    const cierre =
      c.ritmo.llegaAntesDelCierre === null
        ? ""
        : c.ritmo.llegaAntesDelCierre
          ? ", antes de la fecha de cierre"
          : `, después de la fecha de cierre (${formatearFechaCampana(c.fechaFin)})`;
    proyeccion = `Al ritmo actual de ${c.ritmo.aportesPorDia} aportes por día, la meta se alcanza alrededor del ${formatearFechaCampana(
      c.ritmo.fechaEstimadaMeta,
    )}${cierre}.`;
  }

  return (
    <div>
      {enVivo && <RefrescoEnVivo />}

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-system-900">{c.nombre}</h1>
          <p className="mt-1 font-mono text-[13px] text-system-600">
            {c.fechaInicio ? formatearFechaCampana(c.fechaInicio) : "sin inicio"} –{" "}
            {c.fechaFin ? formatearFechaCampana(c.fechaFin) : "sin cierre"} · {et.texto.toLowerCase()}
          </p>
          <p className="mt-1 text-[12.5px] text-system-500">
            {cabecera.tematica || "Sin temática"} · creada por {cabecera.creador || "—"} · supervisa: {cabecera.supervisadaPor}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {enVivo ? <Tag tone="ok">En vivo · actualiza cada 3 s</Tag> : <Tag tone={et.tono}>{et.texto}</Tag>}
          <EnlaceBoton href={`/aportes?campana=${id}`}>Ver aportes recibidos</EnlaceBoton>
        </div>
      </header>

      {finalizada ? (
        <Aviso titulo="Esta campaña está cerrada" className="mb-5">
          No admite aportes nuevos. Los datos quedan disponibles para consulta.
        </Aviso>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Aportes aprobados" value={formatearNumero(c.metricas.aprobados)} />
        <MetricCard label="Participantes" value={formatearNumero(c.metricas.participantes)} />
        {finalizada ? (
          <MetricCard label="Meta alcanzada" value={`${c.porcentajeMeta}%`} />
        ) : (
          <MetricCard label="Pendientes" value={formatearNumero(c.metricas.pendientes)} />
        )}
        {finalizada ? (
          <MetricCard label="Duración" value={duracion === null ? "—" : `${duracion}d`} />
        ) : (
          <MetricCard label="Meta" value={`${c.porcentajeMeta}%`} />
        )}
      </div>

      <TituloDeSeccion>Recolección diaria · últimos 14 días</TituloDeSeccion>
      <div className="mb-6 rounded-lg border border-system-200 bg-white p-4 shadow-sm">
        <GraficaDeColumnas
          columnas={c.recoleccionDiaria.map((d) => ({ etiqueta: d.etiqueta, valor: d.valor }))}
          descripcion={`Aportes recibidos por día en ${c.nombre}, últimos 14 días`}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <TituloDeSeccion>{finalizada ? "Resultado por tipo de dato" : "Por tipo de dato"} · aprobados</TituloDeSeccion>
          {c.porTipo.length === 0 || c.metricas.aprobados === 0 ? (
            <p className="text-[12.5px] text-system-600">Todavía no hay aportes aprobados.</p>
          ) : (
            <Reparto
              filas={c.porTipo.map((t) => ({ etiqueta: t.etiqueta, valor: t.valor }))}
              anchoEtiqueta={80}
              anchoValor={34}
              maximo={c.metricas.aprobados}
            />
          )}
        </section>

        <section>
          <TituloDeSeccion>{finalizada ? "Meta alcanzada" : "Progreso hacia la meta"}</TituloDeSeccion>
          <div role="img" aria-label={`${c.porcentajeMeta}% de la meta: ${c.metricas.recibidos} de ${c.meta} aportes`}>
            <ProgressBar pct={c.porcentajeMeta} tone="ok" />
          </div>
          <div className="mb-1 mt-2 flex justify-between font-mono text-[12px] text-system-500">
            <span>
              {formatearNumero(c.metricas.recibidos)} de {formatearNumero(c.meta)} aportes
            </span>
            <span>
              {finalizada
                ? duracion === null
                  ? ""
                  : `${duracion} días de campaña`
                : c.diasRestantes !== null
                  ? `${c.diasRestantes} días restantes`
                  : "sin fecha de cierre"}
            </span>
          </div>
          <p className="mb-3.5 text-[11.5px] text-system-500">
            {formatearNumero(c.metricas.aprobados)} aprobados · {formatearNumero(c.metricas.pendientes)} pendientes ·{" "}
            {formatearNumero(c.metricas.rechazados)} rechazados
          </p>
          <Tarjeta tenue>
            <p className="text-[12px] leading-relaxed text-system-600">{proyeccion}</p>
          </Tarjeta>
        </section>
      </div>
    </div>
  );
}
