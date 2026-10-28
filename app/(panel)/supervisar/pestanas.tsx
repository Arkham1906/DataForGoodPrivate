"use client";

// Pestañas de /supervisar (por revisar / supervisadas) con la barra de filtros de
// components/campanas/BarraDeFiltros.tsx, aplicada en el navegador (lib/campanas/filtro-local.ts).
// Supervisadas, reportadas/rechazadas y finalizadas van en dos bloques: las del SuperUsuario y las de los otros supervisores.

import Link from "next/link";
import { useMemo, useState } from "react";
import Tag from "@/components/ui/Tag";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import { FILTROS_VACIOS, avisoSinResultados, conFiltro, etiquetasPorTematica, filtrarCampanas, opcionesDeTematica, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import type { CampanaSupervisable } from "@/lib/supervision/root";
import { porcentajeDeMeta } from "@/lib/campanas/meta";

type TabKey = "pending" | "supervised" | "finished" | "flagged";

const tematicaDe = (campaign: CampanaSupervisable) => campaign.tag;

function porcentaje(campaign: CampanaSupervisable) {
  return `${porcentajeDeMeta(campaign.approvedContributions, campaign.goalContributions)}%`;
}

export default function PestanasDeSupervision({
  pendientes: todasPendientes,
  supervisadas: todasSupervisadas,
  finalizadas: todasFinalizadas,
  conIncidencia: todasConIncidencia,
}: {
  pendientes: CampanaSupervisable[];
  supervisadas: CampanaSupervisable[];
  finalizadas: CampanaSupervisable[];
  conIncidencia: CampanaSupervisable[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [filtros, setFiltros] = useState<FiltrosLocales>(FILTROS_VACIOS);

  const tematicas = useMemo(
    () => opcionesDeTematica([...todasPendientes, ...todasSupervisadas, ...todasFinalizadas, ...todasConIncidencia].map(tematicaDe)),
    [todasPendientes, todasSupervisadas, todasFinalizadas, todasConIncidencia],
  );

  // Las listas filtradas; los contadores de las pestañas usan las completas.
  const pendientes = useMemo(() => filtrarCampanas(todasPendientes, filtros, tematicaDe), [todasPendientes, filtros]);
  const supervisadas = useMemo(() => filtrarCampanas(todasSupervisadas, filtros, tematicaDe), [todasSupervisadas, filtros]);
  const finalizadas = useMemo(() => filtrarCampanas(todasFinalizadas, filtros, tematicaDe), [todasFinalizadas, filtros]);
  const conIncidencia = useMemo(() => filtrarCampanas(todasConIncidencia, filtros, tematicaDe), [todasConIncidencia, filtros]);

  function cambiarFiltro(clave: keyof ValoresDeFiltros, valor: string) {
    setFiltros((actuales) => conFiltro(actuales, clave, valor));
  }

  const etiquetasDelFiltro = useMemo(
    () => etiquetasPorTematica([...todasPendientes, ...todasSupervisadas, ...todasFinalizadas, ...todasConIncidencia], tematicaDe),
    [todasPendientes, todasSupervisadas, todasFinalizadas, todasConIncidencia],
  );

  const renderPendingList = () => (
    <div className="space-y-3">
      {pendientes.length === 0 ? (
        <div className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">
          {avisoSinResultados(todasPendientes.length, "No hay campañas pendientes por revisar.")}
        </div>
      ) : (
        pendientes.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/supervisar/${campaign.id}`}
            className="block rounded-lg border border-system-200 bg-white p-5 shadow-sm transition-shadow hover:border-brand-600 hover:shadow-md"
          >
            <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h2>
              {campaign.supervision === "mia" ? <Tag tone="ok">La supervisas tú</Tag> : <Tag tone="warn">Disponible</Tag>}
            </div>
            <p className="text-[12.5px] text-system-500">
              {campaign.creatorName || "Usuario"} · {campaign.tag || "Sin temática"} · meta {campaign.goalContributions} aportes
            </p>
          </Link>
        ))
      )}
    </div>
  );

  // Supervisadas en dos bloques (2026-10-16): las que supervisa el SuperUsuario y las de los supervisores.
  const renderSupervisedList = () => (
    <div className="space-y-4">
      {renderBloqueDeSupervisadas(
        "Supervisadas por ti",
        todasSupervisadas.filter((c) => c.supervision === "mia"),
        supervisadas.filter((c) => c.supervision === "mia"),
        "Todavía no supervisas ninguna campaña aceptada.",
      )}
      {renderBloqueDeSupervisadas(
        "Supervisadas por otros supervisores",
        todasSupervisadas.filter((c) => c.supervision !== "mia"),
        supervisadas.filter((c) => c.supervision !== "mia"),
        "Ningún supervisor tiene campañas aceptadas todavía.",
      )}
    </div>
  );

  const renderBloqueDeSupervisadas = (
    titulo: string,
    todas: CampanaSupervisable[],
    filtradas: CampanaSupervisable[],
    vacio: string,
  ) => (
    <div className="overflow-hidden rounded-lg border border-system-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-system-200 bg-system-100 px-4 py-3">
        <h2 className="text-[13px] font-semibold text-system-900">{titulo}</h2>
        <Tag tone="ok">{todas.length}</Tag>
      </div>

      {filtradas.length === 0 ? (
        <div className="p-5 text-[13px] text-system-600">{avisoSinResultados(todas.length, vacio)}</div>
      ) : (
        <div className="divide-y divide-system-200">
          {filtradas.map((campaign) => (
            <div key={campaign.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h3>
                  <p className="text-[12.5px] text-system-500">
                    {campaign.tag || "Sin temática"}
                    {campaign.supervision !== "mia" && ` · supervisa ${campaign.supervisadaPor ?? "nadie"}`}
                  </p>
                </div>
                <Tag tone={campaign.status === "activa" ? "ok" : campaign.status === "pausada" ? "default" : "warn"}>
                  {campaign.status === "activa" ? "Activa" : campaign.status === "pausada" ? "Pausada" : "Aceptada"}
                </Tag>
              </div>

              <div className="flex items-center justify-between gap-4 text-[12px] text-system-600">
                <span>Progreso</span>
                <span className="font-mono">{campaign.approvedContributions} / {campaign.goalContributions}</span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-pill bg-system-100">
                <div className="h-full rounded-pill bg-success-700" style={{ width: porcentaje(campaign) }} />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-system-600">
                <span>{campaign.participants} participantes</span>
                <Link href={`/supervisar/${campaign.id}`} className="font-bold text-brand-600">Ver detalle</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Reportadas/rechazadas y finalizadas también en dos bloques (2026-10-16), con renglones iguales:
  // nombre, creador, temática, quién supervisa (solo en las de otros), etiqueta y "Ver detalle".
  const renderBloqueSencillo = (
    titulo: string,
    todas: CampanaSupervisable[],
    filtradas: CampanaSupervisable[],
    vacio: string,
    etiqueta: (campaign: CampanaSupervisable) => React.ReactNode,
    tonoDelContador: "danger" | "default",
  ) => (
    <div className="overflow-hidden rounded-lg border border-system-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-system-200 bg-system-100 px-4 py-3">
        <h2 className="text-[13px] font-semibold text-system-900">{titulo}</h2>
        <Tag tone={tonoDelContador}>{todas.length}</Tag>
      </div>

      {filtradas.length === 0 ? (
        <div className="p-5 text-[13px] text-system-600">{avisoSinResultados(todas.length, vacio)}</div>
      ) : (
        <div className="divide-y divide-system-200">
          {filtradas.map((campaign) => (
            <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h3 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h3>
                <p className="text-[12.5px] text-system-500">
                  {campaign.creatorName || "Usuario"} · {campaign.tag || "Sin temática"}
                  {campaign.supervision !== "mia" && ` · supervisa ${campaign.supervisadaPor ?? "nadie"}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {etiqueta(campaign)}
                <Link href={`/supervisar/${campaign.id}`} className="font-bold text-brand-600">Ver detalle</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const etiquetaDeIncidencia = (campaign: CampanaSupervisable) =>
    campaign.latestSupervisionAction === "reportada" ? <Tag tone="warn">Reportada</Tag> : <Tag tone="danger">Rechazada</Tag>;

  const renderFlaggedList = () => (
    <div className="space-y-4">
      {renderBloqueSencillo(
        "Supervisadas por ti",
        todasConIncidencia.filter((c) => c.supervision === "mia"),
        conIncidencia.filter((c) => c.supervision === "mia"),
        "No hay campañas reportadas o rechazadas que supervises tú.",
        etiquetaDeIncidencia,
        "danger",
      )}
      {renderBloqueSencillo(
        "Supervisadas por otros supervisores",
        todasConIncidencia.filter((c) => c.supervision !== "mia"),
        conIncidencia.filter((c) => c.supervision !== "mia"),
        "No hay campañas reportadas o rechazadas de otros supervisores.",
        etiquetaDeIncidencia,
        "danger",
      )}
    </div>
  );

  const renderFinishedList = () => (
    <div className="space-y-4">
      {renderBloqueSencillo(
        "Supervisadas por ti",
        todasFinalizadas.filter((c) => c.supervision === "mia"),
        finalizadas.filter((c) => c.supervision === "mia"),
        "Todavía no hay campañas finalizadas que hayas supervisado tú.",
        () => <Tag>Finalizada</Tag>,
        "default",
      )}
      {renderBloqueSencillo(
        "Supervisadas por otros supervisores",
        todasFinalizadas.filter((c) => c.supervision !== "mia"),
        finalizadas.filter((c) => c.supervision !== "mia"),
        "Todavía no hay campañas finalizadas de otros supervisores.",
        () => <Tag>Finalizada</Tag>,
        "default",
      )}
    </div>
  );

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "pending", label: "Por supervisar", count: todasPendientes.length },
    { key: "supervised", label: "Campañas supervisadas", count: todasSupervisadas.length },
    { key: "flagged", label: "Campañas reportadas / rechazadas", count: todasConIncidencia.length },
    { key: "finished", label: "Campañas finalizadas", count: todasFinalizadas.length },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Modo supervisor · SuperUsuario</p>
          <h1 className="mt-2 text-2xl font-extrabold text-system-900">
            {activeTab === "pending" ? "Campañas por supervisar" : activeTab === "supervised" ? "Campañas supervisadas" : activeTab === "finished" ? "Campañas finalizadas" : "Campañas reportadas / rechazadas"}
          </h1>
          <p className="mt-1 text-[13px] text-system-600">
            {activeTab === "pending" ? `${pendientes.length} esperando revisión` : activeTab === "supervised" ? `${supervisadas.length} bajo supervisión` : activeTab === "finished" ? `${finalizadas.length} finalizadas` : `${conIncidencia.length} con incidencia`}
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-label="Categorías de supervisión"
        className="dashboard-nav mb-5 w-full min-w-0 max-w-full touch-pan-x flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
      >
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            aria-pressed={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${
              activeTab === key ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
            }`}
          >
            {label}&nbsp; <span className="font-mono text-[11px]">{count}</span>
          </button>
        ))}
      </div>

      <BarraDeFiltros
        valores={filtros}
        tematicas={tematicas}
        etiquetasPorTematica={etiquetasDelFiltro}
        onCambiar={cambiarFiltro}
        colapsableEnMovil
      />

      {activeTab === "pending" ? renderPendingList() : activeTab === "supervised" ? renderSupervisedList() : activeTab === "finished" ? renderFinishedList() : renderFlaggedList()}
    </div>
  );
}
