"use client";

// Pantalla /supervision: campañas en revisión que puedes tomar y las que ya supervisas.
// Componente cliente. Datos: GET /api/campanas, GET /api/campanas?supervised=true y GET /api/auth/sesion.
// Filtros y categorías: components/campanas/BarraDeFiltros.tsx; aplicados en el navegador
// con lib/campanas/filtro-local.ts.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Tag from "@/components/ui/Tag";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import { BASE_PATH } from "@/lib/base-path";
import { FILTROS_VACIOS, avisoSinResultados, filtrarCampanas, opcionesDeTematica, type FiltrosLocales } from "@/lib/campanas/filtro-local";

type CampaignApiItem = {
  id: string;
  creatorId: string;
  supervisorId?: string | null;
  supervisedByRoot?: boolean;
  creatorName: string;
  name: string;
  tag?: string;
  tematica?: string;
  status: string;
  latestSupervisionAction?: "aceptada" | "rechazada" | "reportada" | "reasignada" | null;
  currentContributions?: number;
  goalContributions?: number;
  participants?: number;
  dataTypes?: string[];
  endDate?: string | null;
};

const tematicaDe = (campaign: CampaignApiItem) => String(campaign.tag ?? campaign.tematica ?? "").trim();

type TabKey = "pending" | "supervised" | "finished" | "flagged";

export default function SupervisionPage() {
  const [pendingCampaigns, setPendingCampaigns] = useState<CampaignApiItem[]>([]);
  const [supervisedCampaigns, setSupervisedCampaigns] = useState<CampaignApiItem[]>([]);
  const [finishedCampaigns, setFinishedCampaigns] = useState<CampaignApiItem[]>([]);
  const [flaggedCampaigns, setFlaggedCampaigns] = useState<CampaignApiItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [filtros, setFiltros] = useState<FiltrosLocales>(FILTROS_VACIOS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [campaignsResponse, supervisedResponse, sessionResponse] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/campanas?supervised=true`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" }),
        ]);

        if (!campaignsResponse.ok) {
          throw new Error("No se pudieron cargar las campañas");
        }

        if (!supervisedResponse.ok) {
          throw new Error("No se pudieron cargar las campañas supervisadas");
        }

        const campaignsPayload = await campaignsResponse.json();
        const supervisedPayload = await supervisedResponse.json();
        const sessionPayload = await sessionResponse.json().catch(() => ({ data: null }));
        const userId = sessionPayload?.data?.id ? String(sessionPayload.data.id) : null;

        const rows = Array.isArray(campaignsPayload?.data) ? campaignsPayload.data : [];
        const supervisedRows = Array.isArray(supervisedPayload?.data) ? supervisedPayload.data : [];
        const visible = rows.filter((campaign: CampaignApiItem) => {
          const isPending = String(campaign.status ?? "") === "en_revision";
          const isOwn = userId !== null && String(campaign.creatorId ?? "") === userId;
          // Solo las libres (cualquiera puede tomarlas) o las que ya tomó este
          // supervisor: una campaña tiene un único supervisor.
          const isFree = !campaign.supervisorId && !campaign.supervisedByRoot;
          const isMine = userId !== null && String(campaign.supervisorId ?? "") === userId;
          return isPending && !isOwn && (isFree || isMine);
        });

        setPendingCampaigns(visible);
        const supervised = supervisedRows as CampaignApiItem[];
        setSupervisedCampaigns(supervised.filter((campaign) => {
          const status = String(campaign.status ?? "");
          return status === "activa" || status === "aceptada";
        }));
        setFinishedCampaigns(supervised.filter((campaign) => String(campaign.status ?? "") === "finalizada"));
        setFlaggedCampaigns(supervised.filter((campaign) =>
          campaign.latestSupervisionAction === "reportada" || String(campaign.status ?? "") === "rechazada"
        ));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const pendingCount = useMemo(() => pendingCampaigns.length, [pendingCampaigns]);
  const supervisedCount = useMemo(() => supervisedCampaigns.length, [supervisedCampaigns]);
  const finishedCount = useMemo(() => finishedCampaigns.length, [finishedCampaigns]);
  const flaggedCount = useMemo(() => flaggedCampaigns.length, [flaggedCampaigns]);

  function renderCategoryTabs(selectedTab: TabKey, onSelect: (tab: TabKey) => void) {
    const tabs: { key: TabKey; label: string; count: number }[] = [
      { key: "pending", label: "Por supervisar", count: pendingCount },
      { key: "supervised", label: "Campañas supervisadas", count: supervisedCount },
      { key: "flagged", label: "Campañas reportadas / rechazadas", count: flaggedCount },
      { key: "finished", label: "Campañas finalizadas", count: finishedCount },
    ];

    return (
      <div
        role="group"
        aria-label="Categorías de supervisión"
        tabIndex={0}
        className="dashboard-nav w-full min-w-0 max-w-full touch-pan-x flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
      >
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            aria-pressed={selectedTab === key}
            onClick={() => onSelect(key)}
            className={`shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${selectedTab === key ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"}`}
          >
            {label}&nbsp; <span className="font-mono text-[11px]">{count}</span>
          </button>
        ))}
      </div>
    );
  }

  const themeOptions = useMemo(
    () => opcionesDeTematica([...pendingCampaigns, ...supervisedCampaigns, ...finishedCampaigns, ...flaggedCampaigns].map(tematicaDe)),
    [pendingCampaigns, supervisedCampaigns, finishedCampaigns, flaggedCampaigns]
  );

  function cambiarFiltro(clave: keyof ValoresDeFiltros, valor: string) {
    setFiltros((actuales) => ({ ...actuales, [clave]: valor }));
  }

  const filteredPendingCampaigns = useMemo(
    () => filtrarCampanas(pendingCampaigns, filtros, tematicaDe),
    [pendingCampaigns, filtros]
  );

  const filteredSupervisedCampaigns = useMemo(
    () => filtrarCampanas(supervisedCampaigns, filtros, tematicaDe),
    [supervisedCampaigns, filtros]
  );

  const filteredFinishedCampaigns = useMemo(
    () => filtrarCampanas(finishedCampaigns, filtros, tematicaDe),
    [finishedCampaigns, filtros]
  );

  const filteredFlaggedCampaigns = useMemo(
    () => filtrarCampanas(flaggedCampaigns, filtros, tematicaDe),
    [flaggedCampaigns, filtros]
  );

  const renderPendingList = () => (
    <div className="space-y-3">
      {filteredPendingCampaigns.length === 0 ? (
        <div className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">
          {avisoSinResultados(pendingCampaigns.length, "No hay campañas pendientes por revisar.")}
        </div>
      ) : (
        filteredPendingCampaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/supervision/${campaign.id}`}
            className="block rounded-lg border border-system-200 bg-white p-5 shadow-sm transition-shadow hover:border-brand-600 hover:shadow-md"
          >
            <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h2>
              {campaign.supervisorId ? <Tag tone="ok">La supervisas tú</Tag> : <Tag tone="warn">Disponible</Tag>}
            </div>
            <p className="text-[12.5px] text-system-400">
              {(campaign.creatorName || "Usuario")} · {(campaign.tag || campaign.tematica || "Sin temática")} · meta {Number(campaign.goalContributions ?? 0)} aportes
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
        <Tag tone="ok">{supervisedCount}</Tag>
      </div>

      {filteredSupervisedCampaigns.length === 0 ? (
        <div className="p-5 text-[13px] text-system-600">{avisoSinResultados(supervisedCampaigns.length, "Todavía no tienes campañas aceptadas bajo supervisión.")}</div>
      ) : (
        <div className="divide-y divide-system-200">
          {filteredSupervisedCampaigns.map((campaign) => {
            const progress = Number(campaign.goalContributions ?? 0) > 0
              ? `${Number(campaign.currentContributions ?? 0)} / ${Number(campaign.goalContributions ?? 0)}`
              : "0 / 0";
            const percent = Number(campaign.goalContributions ?? 0) > 0
              ? `${Math.min(100, Math.round((Number(campaign.currentContributions ?? 0) / Number(campaign.goalContributions ?? 1)) * 100))}%`
              : "0%";

            return (
              <div key={campaign.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h3>
                    <p className="text-[12.5px] text-system-400">{campaign.tag || campaign.tematica || "Sin temática"}</p>
                  </div>
                  <Tag tone={campaign.status === "activa" ? "ok" : "warn"}>{campaign.status === "activa" ? "Activa" : "Aceptada"}</Tag>
                </div>

                <div className="flex items-center justify-between gap-4 text-[12px] text-system-600">
                  <span>Progreso</span>
                  <span className="font-mono">{progress}</span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-pill bg-system-100">
                  <div className="h-full rounded-pill bg-success-700" style={{ width: percent }} />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-system-600">
                  <span>{Number(campaign.participants ?? 0)} participantes</span>
                  <Link href={`/supervision/${campaign.id}`} className="font-bold text-brand-600">Ver detalle</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderFlaggedList = () => (
    <div className="overflow-hidden rounded-lg border border-system-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-system-200 bg-system-100 px-4 py-3">
        <p className="text-[13px] font-semibold text-system-900">Campañas reportadas o rechazadas</p>
        <Tag tone="danger">{flaggedCount}</Tag>
      </div>

      {filteredFlaggedCampaigns.length === 0 ? (
        <div className="p-5 text-[13px] text-system-600">{avisoSinResultados(flaggedCampaigns.length, "No tienes campañas reportadas o rechazadas.")}</div>
      ) : (
        <div className="divide-y divide-system-200">
          {filteredFlaggedCampaigns.map((campaign) => {
            const isReported = campaign.latestSupervisionAction === "reportada";
            return (
              <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <h3 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h3>
                  <p className="text-[12.5px] text-system-400">
                    {campaign.creatorName || "Usuario"} · {campaign.tag || campaign.tematica || "Sin temática"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Tag tone={isReported ? "warn" : "danger"}>{isReported ? "Reportada" : "Rechazada"}</Tag>
                  <Link href={`/supervision/${campaign.id}`} className="font-bold text-brand-600">Ver detalle</Link>
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
        <Tag>{finishedCount}</Tag>
      </div>

      {filteredFinishedCampaigns.length === 0 ? (
        <div className="p-5 text-[13px] text-system-600">{avisoSinResultados(finishedCampaigns.length, "Todavía no tienes campañas finalizadas.")}</div>
      ) : (
        <div className="divide-y divide-system-200">
          {filteredFinishedCampaigns.map((campaign) => (
            <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h3 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h3>
                <p className="text-[12.5px] text-system-400">
                  {campaign.creatorName || "Usuario"} · {campaign.tag || campaign.tematica || "Sin temática"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Tag>Finalizada</Tag>
                <Link href={`/supervision/${campaign.id}`} className="font-bold text-brand-600">Ver detalle</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="mx-auto max-w-4xl text-[13px] text-system-600 lg:mx-0 lg:max-w-none">Cargando campañas por supervisar…</div>;
  }

  if (error) {
    return <div className="mx-auto max-w-4xl rounded-lg border border-error-700/30 bg-error-50 p-4 text-sm text-error-700 lg:mx-0 lg:max-w-none">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl lg:mx-0 lg:max-w-none">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="w-full min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Supervisión</p>
          <div className="mt-3 w-full min-w-0">{renderCategoryTabs(activeTab, setActiveTab)}</div>
          <p className="mt-1 text-[13px] text-system-600">
            {activeTab === "pending" ? `${filteredPendingCampaigns.length} esperando revisión` : activeTab === "supervised" ? `${filteredSupervisedCampaigns.length} bajo supervisión` : activeTab === "finished" ? `${filteredFinishedCampaigns.length} finalizadas` : `${filteredFlaggedCampaigns.length} con incidencia`}
          </p>
        </div>
      </div>

      <BarraDeFiltros
        valores={filtros}
        tematicas={themeOptions}
        onCambiar={cambiarFiltro}
        colapsableEnMovil
      />

      {activeTab === "pending" ? renderPendingList() : activeTab === "supervised" ? renderSupervisedList() : activeTab === "finished" ? renderFinishedList() : renderFlaggedList()}
    </div>
  );
}
