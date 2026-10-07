"use client";

// Pantalla /mis-aportes: campañas en las que aportaste o que guardaste.
// Componente cliente. Datos: GET /api/campanas?misAportes=true. Filtros en el cliente.

import Link from "next/link";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";

export default function MisAportesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState("Todas");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const response = await fetch(`${BASE_PATH}/api/campanas?misAportes=true`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        setCampaigns(Array.isArray(payload.data) ? payload.data as Campaign[] : []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      }
    }
    void loadCampaigns();
  }, []);

  const cuotaCompleta = (campaign: Campaign) =>
    campaign.quotaPerUser > 0 && (campaign.myContributionsCount ?? 0) >= campaign.quotaPerUser;

  const visible = campaigns.filter((campaign) => {
    // Una campaña de la que lo banearon no cuenta como "puedo aportar".
    if (filter === "Puedo aportar") return campaign.status === "activa" && !cuotaCompleta(campaign) && !campaign.isBanned;
    if (filter === "Finalizadas") return campaign.status === "finalizada";
    if (filter === "Favoritos") return Boolean(campaign.isSaved);
    if (filter === "Cuota completa") return cuotaCompleta(campaign);
    return true;
  });

  return <div>
    <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
      <div><h1 className="text-2xl font-extrabold text-ink max-md:text-xl max-md:leading-tight">Mis aportes</h1><p className="mt-1 text-[13px] text-ink-2 max-md:max-w-[220px] max-md:text-[12px] max-md:leading-5">Campañas en las que ya aportaste o que guardaste para después.</p></div>
      <Link href="/campanas"><Button variant="primary" size="sm" className="whitespace-nowrap max-md:max-w-[126px] max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px] max-md:leading-4">Explorar campaña</Button></Link>
    </div>
    <div className="dashboard-nav mb-6 mt-4 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:mb-4 max-md:gap-1.5 md:flex-wrap md:overflow-visible md:pb-0" role="group" aria-label="Filtrar campañas">
      {["Todas", "Puedo aportar", "Cuota completa", "Finalizadas", "Favoritos"].map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={filter === item}
          onClick={() => setFilter(item)}
          className={`shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${filter === item ? "border-accent bg-accent text-white" : "border-line-2 bg-surface text-ink-2"}`}
        >
          {item}
        </button>
      ))}
    </div>
    {error ? <p className="rounded-lg bg-danger-tint p-4 text-sm text-danger">{error}</p> : visible.length === 0 ? <p className="rounded-lg border border-dashed border-line-2 p-6 text-sm text-ink-2">Todavía no aportaste ni guardaste ninguna campaña.</p> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{visible.map((campaign) => {
      const pct = campaign.goalContributions > 0 ? Math.min(100, Math.round(campaign.currentContributions / campaign.goalContributions * 100)) : 0;
      const canContribute = campaign.status === "activa" && !cuotaCompleta(campaign) && !campaign.isBanned;
      return <div key={campaign.id} className="rounded-lg border border-line bg-surface p-4 max-md:p-3.5"><div className="mb-1.5 flex items-start justify-between gap-2"><div><p className="text-[15px] font-bold text-ink max-md:text-[14px]">{campaign.name}</p><p className="text-[12.5px] text-ink-2 max-md:text-[11.5px]">{campaign.tag} · {[campaign.locationCity, campaign.locationState].filter(Boolean).join(", ")}</p></div>{campaign.isBanned ? <Tag tone="danger">Baneado</Tag> : <Tag tone={canContribute ? "ok" : "default"}>{canContribute ? "Activa" : campaign.status}</Tag>}</div><p className="mb-3 text-[12.5px] text-ink-2 max-md:text-[12px] max-md:leading-5">{campaign.description}</p><ProgressBar pct={pct} /><p className="my-2.5 font-mono text-[12px] text-ink-2 max-md:text-[11px]">{campaign.currentContributions} de {campaign.goalContributions} aportes · cuota: {campaign.quotaPerUser}</p><div className="flex gap-2 max-md:gap-1.5"><Link href={`/campanas/${campaign.id}`} className="flex-1"><Button size="sm" className="w-full max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Ver campaña</Button></Link><Link href={`/mis-aportes/${campaign.id}`} className="flex-1"><Button size="sm" className="w-full max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Mis aportes</Button></Link>{canContribute && <Link href={`/campanas/${campaign.id}/aportar`} className="flex-1"><Button variant="primary" size="sm" className="w-full max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Aportar</Button></Link>}</div></div>;
    })}</div>}
  </div>;
}