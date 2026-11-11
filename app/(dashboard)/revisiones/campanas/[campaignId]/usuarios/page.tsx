// Pantalla /revisiones/campanas/[campaignId]/usuarios: aportes aceptados de una campaña que revisas.
// Server Component con SQL directo; la consulta exige que seas revisor aceptado de la campaña.

import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { columnasDeArchivo } from "@/lib/aportes/tabla-archivos";
import { exigirUsuario } from "@/lib/session";
import type { Metadata } from "next";
import VistaAportesAceptados from "./[userId]/aportes/VistaAportesAceptados";

export const metadata: Metadata = { title: "Aportes aceptados" };

export default async function ReviewerUsersPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const reviewer = await exigirUsuario();
  const campaignResult = await pool.query(`SELECT c.id, c.name FROM campanas c JOIN campana_revisores cr ON cr.campana_id = c.id WHERE c.id = $1 AND cr.usuario_id = $2 AND cr.estado = 'aceptado' LIMIT 1`, [campaignId, reviewer.id]);
  if (campaignResult.rowCount === 0) notFound();
  const result = await pool.query(
    `SELECT a.id, a.user_id AS participant_id, a.participant_name, a.participant_email,
            a.description, a.file_type, ${columnasDeArchivo("a")}, a.submitted_at, a.reviewed_at
     FROM aportes a
     WHERE a.campaign_id = $1 AND a.first_pass_by_user_id = $2
       AND a.status = 'aceptado' AND a.user_id IS NOT NULL
       AND a.user_id IS DISTINCT FROM $2
     ORDER BY a.reviewed_at DESC`,
    [campaignId, reviewer.id],
  );
  const contributions = result.rows.map((contribution) => ({
    id: String(contribution.id),
    participantId: String(contribution.participant_id),
    participantName: contribution.participant_name ?? "Usuario",
    participantEmail: contribution.participant_email ?? "",
    description: contribution.description ?? "",
    fileType: contribution.file_type,
    submittedAt: new Date(contribution.submitted_at).toISOString(),
    acceptedAt: contribution.reviewed_at ? new Date(contribution.reviewed_at).toISOString() : null,
    sinArchivo: !contribution.file_path,
    archivoBorrado: Boolean(contribution.archivo_borrado_en),
  }));
  const campaign = campaignResult.rows[0];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/revisiones/campanas/${campaignId}`} className="mb-5 inline-block text-[13px] text-system-600 hover:text-system-900">← Volver a campaña</Link>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Aportes aceptados por ti</p>
        <h1 className="mt-2 text-2xl font-extrabold text-system-900">{campaign.name}</h1>
        <p className="mt-1 text-[13px] text-system-600">Consulta los aportes y la información de cada participante.</p>
      </div>
      {contributions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">Aún no has aceptado aportes de usuarios en esta campaña.</div>
      ) : (
        <VistaAportesAceptados campaignId={String(campaignId)} aportes={contributions} />
      )}
    </div>
  );
}
