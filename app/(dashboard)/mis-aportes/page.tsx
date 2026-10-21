"use client";

// Pantalla /mis-aportes: campañas en las que aportaste o que guardaste.
// Componente cliente. Datos: GET /api/campanas?misAportes=true. Filtros en el cliente. Mientras llegan,
// tarjetas esqueleto (antes decía "Todavía no aportaste…" hasta que cargaba). En cada tarjeta, el nombre lleva
// a la campaña y quedan solo "Mis aportes" y "Aportar" (Ley de Hick, 2026-10-07; antes había "Ver campaña").
// Una campaña propia solo llega si la guardó (2026-10-19): sale con "Tu campaña" y "Gestionar"
// (/mis-campanas/[id]/panel), sin "Aportar", y no cuenta en "Puedo aportar" ni "Cuota completa".

import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import Link from "next/link";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import { EsqueletoDeTarjetas } from "@/components/ui/Esqueletos";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

export default function MisAportesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState("Todas");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function loadCampaigns() {
      try {
        const response = await fetch(`${BASE_PATH}/api/campanas?misAportes=true`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        setCampaigns(Array.isArray(payload.data) ? payload.data as Campaign[] : []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setCargando(false);
      }
    }
    void loadCampaigns();
  }, [recarga]);

  const cuotaCompleta = (campaign: Campaign) =>
    campaign.quotaPerUser > 0 && (campaign.myContributionsCount ?? 0) >= campaign.quotaPerUser;

  const visible = campaigns.filter((campaign) => {
    // Una campaña de la que lo banearon no cuenta como "puedo aportar".
    if (filter === "Puedo aportar") return !campaign.isMine && campaign.status === "activa" && !cuotaCompleta(campaign) && !campaign.isBanned;
    if (filter === "Finalizadas") return campaign.status === "finalizada";
    if (filter === "Favoritos") return Boolean(campaign.isSaved);
    if (filter === "Cuota completa") return !campaign.isMine && cuotaCompleta(campaign);
    return true;
  });

  return <div>
    <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
      <div><h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mis aportes</h1><p className="mt-1 text-[13px] text-system-600 max-md:max-w-[220px] max-md:text-[12px] max-md:leading-5">Campañas en las que ya aportaste o que guardaste para después.</p></div>
      <Link href="/campanas"><Button variant="primary" size="sm" className="whitespace-nowrap max-md:max-w-[126px] max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px] max-md:leading-4">Explorar campaña</Button></Link>
    </div>
    <div className="dashboard-nav mb-6 mt-4 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:mb-4 max-md:gap-1.5 md:flex-wrap md:overflow-visible md:pb-0" role="group" aria-label="Filtrar campañas">
      {["Todas", "Puedo aportar", "Cuota completa", "Finalizadas", "Favoritos"].map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={filter === item}
          onClick={() => setFilter(item)}
          className={`shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${filter === item ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600"}`}
        >
          {item}
        </button>
      ))}
    </div>
    {error ? <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p> : cargando ? (
      <div role="status" aria-live="polite">
        <span className="sr-only">Cargando tus aportes…</span>
        <EsqueletoDeTarjetas cantidad={4} columnas={2} />
      </div>
    ) : visible.length === 0 ? <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">Todavía no aportaste ni guardaste ninguna campaña.</p> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{visible.map((campaign) => {
      const pct = porcentajeDeMeta(campaign.approvedContributions, campaign.goalContributions);
      const canContribute = !campaign.isMine && campaign.status === "activa" && !cuotaCompleta(campaign) && !campaign.isBanned;
      return <div key={campaign.id} className="rounded-lg border border-system-200 bg-white p-4 max-md:p-3.5"><div className="mb-1.5 flex items-start justify-between gap-2"><div><Link href={`/campanas/${campaign.id}`} className="text-[15px] font-bold text-system-900 hover:text-brand-600 hover:underline max-md:text-[14px]">{campaign.name}</Link><p className="text-[12.5px] text-system-600 max-md:text-[11.5px]">{campaign.tag} · {textoDeUbicacion({ todoElPais: campaign.todoElPais, municipio: campaign.locationCity, estado: campaign.locationState })}</p></div>{campaign.isMine ? <Tag tone="on">Tu campaña</Tag> : campaign.isBanned ? <Tag tone="danger">Baneado</Tag> : <Tag tone={canContribute ? "ok" : "default"}>{canContribute ? "Activa" : campaign.status}</Tag>}</div><p className="mb-3 text-[12.5px] text-system-600 max-md:text-[12px] max-md:leading-5">{campaign.description}</p><ProgressBar pct={pct} /><p className="my-2.5 font-mono text-[12px] text-system-600 max-md:text-[11px]">{campaign.approvedContributions} de {campaign.goalContributions} aportes aprobados · cuota: {campaign.quotaPerUser}</p><div className="flex gap-2 max-md:gap-1.5">{campaign.isMine ? <Link href={`/mis-campanas/${campaign.id}/panel`} className="flex-1"><Button size="sm" className="w-full max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Gestionar</Button></Link> : <Link href={`/mis-aportes/${campaign.id}`} className="flex-1"><Button size="sm" className="w-full max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Mis aportes</Button></Link>}{canContribute && <Link href={`/campanas/${campaign.id}/aportar`} className="flex-1"><Button variant="primary" size="sm" className="w-full max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Aportar</Button></Link>}</div></div>;
    })}</div>}
  </div>;
}