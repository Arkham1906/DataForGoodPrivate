// Pantalla /supervision/[campaignId]/usuarios/[userId]/aportes: aportes de un participante.
// Server Component con SQL directo; solo si supervisas la campaña.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Tag from "@/components/ui/Tag";
import { BackLink } from "../../../../_ui";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import { formatearTamano } from "@/lib/aportes/archivo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aportes de un participante" };

export default async function UserContributionsPage({ params }: { params: Promise<{ campaignId: string; userId: string }> }) {
  const { campaignId, userId } = await params;
  const user = await exigirUsuario();
  if (!user.role.includes("supervisor")) redirect("/campanas");

  const campaignResult = await pool.query(
    `SELECT id, name FROM campanas WHERE id = $1 AND supervisor_id = $2 AND status IN ('activa', 'finalizada') LIMIT 1`,
    [campaignId, user.id]
  );
  if (campaignResult.rowCount === 0) notFound();

  const result = await pool.query(
    `SELECT id, participant_name, participant_email, description, file_type, file_size_bytes,
            caracteristicas, status, submitted_at, rejection_reason, first_pass_by
     FROM aportes
     WHERE campaign_id = $1 AND user_id = $2
     ORDER BY submitted_at DESC`,
    [campaignId, userId]
  );
  if (result.rowCount === 0) notFound();

  const participant = result.rows[0];
  const statusLabel: Record<string, string> = { pendiente: "En revisión", espera_final: "Espera aprobación final", aceptado: "Aceptado", rechazado: "Rechazado" };
  const statusTone = (status: string) => status === "aceptado" ? "ok" : status === "rechazado" ? "danger" : "warn";

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href={`/supervision/${campaignId}/usuarios`}>Volver a participantes</BackLink>
      <div className="mb-5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Aportes de participante</p>
        <h1 className="mt-2 text-2xl font-extrabold text-system-900">{participant.participant_name}</h1>
        <p className="mt-1 text-[13px] text-system-600">{campaignResult.rows[0].name} · {participant.participant_email || "Sin correo"}</p>
      </div>
      <div className="mb-5 rounded-lg border border-system-200 bg-system-100 p-4 text-[13px] text-system-600">Vista de solo lectura. El archivo de cada aporte no puede verse ni descargarse desde supervisión.</div>
      <div className="space-y-3">
        {result.rows.map((contribution) => (
          <Link key={contribution.id} href={`/supervision/${campaignId}/usuarios/${userId}/aportes/${contribution.id}`} className="block rounded-lg border border-system-200 bg-white p-5 shadow-sm hover:border-brand-600">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[15px] font-extrabold text-system-900">Aporte #{contribution.id}</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-system-600">{contribution.description}</p></div><Tag tone={statusTone(String(contribution.status))}>{statusLabel[String(contribution.status)] ?? contribution.status}</Tag></div>
            <div className="mt-4 grid gap-3 border-t border-system-200 pt-4 text-[12px] sm:grid-cols-4"><p><span className="text-system-500">Enviado</span><br /><span className="font-mono text-system-600">{new Date(contribution.submitted_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span></p><p><span className="text-system-500">Tipo</span><br /><span className="text-system-600">{contribution.file_type}</span></p><p><span className="text-system-500">Peso</span><br /><span className="font-mono text-system-600">{contribution.file_size_bytes ? `${formatearTamano(Number(contribution.file_size_bytes))}` : "Sin dato"}</span></p><p><span className="text-system-500">Acción</span><br /><span className="font-semibold text-brand-600">Ver datos</span></p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
