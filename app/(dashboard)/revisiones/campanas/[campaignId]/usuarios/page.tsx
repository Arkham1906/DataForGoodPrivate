// Pantalla /revisiones/campanas/[campaignId]/usuarios: participantes de una campaña que revisas.
// Server Component con SQL directo; la consulta exige que seas revisor aceptado de la campaña.

import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Participantes de la campaña" };

export default async function ReviewerUsersPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const reviewer = await exigirUsuario();
  const campaignResult = await pool.query(`SELECT c.id, c.name FROM campanas c JOIN campana_revisores cr ON cr.campana_id = c.id WHERE c.id = $1 AND cr.usuario_id = $2 AND cr.estado = 'aceptado' LIMIT 1`, [campaignId, reviewer.id]);
  if (campaignResult.rowCount === 0) notFound();
  const users = await pool.query(`SELECT a.user_id AS id, MAX(a.participant_name) AS name, MAX(a.participant_email) AS email, COUNT(*)::int AS contributions, MAX(a.reviewed_at) AS last_reviewed FROM aportes a WHERE a.campaign_id = $1 AND a.first_pass_by_user_id = $2 AND a.status = 'aceptado' AND a.user_id IS NOT NULL GROUP BY a.user_id ORDER BY MAX(a.reviewed_at) DESC`, [campaignId, reviewer.id]);

  return <div className="mx-auto max-w-5xl">
    <Link href={`/revisiones/campanas/${campaignId}`} className="mb-5 inline-block text-[13px] text-system-600 hover:text-system-900">← Volver a campaña</Link>
    <div className="mb-6"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Aportes aceptados por ti</p><h1 className="mt-2 text-2xl font-extrabold text-system-900">Usuarios · {campaignResult.rows[0].name}</h1><p className="mt-1 text-[13px] text-system-600">Selecciona un usuario para consultar sus aportes aceptados.</p></div>
    {users.rowCount === 0 ? <div className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">Aún no has aceptado aportes de usuarios en esta campaña.</div> : <div className="overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm"><table className="w-full min-w-[650px] text-left text-[13px]"><thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[.1em] text-system-500"><tr><th className="pb-3 font-medium">Usuario</th><th className="pb-3 font-medium">Aportes aceptados</th><th className="pb-3 font-medium">Última revisión</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{users.rows.map((participant) => <tr key={participant.id} className="border-b border-system-200 last:border-0"><td className="py-4"><p className="font-bold text-system-900">{participant.name}</p><p className="font-mono text-[11px] text-system-500">{participant.email || "Sin correo"}</p></td><td className="font-mono text-system-600">{participant.contributions}</td><td className="font-mono text-[12px] text-system-500">{participant.last_reviewed ? new Date(participant.last_reviewed).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin dato"}</td><td className="text-right"><Link href={`/revisiones/campanas/${campaignId}/usuarios/${participant.id}/aportes`} className="rounded-pill border border-system-300 px-3 py-1.5 text-[12px] font-bold text-system-600 hover:border-brand-600">Ver aportes</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
