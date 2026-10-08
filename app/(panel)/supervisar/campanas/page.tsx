// Pantalla /supervisar/campanas: campañas supervisadas por el SuperUsuario.
// Server Component. Datos: listarCampanasParaRoot().

import Link from "next/link";
import Tag from "@/components/ui/Tag";
import { listarCampanasParaRoot } from "@/lib/supervision/root";
import { BackLink } from "../_ui";

export default async function SupervisedCampaignsPage() {
  const { supervisadas } = await listarCampanasParaRoot();
  const campaigns = supervisadas.filter((c) => c.status === "activa" || c.status === "aceptada");

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/supervisar">Volver a supervisar</BackLink>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Modo supervisor · SuperUsuario</p><h1 className="mt-2 text-2xl font-extrabold text-system-900">Campañas supervisadas</h1><p className="mt-1 text-[13px] text-system-600">{campaigns.length} registradas · mostrando todas</p></div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm">
        <table className="w-full min-w-[700px] text-left text-[13px]">
          <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-400"><tr><th className="pb-3 font-medium">Campaña</th><th className="pb-3 font-medium">Estado</th><th className="pb-3 font-medium">Progreso</th><th className="pb-3 font-medium">Participantes</th><th className="pb-3" /></tr></thead>
          <tbody>
            {campaigns.map((campaign) => {
              const percent = campaign.goalContributions > 0
                ? `${Math.min(100, Math.round((campaign.currentContributions / campaign.goalContributions) * 100))}%`
                : "0%";

              return (
                <tr key={campaign.id} className="border-b border-system-200 last:border-0">
                  <td className="py-4"><p className="font-bold text-system-900">{campaign.name}</p><p className="text-[12px] text-system-400">{campaign.tag || "Sin temática"}</p></td>
                  <td><Tag tone={campaign.status === "activa" ? "ok" : "warn"}>{campaign.status === "activa" ? "Activa" : "Aceptada"}</Tag></td>
                  <td className="w-44"><div className="h-2 overflow-hidden rounded-pill bg-system-100"><div className="h-full rounded-pill bg-success-700" style={{ width: percent }} /></div><p className="mt-1 font-mono text-[11px] text-system-400">{campaign.currentContributions} / {campaign.goalContributions}</p></td>
                  <td className="font-mono text-system-600">{campaign.participants}</td>
                  <td><div className="flex justify-end gap-2"><Link href={`/supervisar/${campaign.id}/usuarios`} className="rounded-pill border border-system-300 px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600">Usuarios</Link><Link href={`/supervisar/${campaign.id}/panel`} className="rounded-pill border border-system-300 px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600">Panel</Link></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
