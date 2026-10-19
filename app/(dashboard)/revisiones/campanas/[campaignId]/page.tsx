"use client";

// Pantalla /revisiones/campanas/[campaignId]: aportes por revisar de una campaña.
// Componente cliente. Datos: GET /api/campanas/[id] y GET /api/aportes?campaignId=&reviewer=true (solo revisor aceptado).

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Tag from "@/components/ui/Tag";
import type { Campaign, Contribution } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

export default function ReviewerCampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function load() {
      try {
        const [campaignResponse, contributionsResponse] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas/${campaignId}`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/aportes?campaignId=${campaignId}&reviewer=true`, { cache: "no-store" }),
        ]);
        const campaignPayload = await campaignResponse.json().catch(() => ({}));
        const contributionsPayload = await contributionsResponse.json().catch(() => ({}));
        if (!campaignResponse.ok) throw new Error(campaignPayload.error ?? "No se pudo cargar la campaña");
        if (!contributionsResponse.ok) throw new Error(contributionsPayload.error ?? "No se pudieron cargar los aportes");
        setCampaign(campaignPayload.data as Campaign);
        setContributions(Array.isArray(contributionsPayload.data) ? contributionsPayload.data as Contribution[] : []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar la campaña");
      }
    }
    if (campaignId) void load();
  }, [campaignId, recarga]);

  if (error) return <p className="mx-auto max-w-4xl text-sm text-error-700">{error}</p>;
  if (!campaign) return <PantallaEsqueleto tipo="tabla" etiqueta="Cargando campaña…" className="mx-auto max-w-4xl" />;

  const pending = contributions.filter((item) => item.status === "pendiente");
  const accepted = contributions.filter((item) => item.status === "aceptado");

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={campaign.status === "finalizada" ? "/revisiones/finalizadas" : "/revisiones"} className="mb-5 inline-block text-[13px] text-system-600 hover:text-system-900">← Volver a campañas</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Revisor de aportes</p><h1 className="mt-2 text-2xl font-extrabold text-system-900">{campaign.name}</h1><p className="mt-1 text-[13px] text-system-600">{campaign.tag || "Sin temática"} · {campaign.participants} participantes</p></div>
        <Tag tone={campaign.status === "finalizada" ? "default" : "on"}>{campaign.status === "finalizada" ? "Finalizada" : "En curso"}</Tag>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <section className="rounded-lg border border-warning-200 bg-warning-50 p-5"><p className="text-[12px] font-bold uppercase tracking-wide text-warning-800">Por aceptar</p><p className="mt-2 text-3xl font-extrabold text-system-900">{pending.length}</p><p className="mt-1 text-[13px] text-system-600">Aportes que requieren tu revisión.</p></section>
        <Link href={`/revisiones/campanas/${campaignId}/usuarios`} className="rounded-lg border border-system-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-600"><p className="text-[12px] font-bold uppercase tracking-wide text-success-700">Aceptados por ti</p><p className="mt-2 text-3xl font-extrabold text-system-900">{accepted.length}</p><p className="mt-1 text-[13px] text-system-600">Explora usuarios y sus aportes aceptados.</p><p className="mt-4 text-[13px] font-bold text-brand-600">Ver usuarios →</p></Link>
      </div>

      <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold text-system-900">Aportes por aceptar</h2><Tag tone="warn">{pending.length}</Tag></div>
        {pending.length === 0 ? <p className="text-[13px] text-system-600">No hay aportes pendientes de validación.</p> : <div className="space-y-3">{pending.map((item) => <Link key={item.id} href={`/revisiones/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded border border-system-200 bg-system-100 p-3 hover:border-brand-600"><div><p className="text-[13px] font-semibold text-system-900">{item.participantName}</p><p className="mt-1 line-clamp-1 text-[12px] text-system-600">{item.description}</p></div><span className="text-[12.5px] font-bold text-brand-600">Revisar aporte →</span></Link>)}</div>}
      </section>
    </div>
  );
}
