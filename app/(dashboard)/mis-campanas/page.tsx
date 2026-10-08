"use client";

// Pantalla /mis-campanas: campañas que creaste, con filtros por estado.
// Componente cliente. Datos: GET /api/campanas?mine=true.
// Acción: "Finalizar" con PATCH /api/campanas/[id] { status: "finalizada" } (activa o pausada).

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Tag from "@/components/ui/Tag";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Campaign, CampaignStatus } from "@/types";
import { BASE_PATH } from "@/lib/base-path";

const labels: Record<CampaignStatus, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aceptada: "Aceptada",
  activa: "Activa",
  pausada: "Pausada",
  finalizada: "Finalizada",
  rechazada: "Rechazada",
};

type Filtro = "todas" | CampaignStatus;

const FILTROS: { valor: Filtro; etiqueta: string; fijo?: boolean }[] = [
  { valor: "todas", etiqueta: "Todas", fijo: true },
  { valor: "en_revision", etiqueta: "En revisión", fijo: true },
  { valor: "aceptada", etiqueta: "Aceptadas", fijo: true },
  { valor: "activa", etiqueta: "Activas", fijo: true },
  { valor: "pausada", etiqueta: "Pausadas" },
  { valor: "finalizada", etiqueta: "Finalizadas", fijo: true },
  { valor: "rechazada", etiqueta: "Rechazadas" },
  { valor: "borrador", etiqueta: "Borradores" },
];

function mapCampaign(row: Record<string, unknown>): Campaign {
  const status = String(row.status ?? "borrador") as CampaignStatus;
  return {
    id: String(row.id ?? ""),
    creatorId: String(row.creatorId ?? ""),
    creatorName: String(row.creatorName ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    tag: String(row.tag ?? ""),
    tematica: String(row.tematica ?? ""),
    status: labels[status] ? status : "borrador",
    dataTypes: Array.isArray(row.dataTypes) ? (row.dataTypes as Campaign["dataTypes"]) : [],
    goalContributions: Number(row.goalContributions ?? 0),
    quotaPerUser: Number(row.quotaPerUser ?? 1),
    currentContributions: Number(row.currentContributions ?? 0),
    approvedContributions: Number(row.approvedContributions ?? 0),
    pendingContributions: Number(row.pendingContributions ?? 0),
    rejectedContributions: Number(row.rejectedContributions ?? 0),
    participants: Number(row.participants ?? 0),
    startDate: row.startDate as string | null,
    endDate: row.endDate as string | null,
    locationCity: String(row.locationCity ?? ""),
    locationState: String(row.locationState ?? ""),
    xpPerContribution: Number(row.xpPerContribution ?? 0),
    daysRemaining: row.daysRemaining as number | null,
    hasReviewerAssigned: Boolean(row.hasReviewerAssigned),
  };
}

export default function MisCampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finalizandoId, setFinalizandoId] = useState<string | null>(null);
  const [finalizarError, setFinalizarError] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  useEffect(() => {
    void fetch(`${BASE_PATH}/api/campanas?mine=true`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        setCampaigns(
          (Array.isArray(payload.data) ? payload.data : []).map((item: unknown) =>
            mapCampaign(item as Record<string, unknown>)
          )
        );
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas"))
      .finally(() => setCargando(false));
  }, []);

  const count = (status: CampaignStatus) => campaigns.filter((campaign) => campaign.status === status).length;
  // Los estados fijos siempre se ven; el resto solo si hay alguna campaña en él.
  const filtros = FILTROS.filter((f) => f.fijo || (f.valor !== "todas" && count(f.valor) > 0));
  const visibles = filtro === "todas" ? campaigns : campaigns.filter((campaign) => campaign.status === filtro);

  // Solo el creador ve esta pantalla (viene de mine=true): no hace falta
  // revisar rol ni dueño aparte, ya está filtrado por sesión.
  async function finalizarCampana(id: string) {
    if (!window.confirm("¿Finalizar esta campaña? Dejará de aceptar aportes nuevos.")) return;

    setFinalizandoId(id);
    setFinalizarError((prev) => ({ ...prev, [id]: "" }));
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "finalizada" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo finalizar la campaña");
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: "finalizada" } : c)));
    } catch (cause) {
      setFinalizarError((prev) => ({
        ...prev,
        [id]: cause instanceof Error ? cause.message : "No se pudo finalizar la campaña",
      }));
    } finally {
      setFinalizandoId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl lg:mx-0 lg:max-w-none">
      <div className="mb-2 flex items-start justify-between gap-4 max-md:gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mis campañas</h1>
          <p className="mt-1 text-[13px] text-system-600 max-md:text-[12px] max-md:leading-5">Administra las campañas que has creado.</p>
        </div>
        <ButtonLink
          href="/mis-campanas/nueva"
          variant="primary"
          size="sm"
          className="whitespace-nowrap max-md:max-w-[126px] max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px] max-md:leading-4"
        >
          Nueva campaña
        </ButtonLink>
      </div>

      <div
        className="dashboard-nav mb-5 mt-4 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:gap-1.5 md:flex-wrap md:overflow-visible md:pb-0"
        role="group"
        aria-label="Filtrar por estado"
      >
        {filtros.map((f) => {
          const activo = filtro === f.valor;
          const total = f.valor === "todas" ? campaigns.length : count(f.valor);
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => setFiltro(f.valor)}
              className={`shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${
                activo ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
              }`}
            >
              {f.etiqueta} <span className="font-mono text-[11.5px] opacity-80">{total}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p>
      ) : cargando ? (
        <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">Cargando tus campañas…</p>
      ) : campaigns.length === 0 ? (
        <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">Todavía no has creado campañas.</p>
      ) : visibles.length === 0 ? (
        <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">No tienes campañas en este estado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibles.map((campaign) => {
            const pct = campaign.goalContributions
              ? Math.min(100, Math.round((campaign.currentContributions / campaign.goalContributions) * 100))
              : 0;
            const puedeFinalizar = campaign.status === "activa" || campaign.status === "pausada";

            return (
              <div key={campaign.id} className="rounded-lg border border-system-200 bg-white p-4 max-md:p-3.5">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-[13.5px] font-medium text-system-900 max-md:text-[13px]">{campaign.name}</p>
                  <Tag tone={campaign.status === "activa" ? "ok" : campaign.status === "aceptada" ? "warn" : "default"}>{labels[campaign.status]}</Tag>
                </div>
                <p className="mb-2.5 font-mono text-[11.5px] text-system-600 max-md:text-[10.5px]">
                  {campaign.startDate ?? "Sin fecha"} - {campaign.endDate ?? "Sin fecha"}
                </p>
                <ProgressBar
                  pct={campaign.status === "finalizada" ? 100 : pct}
                  tone={campaign.status === "finalizada" ? "ok" : "accent"}
                />
                <p className="my-2.5 font-mono text-[12px] text-system-600 max-md:text-[11px]">
                  {campaign.currentContributions} / {campaign.goalContributions} - {campaign.pendingContributions} aportes pendientes
                </p>
                <div className="flex flex-wrap gap-1.5 max-md:gap-1">
                  <ButtonLink href={`/mis-campanas/${campaign.id}/aportes`} variant="primary" size="sm" className="max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Revisar aportes</ButtonLink>
                  <ButtonLink href={`/mis-campanas/${campaign.id}/panel`} size="sm" className="max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Panel</ButtonLink>
                  <ButtonLink href={`/mis-campanas/nueva?edit=${campaign.id}`} size="sm" className="max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Editar</ButtonLink>
                  {puedeFinalizar && (
                    <Button
                      size="sm"
                      variant="danger"
                      className="max-md:px-2 max-md:py-1.5 max-md:text-[11px]"
                      disabled={finalizandoId === campaign.id}
                      onClick={() => finalizarCampana(campaign.id)}
                    >
                      {finalizandoId === campaign.id ? "Finalizando..." : "Finalizar campaña"}
                    </Button>
                  )}
                </div>
                {finalizarError[campaign.id] && (
                  <p className="mt-2 text-[11.5px] text-error-700">{finalizarError[campaign.id]}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
