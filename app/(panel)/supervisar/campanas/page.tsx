// Pantalla /supervisar/campanas: todas las campañas aceptadas (por el SuperUsuario o por cualquier supervisor;
// 2026-10-15), en dos tablas (2026-10-16): las que supervisa el SuperUsuario y las de los otros supervisores,
// con quién las supervisa.
// Server Component. Datos: listarCampanasParaRoot().

import Link from "next/link";
import Tag from "@/components/ui/Tag";
import { listarCampanasParaRoot, type CampanaSupervisable } from "@/lib/supervision/root";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { BackLink } from "../_ui";
import type { Metadata } from "next";
import { exigirSesionRoot } from "@/lib/supervision/root";

export const metadata: Metadata = { title: "Campañas supervisadas" };

export default async function SupervisedCampaignsPage() {
  await exigirSesionRoot();
  const { supervisadas } = await listarCampanasParaRoot();
  const campaigns = supervisadas.filter((c) => c.status === "activa" || c.status === "aceptada" || c.status === "pausada");
  const mias = campaigns.filter((c) => c.supervision === "mia");
  const deOtros = campaigns.filter((c) => c.supervision !== "mia");

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href="/supervisar">Volver a supervisar</BackLink>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Modo supervisor · SuperUsuario</p><h1 className="mt-2 text-2xl font-extrabold text-system-900">Campañas supervisadas</h1><p className="mt-1 text-[13px] text-system-600">{campaigns.length} registradas · {mias.length} tuyas · {deOtros.length} de otros supervisores</p></div>
      </div>
      <div className="space-y-6">
        <TablaDeSupervisadas titulo="Supervisadas por ti" campaigns={mias} vacio="Todavía no supervisas ninguna campaña aceptada." />
        <TablaDeSupervisadas titulo="Supervisadas por otros supervisores" campaigns={deOtros} vacio="Ningún supervisor tiene campañas aceptadas todavía." conSupervisor />
      </div>
    </div>
  );
}

/** Una tabla de campañas supervisadas; `conSupervisor` agrega la columna "Supervisa" (en las tuyas sobra). */
function TablaDeSupervisadas({
  titulo,
  campaigns,
  vacio,
  conSupervisor = false,
}: {
  titulo: string;
  campaigns: CampanaSupervisable[];
  vacio: string;
  conSupervisor?: boolean;
}) {
  return (
    <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-system-900">{titulo}</h2>
        <Tag tone="ok">{campaigns.length}</Tag>
      </div>
      {campaigns.length === 0 ? (
        <p className="text-[13px] text-system-600">{vacio}</p>
      ) : (
        <div className="overflow-x-auto">
          {/* Anchos fijos: sin "Supervisa", "Campaña" toma su espacio y las demás columnas quedan alineadas entre las dos tablas. */}
          <table className="w-full min-w-[820px] table-fixed text-left text-[13px]">
            <colgroup>
              <col className={conSupervisor ? "w-[30%]" : "w-[46%]"} />
              {conSupervisor && <col className="w-[16%]" />}
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500"><tr><th className="pb-3 font-medium">Campaña</th>{conSupervisor && <th className="pb-3 font-medium">Supervisa</th>}<th className="pb-3 font-medium">Estado</th><th className="pb-3 font-medium">Progreso</th><th className="pb-3 font-medium">Participantes</th><th className="pb-3"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {campaigns.map((campaign) => {
                const percent = `${porcentajeDeMeta(campaign.approvedContributions, campaign.goalContributions)}%`;

                return (
                  <tr key={campaign.id} className="border-b border-system-200 last:border-0">
                    <td className="py-4"><p className="font-bold text-system-900">{campaign.name}</p><p className="text-[12px] text-system-500">{campaign.tag || "Sin temática"}</p></td>
                    {conSupervisor && <td className="text-system-600">{campaign.supervisadaPor ?? "Nadie"}</td>}
                    <td><Tag tone={campaign.status === "activa" ? "ok" : campaign.status === "pausada" ? "default" : "warn"}>{campaign.status === "activa" ? "Activa" : campaign.status === "pausada" ? "Pausada" : "Aceptada"}</Tag></td>
                    <td className="pr-4"><div className="h-2 overflow-hidden rounded-pill bg-system-100"><div className="h-full rounded-pill bg-success-700" style={{ width: percent }} /></div><p className="mt-1 font-mono text-[11px] text-system-500">{campaign.currentContributions} / {campaign.goalContributions}</p></td>
                    <td className="font-mono text-system-600">{campaign.participants}</td>
                    <td><div className="flex justify-end gap-2">{campaign.status === "aceptada" ? <Link href={`/supervisar/${campaign.id}`} className="rounded-pill border border-system-300 px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600">Ver detalle</Link> : <><Link href={`/supervisar/${campaign.id}/usuarios`} className="rounded-pill border border-system-300 px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600">Usuarios</Link><Link href={`/supervisar/${campaign.id}/panel`} className="rounded-pill border border-system-300 px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600">Panel</Link></>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
