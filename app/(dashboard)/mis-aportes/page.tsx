"use client";

// Pantalla /mis-aportes: agrupa tus aportes por campaña y permite desplegar su lista.
// Componente cliente. Los grupos vienen de GET /api/campanas?misAportes=true y cada lista de
// GET /api/aportes?campaignId=&mine=true. El historial completo sigue disponible por campaña.

import { useEffect, useState } from "react";
import ButtonLink from "@/components/ui/ButtonLink";
import ContributionCard from "@/components/cards/ContributionCard";
import { EsqueletoDeTarjetas } from "@/components/ui/Esqueletos";
import type { Campaign, Contribution } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

export default function MisAportesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loadingContributions, setLoadingContributions] = useState(false);
  const [contributionsError, setContributionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recarga = useRecargaEnVivo();
  useEffect(() => {
    let active = true;

    async function loadCampaigns() {
      try {
        const response = await fetch(`${BASE_PATH}/api/campanas?misAportes=true`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar tus campañas");
        if (active) setCampaigns(Array.isArray(payload.data) ? payload.data as Campaign[] : []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus campañas");
      } finally {
        if (active) setCargando(false);
      }
    }

    void loadCampaigns();
    return () => {
      active = false;
    };
  }, [recarga]);

  const contributedCampaigns = campaigns.filter((campaign) => (campaign.myContributionsCount ?? 0) > 0);
  const expandedCampaign = contributedCampaigns.find((campaign) => campaign.id === expandedCampaignId);
  const canAddContribution = expandedCampaign
    && !expandedCampaign.isMine
    && expandedCampaign.status === "activa"
    && (expandedCampaign.myContributionsCount ?? 0) < expandedCampaign.quotaPerUser
    && !expandedCampaign.isBanned;

  useEffect(() => {
    const campaign = campaigns.find((item) => item.id === expandedCampaignId);
    if (!campaign) return;
    let active = true;

    async function loadContributions(campaignId: string, campaignName: string) {
      setLoadingContributions(true);
      setContributionsError(null);
      try {
        const response = await fetch(
          `${BASE_PATH}/api/aportes?campaignId=${encodeURIComponent(campaignId)}&mine=true`,
          { cache: "no-store" }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar tus aportes");
        if (active) {
          setContributions(
            (Array.isArray(payload.data) ? payload.data as Contribution[] : []).map((contribution) => ({
              ...contribution,
              campaignId,
              campaignName,
            }))
          );
        }
      } catch (cause) {
        if (active) setContributionsError(cause instanceof Error ? cause.message : "No se pudieron cargar tus aportes");
      } finally {
        if (active) setLoadingContributions(false);
      }
    }

    void loadContributions(campaign.id, campaign.name);
    return () => {
      active = false;
    };
  }, [campaigns, expandedCampaignId, recarga]);

  function toggleCampaign(campaignId: string) {
    setExpandedCampaignId((current) => current === campaignId ? null : campaignId);
    setContributions([]);
    setContributionsError(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mis aportes</h1>
          <p className="mt-1 text-[13px] text-system-600 max-md:text-[12px] max-md:leading-5">
            Tus aportes están agrupados por campaña. Selecciona una para ver la lista.
          </p>
        </div>
        <ButtonLink href="/campanas" variant="primary" size="sm" className="whitespace-nowrap max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px]">
          Explorar campañas
        </ButtonLink>
      </div>

      {error ? (
        <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p>
      ) : cargando ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando tus aportes…</span>
          <EsqueletoDeTarjetas cantidad={4} columnas={2} />
        </div>
      ) : contributedCampaigns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">
          Todavía no has enviado aportes. Cuando participes en una campaña, tus aportes aparecerán aquí agrupados por campaña.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {contributedCampaigns.map((campaign) => {
            const expanded = campaign.id === expandedCampaignId;
            const listId = `aportes-campana-${campaign.id}`;
            return (
              <section key={campaign.id} className="overflow-hidden rounded-lg border border-system-200 bg-white">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={listId}
                  onClick={() => toggleCampaign(campaign.id)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-system-50 max-md:p-3.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold text-system-900 max-md:text-[14px]">
                      {campaign.name}
                    </span>
                    <span className="mt-1 block text-[12.5px] text-system-600">
                      {campaign.myContributionsCount} {campaign.myContributionsCount === 1 ? "aporte enviado" : "aportes enviados"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-brand-700">
                    {expanded ? "Ocultar aportes −" : "Ver aportes +"}
                  </span>
                </button>
                <div id={listId} hidden={!expanded} className="border-t border-system-200 p-4 max-md:p-3.5">
                  {expanded && (
                    contributionsError ? (
                      <p role="alert" className="rounded-lg bg-error-50 p-3 text-sm text-error-700">
                        {contributionsError}
                      </p>
                    ) : loadingContributions ? (
                      <p role="status" className="text-sm text-system-600">Cargando tus aportes…</p>
                    ) : contributions.length === 0 ? (
                      <p className="text-sm text-system-600">No hay aportes para mostrar en esta campaña.</p>
                    ) : (
                      <>
                        <div role="list" aria-label={`Tus aportes en ${campaign.name}`} className="flex flex-col gap-3">
                          {contributions.map((contribution) => (
                            <div key={contribution.id} role="listitem">
                              <ContributionCard contribution={contribution} />
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <ButtonLink href={`/mis-aportes/${campaign.id}`} size="sm">
                            Abrir historial completo
                          </ButtonLink>
                          {canAddContribution && (
                            <ButtonLink href={`/campanas/${campaign.id}/aportar`} variant="primary" size="sm">
                              Añadir aporte
                            </ButtonLink>
                          )}
                        </div>
                      </>
                    )
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
