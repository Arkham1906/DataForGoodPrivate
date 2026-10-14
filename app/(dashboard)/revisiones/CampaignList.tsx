"use client";

// Lista de campañas del revisor (pestañas "en curso" y "finalizadas").
// Datos: GET /api/revisiones (campañas con campana_revisores.estado = 'aceptado').
// Filtros (búsqueda, temática, tipo de dato y orden): components/campanas/BarraDeFiltros.tsx,
// aplicados en el navegador con lib/campanas/filtro-local.ts.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Tag from "@/components/ui/Tag";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import { BASE_PATH } from "@/lib/base-path";
import { FILTROS_VACIOS, avisoSinResultados, filtrarCampanas, opcionesDeTematica, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import { EsqueletoDeFilas } from "@/components/ui/Esqueletos";

type ReviewCampaign = {
  id: string;
  name: string;
  description: string;
  tag: string;
  participants: number;
  status: string;
  pendingContributions: number;
  currentContributions: number;
  goalContributions: number;
  creatorName: string;
  dataTypes: string[];
  endDate: string | null;
};

const tematicaDe = (campaign: ReviewCampaign) => campaign.tag;

export default function CampaignList({ completed = false }: { completed?: boolean }) {
  const [campaigns, setCampaigns] = useState<ReviewCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosLocales>(FILTROS_VACIOS);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${BASE_PATH}/api/revisiones`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        const rows = Array.isArray(payload.data) ? payload.data as ReviewCampaign[] : [];
        setCampaigns(rows);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [completed]);

  const activeTab = completed ? "finalizadas" : "curso";
  const title = completed ? "Campañas finalizadas" : "Campañas en curso";
  const currentCount = campaigns.filter((campaign) => campaign.status !== "finalizada").length;
  const completedCount = campaigns.filter((campaign) => campaign.status === "finalizada").length;
  const tabCampaigns = useMemo(
    () => campaigns.filter((campaign) => completed ? campaign.status === "finalizada" : campaign.status !== "finalizada"),
    [campaigns, completed]
  );
  const visibleCampaigns = useMemo(() => filtrarCampanas(tabCampaigns, filtros, tematicaDe), [tabCampaigns, filtros]);
  const tematicas = useMemo(() => opcionesDeTematica(campaigns.map(tematicaDe)), [campaigns]);

  function cambiarFiltro(clave: keyof ValoresDeFiltros, valor: string) {
    setFiltros((actuales) => ({ ...actuales, [clave]: valor }));
  }

  return (
    <div className="mx-auto max-w-5xl lg:mx-0 lg:max-w-none">
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Revisor de aportes</p>
        <h1 className="mt-2 text-2xl font-extrabold text-system-900">Mis campañas</h1>
        <p className="mt-1 text-[13px] text-system-600">Administra las campañas que tienes asignadas para revisar.</p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Estado de campañas">
        <Link href="/revisiones" className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${activeTab === "curso" ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"}`}>En curso {currentCount}</Link>
        <Link href="/revisiones/finalizadas" className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${activeTab === "finalizadas" ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"}`}>Finalizadas {completedCount}</Link>
      </nav>

      <BarraDeFiltros
        valores={filtros}
        tematicas={tematicas}
        onCambiar={cambiarFiltro}
        colapsableEnMovil
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-system-900">{title}</h2>
        {!loading && <Tag tone={completed ? "default" : "on"}>{visibleCampaigns.length}</Tag>}
      </div>

      {loading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando campañas…</span>
          <EsqueletoDeFilas cantidad={3} />
        </div>
      ) : error ? <p className="rounded border border-error-700 bg-error-50 p-3 text-sm text-error-700">{error}</p> : visibleCampaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">
          {avisoSinResultados(tabCampaigns.length, `No tienes campañas ${completed ? "finalizadas" : "en curso"} asignadas.`)}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleCampaigns.map((campaign) => (
            <Link key={campaign.id} href={`/revisiones/campanas/${campaign.id}`} className="block rounded-lg border border-system-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-600">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-[16px] font-extrabold text-system-900">{campaign.name}</h3>
                  <p className="mt-1 text-[12.5px] text-system-600">{campaign.tag || "Sin temática"} · {campaign.participants} participantes</p>
                  {campaign.description && <p className="mt-3 line-clamp-2 max-w-2xl text-[13px] leading-5 text-system-600">{campaign.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!completed && <Tag tone="warn">{campaign.pendingContributions} pendientes</Tag>}
                  <span className="text-[12.5px] font-bold text-brand-600">Abrir campaña →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
