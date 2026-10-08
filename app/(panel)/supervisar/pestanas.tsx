"use client";

// Pestañas de /supervisar (por revisar / supervisadas) con la barra de filtros de
// components/campanas/BarraDeFiltros.tsx, aplicada en el navegador (lib/campanas/filtro-local.ts).

import Link from "next/link";
import { useMemo, useState } from "react";
import Tag from "@/components/ui/Tag";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import { FILTROS_VACIOS, avisoSinResultados, filtrarCampanas, opcionesDeTematica, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import type { CampanaSupervisable } from "@/lib/supervision/root";

type TabKey = "pending" | "supervised" | "finished" | "flagged";

const tematicaDe = (campaign: CampanaSupervisable) => campaign.tag;

function porcentaje(campaign: CampanaSupervisable) {
  return campaign.goalContributions > 0
    ? `${Math.min(100, Math.round((campaign.currentContributions / campaign.goalContributions) * 100))}%`
    : "0%";
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
    setFiltros((actuales) => ({ ...actuales, [clave]: valor }));
  }

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

  const renderSupervisedList = () => (
    <div className="overflow-hidden rounded-lg border border-system-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-system-200 bg-system-100 px-4 py-3">
        <p className="text-[13px] font-semibold text-system-900">Campañas que estás supervisando</p>
        <Tag tone="ok">{todasSupervisadas.length}</Tag>
      </div>

      {supervisadas.length === 0 ? (
        <div className="p-5 text-[13px] text-system-600">{avisoSinResultados(todasSupervisadas.length, "Todavía no tienes campañas aceptadas bajo supervisión.")}</div>
      ) : (
        <div className="divide-y divide-system-200">
          {supervisadas.map((campaign) => (
            <div key={campaign.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h3>
                  <p className="text-[12.5px] text-system-500">{campaign.tag || "Sin temática"}</p>
                </div>
                <Tag tone={campaign.status === "activa" ? "ok" : "warn"}>{campaign.status === "activa" ? "Activa" : "Aceptada"}</Tag>
              </div>

              <div className="flex items-center justify-between gap-4 text-[12px] text-system-600">
                <span>Progreso</span>
                <span className="font-mono">{campaign.currentContributions} / {campaign.goalContributions}</span>
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

  const renderFlaggedList = () => (
    <div className="overflow-hidden rounded-lg border border-system-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-system-200 bg-system-100 px-4 py-3">
        <p className="text-[13px] font-semibold text-system-900">Campañas reportadas o rechazadas</p>
        <Tag tone="danger">{todasConIncidencia.length}</Tag>
      </div>

      {conIncidencia.length === 0 ? (
        <div className="p-5 text-[13px] text-system-600">{avisoSinResultados(todasConIncidencia.length, "No tienes campañas reportadas o rechazadas.")}</div>
      ) : (
        <div className="divide-y divide-system-200">
          {conIncidencia.map((campaign) => {
            const isReported = campaign.latestSupervisionAction === "reportada";
            return (
              <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <h3 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h3>
                  <p className="text-[12.5px] text-system-500">
                    {campaign.creatorName || "Usuario"} · {campaign.tag || "Sin temática"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Tag tone={isReported ? "warn" : "danger"}>{isReported ? "Reportada" : "Rechazada"}</Tag>
                  <Link href={`/supervisar/${campaign.id}`} className="font-bold text-brand-600">Ver detalle</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderFinishedList = () => (
    <div className="overflow-hidden rounded-lg border border-system-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-system-200 bg-system-100 px-4 py-3">
        <p className="text-[13px] font-semibold text-system-900">Campañas finalizadas</p>
        <Tag>{todasFinalizadas.length}</Tag>
      </div>

      {finalizadas.length === 0 ? (
        <div className="p-5 text-[13px] text-system-600">{avisoSinResultados(todasFinalizadas.length, "Todavía no tienes campañas finalizadas.")}</div>
      ) : (
        <div className="divide-y divide-system-200">
          {finalizadas.map((campaign) => (
            <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h3 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h3>
                <p className="text-[12.5px] text-system-500">
                  {campaign.creatorName || "Usuario"} · {campaign.tag || "Sin temática"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Tag>Finalizada</Tag>
                <Link href={`/supervisar/${campaign.id}`} className="font-bold text-brand-600">Ver detalle</Link>
              </div>
            </div>
          ))}
        </div>
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
        onCambiar={cambiarFiltro}
        colapsableEnMovil
      />

      {activeTab === "pending" ? renderPendingList() : activeTab === "supervised" ? renderSupervisedList() : activeTab === "finished" ? renderFinishedList() : renderFlaggedList()}
    </div>
  );
}
