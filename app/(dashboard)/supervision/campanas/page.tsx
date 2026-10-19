"use client";

// Pantalla /supervision/campanas: campañas que supervisas.
// Componente cliente. Datos: GET /api/campanas?supervised=true.

import Link from "next/link";
import { useEffect, useState } from "react";
import Tag from "@/components/ui/Tag";
import { BackLink } from "../_ui";
import { BASE_PATH } from "@/lib/base-path";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

type CampaignRow = {
  id: string;
  name: string;
  tag?: string;
  tematica?: string;
  status: string;
  currentContributions?: number;
  goalContributions?: number;
  participants?: number;
};

export default function SupervisedCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${BASE_PATH}/api/campanas?supervised=true`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("No se pudieron cargar las campañas supervisadas");
        }

        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setCampaigns(rows.filter((campaign: CampaignRow) => {
          const status = String(campaign.status ?? "");
          return status === "activa" || status === "aceptada";
        }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [recarga]);

  if (loading) {
    return <PantallaEsqueleto tipo="tabla" etiqueta="Cargando campañas supervisadas…" className="mx-auto max-w-5xl" />;
  }

  if (error) {
    return <div className="mx-auto max-w-5xl rounded-lg border border-error-700/30 bg-error-50 p-4 text-sm text-error-700">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/supervision">Volver a supervisar</BackLink>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Supervisión</p><h1 className="mt-2 text-2xl font-extrabold text-system-900">Campañas supervisadas</h1><p className="mt-1 text-[13px] text-system-600">{campaigns.length} registradas · mostrando todas</p></div>
        <span className="rounded-pill border border-system-300 bg-white px-4 py-2 text-[12.5px] text-system-500">Buscar campaña</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm">
        <table className="w-full min-w-[700px] text-left text-[13px]">
          <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500"><tr><th className="pb-3 font-medium">Campaña</th><th className="pb-3 font-medium">Estado</th><th className="pb-3 font-medium">Progreso</th><th className="pb-3 font-medium">Participantes</th><th className="pb-3"><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {campaigns.map((campaign) => {
              const progress = Number(campaign.goalContributions ?? 0) > 0
                ? `${Number(campaign.currentContributions ?? 0)} / ${Number(campaign.goalContributions ?? 0)}`
                : "0 / 0";
              const percent = Number(campaign.goalContributions ?? 0) > 0
                ? `${Math.min(100, Math.round((Number(campaign.currentContributions ?? 0) / Number(campaign.goalContributions ?? 1)) * 100))}%`
                : "0%";

              return (
                <tr key={campaign.id} className="border-b border-system-200 last:border-0">
                  <td className="py-4"><p className="font-bold text-system-900">{campaign.name}</p><p className="text-[12px] text-system-500">{campaign.tag || campaign.tematica || "Sin temática"}</p></td>
                  <td><Tag tone={campaign.status === "activa" ? "ok" : "warn"}>{campaign.status === "activa" ? "Activa" : campaign.status === "aceptada" ? "Aceptada" : campaign.status}</Tag></td>
                  <td className="w-44"><div className="h-2 overflow-hidden rounded-pill bg-system-100"><div className="h-full rounded-pill bg-success-700" style={{ width: percent }} /></div><p className="mt-1 font-mono text-[11px] text-system-500">{progress}</p></td>
                  <td className="font-mono text-system-600">{Number(campaign.participants ?? 0)}</td>
                  <td><div className="flex justify-end gap-2"><Link href={`/supervision/${campaign.id}/usuarios`} className="rounded-pill border border-system-300 px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600">Usuarios</Link><Link href={`/supervision/${campaign.id}/panel`} className="rounded-pill border border-system-300 px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600">Panel</Link></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
