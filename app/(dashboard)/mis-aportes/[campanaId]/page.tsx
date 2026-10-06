"use client";

// Pantalla /mis-aportes/[campanaId]: tus aportes en una campaña.
// Componente cliente. Datos: GET /api/campanas?id= y GET /api/aportes?campaignId=&mine=true.
// Acción: borrar un aporte pendiente o rechazado (no uno aceptado) con DELETE /api/aportes/[id];
// así se recupera ese espacio de la cuota.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ContributionCard from "@/components/cards/ContributionCard";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import type { Campaign, Contribution } from "@/types";
import { BASE_PATH } from "@/lib/base-path";

export default function CampaignContributionsPage() {
  const params = useParams<{ campanaId: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [items, setItems] = useState<Contribution[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [campaignRes, aportesRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas?id=${encodeURIComponent(params.campanaId)}`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/aportes?campaignId=${encodeURIComponent(params.campanaId)}&mine=true`, { cache: "no-store" }),
        ]);

        const campaignPayload = await campaignRes.json().catch(() => ({}));
        if (!campaignRes.ok) throw new Error(campaignPayload.error ?? "No se pudo cargar la campaña");
        setCampaign(campaignPayload.data as Campaign);

        const aportesPayload = await aportesRes.json().catch(() => ({}));
        if (!aportesRes.ok) throw new Error(aportesPayload.error ?? "No se pudieron cargar tus aportes");
        setItems(
          (Array.isArray(aportesPayload.data) ? (aportesPayload.data as Contribution[]) : []).map((item) => ({
            ...item,
            campaignId: campaignPayload.data.id,
            campaignName: campaignPayload.data.name,
          }))
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar la información");
      }
    }
    void load();
  }, [params.campanaId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!campaign) return <p className="text-sm text-ink-2">Cargando...</p>;

  const visible = items.filter((item) => !removedIds.includes(item.id));
  const accepted = visible.filter((item) => item.status === "aceptado");
  const pending = visible.filter((item) => item.status === "pendiente" || item.status === "espera_final");
  const rejected = visible.filter((item) => item.status === "rechazado");
  const filteredItems =
    statusFilter === "todos"
      ? visible
      : visible.filter((item) =>
          statusFilter === "aceptados"
            ? item.status === "aceptado"
            : statusFilter === "revision"
              ? item.status === "pendiente" || item.status === "espera_final"
              : item.status === "rechazado"
        );
  const canAdd = campaign.status === "activa" && visible.length < campaign.quotaPerUser;
  const isActive = campaign.status === "activa";
  const progress = campaign.quotaPerUser > 0 ? Math.round((visible.length / campaign.quotaPerUser) * 100) : 0;

  async function deleteContribution(contributionId: string) {
    setDeletingId(contributionId);
    setError(null);

    try {
      const response = await fetch(`${BASE_PATH}/api/aportes/${contributionId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo eliminar el aporte");
      setRemovedIds((current) => [...current, contributionId]);
      setItems((current) => current.filter((item) => item.id !== contributionId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el aporte");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/mis-aportes"
        className="mb-4 inline-block text-[13px] text-ink-2 hover:text-ink"
      >
        ← Volver a mis aportes
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-ink">{campaign.name}</h1>
          <p className="text-[13px] text-ink-2">{campaign.tag} · campaña {isActive ? "activa" : "finalizada"}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/campanas/${campaign.id}`}><Button size="sm">Ver campaña</Button></Link>
          {canAdd && <Link href={`/campanas/${campaign.id}/aportar`}><Button variant="primary" size="sm">Añadir aporte</Button></Link>}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between gap-4 text-[13px] font-semibold text-ink">
          <span>Tu cuota en esta campaña</span><span className="font-mono">{visible.length} de {campaign.quotaPerUser} aportes</span>
        </div>
        <ProgressBar pct={progress} />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div><p className="font-mono text-[15px] font-bold text-ok">{accepted.length}</p><p className="text-[11px] text-ink-3">aceptados · {accepted.length * campaign.xpPerContribution} XP</p></div>
          <div><p className="font-mono text-[15px] font-bold text-warn">{pending.length}</p><p className="text-[11px] text-ink-3">en revisión</p></div>
          <div><p className="font-mono text-[15px] font-bold text-ink">{Math.max(campaign.quotaPerUser - visible.length, 0)}</p><p className="text-[11px] text-ink-3">disponibles</p></div>
        </div>
      </div>

      <p className="mb-2 text-[12.5px] font-semibold text-ink">Filtrar historial</p>
      <div className="mb-5 flex flex-wrap gap-2">
        <select className="rounded border border-line-2 bg-surface px-3 py-2 text-[13px] text-ink" aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="aceptados">Aceptados</option>
          <option value="revision">En revisión</option>
          <option value="rechazados">Rechazados</option>
        </select>
        <Button size="sm" onClick={() => setStatusFilter("todos")}>Limpiar</Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[{ id: "todos", label: "Todos", count: visible.length }, { id: "aceptados", label: "Aceptados", count: accepted.length }, { id: "revision", label: "En revisión", count: pending.length }, { id: "rechazados", label: "Rechazados", count: rejected.length }].map((filter) => (
          <button key={filter.id} type="button" onClick={() => setStatusFilter(filter.id)} className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold ${statusFilter === filter.id ? "border-accent bg-accent text-white" : "border-line-2 bg-surface text-ink-2"}`}>
            {filter.label} <span className="ml-1 font-mono">{filter.count}</span>
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-sm text-ink-2">Aún no has enviado aportes a esta campaña.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredItems.map((item) => (
            <div key={item.id}>
              <ContributionCard contribution={item} />
              {item.status !== "aceptado" && (
                <div className="-mt-2 rounded-b-lg border border-t-0 border-warn bg-warn-tint px-4 pb-3 pt-4">
                  <button type="button" className="text-[12px] font-bold text-danger underline disabled:cursor-not-allowed disabled:opacity-50" disabled={deletingId === item.id} onClick={() => void deleteContribution(item.id)}>
                    {deletingId === item.id ? "Eliminando..." : "Eliminar aporte"}
                  </button>
                  <span className="ml-3 text-[11.5px] text-ink-2">Al eliminarlo desaparece del historial y recuperas el cupo en tu cuota.</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 flex items-center gap-2 rounded-lg border border-line bg-surface p-3 text-[12px] text-ink-2">
        <Tag>{isActive ? "Consulta" : "Solo lectura"}</Tag>
        <span>{isActive ? "Para enviar contenido nuevo usa Añadir aporte." : "La campaña finalizó: ya no puedes añadir ni eliminar aportes."}</span>
      </div>
    </div>
  );
}
