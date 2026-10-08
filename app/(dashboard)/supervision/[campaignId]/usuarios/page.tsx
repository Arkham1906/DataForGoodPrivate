// Pantalla /supervision/[campaignId]/usuarios: participantes de una campaña que supervisas.
// Server Component con SQL directo; solo campañas activas o finalizadas con supervisor_id = tú.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "../../_ui";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Participantes de la campaña" };

type CampaignAccess = { id: number; name: string; status: string };

async function getSupervisedCampaign(campaignId: string): Promise<CampaignAccess> {
  const user = await exigirUsuario();
  if (!user.role.includes("supervisor")) redirect("/campanas");

  const result = await pool.query<CampaignAccess>(
    `SELECT id, name, status FROM campanas
    WHERE id = $1 AND supervisor_id = $2 AND status IN ('activa', 'finalizada')
     LIMIT 1`,
    [campaignId, user.id]
  );
  if (result.rowCount === 0) notFound();
  return result.rows[0];
}

export default async function CampaignUsersPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const campaign = await getSupervisedCampaign(campaignId);
  const result = await pool.query(
    `SELECT a.user_id AS id,
            a.participant_name AS name,
            a.participant_email AS email,
            COUNT(*)::int AS contributions,
            MAX(a.submitted_at) AS last_submitted
     FROM aportes a
     WHERE a.campaign_id = $1 AND a.user_id IS NOT NULL
     GROUP BY a.user_id, a.participant_name, a.participant_email
     ORDER BY MAX(a.submitted_at) DESC`,
    [campaignId]
  );

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href={`/supervision/${campaignId}`}>Volver al detalle de campaña</BackLink>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Participantes</p>
        <h1 className="mt-2 text-2xl font-extrabold text-system-900">Usuarios · {campaign.name}</h1>
        <p className="mt-1 text-[13px] text-system-600">{result.rowCount} participantes con al menos un aporte</p>
      </div>

      {result.rowCount === 0 ? (
        <div className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">Todavía no hay usuarios participantes.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm">
          <table className="w-full min-w-[650px] text-left text-[13px]">
            <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
              <tr><th className="pb-3 font-medium">Usuario</th><th className="pb-3 font-medium">Aportes</th><th className="pb-3 font-medium">Último aporte</th><th className="pb-3" /></tr>
            </thead>
            <tbody>
              {result.rows.map((participant) => (
                <tr key={participant.id} className="border-b border-system-200 last:border-0">
                  <td className="py-4"><p className="font-bold text-system-900">{participant.name}</p><p className="font-mono text-[11px] text-system-500">{participant.email || "Sin correo"}</p></td>
                  <td className="font-mono">{participant.contributions}</td>
                  <td className="font-mono text-[12px] text-system-500">{new Date(participant.last_submitted).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="text-right"><Link href={`/supervision/${campaignId}/usuarios/${participant.id}/aportes`} className="rounded-pill border border-system-300 px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600">Ver aportes</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-5 rounded-lg border border-system-200 bg-system-100 p-4 text-[13px] text-system-600">Vista exclusiva del supervisor asignado. Los archivos de los aportes no están disponibles en esta sección.</div>
    </div>
  );
}
