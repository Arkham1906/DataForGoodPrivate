// Pantalla .../aportes/[aporteId] de /supervisar: detalle de un aporte (solo lectura).
// Server Component con SQL directo; exige sesión raíz vía lib/supervision/root.ts.

import { notFound } from "next/navigation";
import Tag from "@/components/ui/Tag";
import { BackLink } from "../../../../../_ui";
import { pool } from "@/lib/db";
import { obtenerCampanaSupervisadaPorRoot } from "@/lib/supervision/root";
import { formatearTamano } from "@/lib/aportes/archivo";

export default async function SupervisedContributionPage({ params }: { params: Promise<{ campaignId: string; userId: string; aporteId: string }> }) {
  const { campaignId, userId, aporteId } = await params;
  const campaign = await obtenerCampanaSupervisadaPorRoot(campaignId);
  if (!campaign || !/^d+$/.test(userId) || !/^d+$/.test(aporteId)) notFound();

  const result = await pool.query(
    `SELECT a.id, a.user_id, a.participant_name, a.participant_email, a.description,
            a.file_type, a.file_size_bytes, a.caracteristicas, a.status, a.submitted_at,
            a.rejection_reason, a.first_pass_by, c.name AS campaign_name
     FROM aportes a
     JOIN campanas c ON c.id = a.campaign_id
     WHERE a.id = $1 AND a.campaign_id = $2 AND a.user_id = $3
      AND c.supervisado_por_root AND c.status IN ('activa', 'finalizada')
     LIMIT 1`,
    [aporteId, campaignId, userId]
  );
  if (result.rowCount === 0) notFound();
  const contribution = result.rows[0];
  const statusLabel: Record<string, string> = { pendiente: "En revisión", espera_final: "Espera aprobación final", aceptado: "Aceptado", rechazado: "Rechazado" };
  const statusTone = contribution.status === "aceptado" ? "ok" : contribution.status === "rechazado" ? "danger" : "warn";

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href={`/supervisar/${campaignId}/usuarios/${userId}/aportes`}>Volver a aportes</BackLink>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Detalle del aporte</p><h1 className="mt-2 text-2xl font-extrabold text-system-900">Aporte #{contribution.id}</h1><p className="mt-1 text-[13px] text-system-600">{contribution.participant_name} · {contribution.campaign_name}</p></div><Tag tone={statusTone}>{statusLabel[contribution.status] ?? contribution.status}</Tag></div>
      <div className="mb-5 rounded-lg border border-system-200 bg-system-100 p-4 text-[13px] text-system-600">El supervisor puede consultar los datos y metadatos, pero el archivo del aporte no está disponible para visualización ni descarga.</div>
      <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm"><h2 className="text-[15px] font-extrabold text-system-900">Datos del aporte</h2><dl className="mt-4 space-y-3 text-[13px]"><div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Participante</dt><dd className="text-right font-medium text-system-900">{contribution.participant_name}</dd></div><div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Correo</dt><dd className="text-right text-system-900">{contribution.participant_email || "Sin correo"}</dd></div><div className="border-b border-system-200 pb-3"><dt className="text-system-600">Descripción</dt><dd className="mt-1 leading-6 text-system-900">{contribution.description}</dd></div><div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Características</dt><dd className="flex flex-wrap justify-end gap-1.5">{Array.isArray(contribution.caracteristicas) && contribution.caracteristicas.length > 0 ? contribution.caracteristicas.map((item: string) => <Tag key={item}>{item}</Tag>) : "Sin características"}</dd></div><div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Enviado</dt><dd className="text-right font-mono">{new Date(contribution.submitted_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</dd></div><div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Tipo de archivo</dt><dd className="text-right">{contribution.file_type}</dd></div><div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Tamaño</dt><dd className="text-right font-mono">{contribution.file_size_bytes ? `${formatearTamano(Number(contribution.file_size_bytes))}` : "Sin dato"}</dd></div>{contribution.first_pass_by && <div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Revisor</dt><dd className="text-right">{contribution.first_pass_by}</dd></div>}{contribution.rejection_reason && <div className="flex justify-between gap-4"><dt className="text-system-600">Motivo de rechazo</dt><dd className="text-right font-medium text-error-700">{contribution.rejection_reason}</dd></div>}</dl></section>
    </div>
  );
}
