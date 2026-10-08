// Pantalla /revisiones/campanas/[campaignId]/usuarios/[userId]/aportes: aportes de un participante.
// Server Component con SQL directo tras exigirUsuario(); solo para revisores aceptados de la campaña.

import Link from "next/link";
import { notFound } from "next/navigation";
import Tag from "@/components/ui/Tag";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aportes de un participante" };

export default async function ReviewerUserContributionsPage({ params }: { params: Promise<{ campaignId: string; userId: string }> }) {
  const { campaignId, userId } = await params;
  const reviewer = await exigirUsuario();
  const result = await pool.query(`SELECT a.id, a.participant_name, a.participant_email, a.description, a.file_type, a.file_size_bytes, a.submitted_at, c.name AS campaign_name FROM aportes a JOIN campanas c ON c.id = a.campaign_id JOIN campana_revisores cr ON cr.campana_id = c.id WHERE a.campaign_id = $1 AND a.user_id = $2 AND a.first_pass_by_user_id = $3 AND a.status = 'aceptado' AND cr.usuario_id = $3 AND cr.estado = 'aceptado' ORDER BY a.reviewed_at DESC`, [campaignId, userId, reviewer.id]);
  if (result.rowCount === 0) notFound();
  const participant = result.rows[0];
  return <div className="mx-auto max-w-4xl"><Link href={`/revisiones/campanas/${campaignId}/usuarios`} className="mb-5 inline-block text-[13px] text-system-600 hover:text-system-900">← Volver a usuarios</Link><div className="mb-6"><p className="font-mono text-[11px] font-semibold uppercase tracking-[.12em] text-brand-600">Aportes aceptados por ti</p><h1 className="mt-2 text-2xl font-extrabold text-system-900">{participant.participant_name}</h1><p className="mt-1 text-[13px] text-system-600">{participant.campaign_name} · {participant.participant_email || "Sin correo"}</p></div><div className="space-y-3">{result.rows.map((contribution) => <Link key={contribution.id} href={`/revisiones/campanas/${campaignId}/usuarios/${userId}/aportes/${contribution.id}`} className="block rounded-lg border border-system-200 bg-white p-5 shadow-sm hover:border-brand-600"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[15px] font-extrabold text-system-900">Aporte #{contribution.id}</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-system-600">{contribution.description}</p></div><Tag tone="ok">Aceptado</Tag></div><div className="mt-4 grid gap-3 border-t border-system-200 pt-4 text-[12px] sm:grid-cols-3"><p><span className="text-system-500">Enviado</span><br/><span className="font-mono text-system-600">{new Date(contribution.submitted_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span></p><p><span className="text-system-500">Tipo</span><br/><span className="text-system-600">{contribution.file_type}</span></p><p><span className="text-system-500">Acción</span><br/><span className="font-semibold text-brand-600">Ver detalles</span></p></div></Link>)}</div></div>;
}
