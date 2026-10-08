// Pantalla /supervisar/[campaignId]/usuarios/[userId]/aportes: aportes de un participante.
// Server Component con SQL directo; exige sesión raíz vía lib/supervision/root.ts.

import Link from "next/link";
import { notFound } from "next/navigation";
import Tag from "@/components/ui/Tag";
import { BackLink } from "../../../../_ui";
import { pool } from "@/lib/db";
import { obtenerCampanaSupervisadaPorRoot } from "@/lib/supervision/root";
import { formatearTamano } from "@/lib/aportes/archivo";

export default async function UserContributionsPage({ params }: { params: Promise<{ campaignId: string; userId: string }> }) {
  const { campaignId, userId } = await params;
  const campaign = await obtenerCampanaSupervisadaPorRoot(campaignId);
  if (!campaign) notFound();
  if (!/^\d+$/.test(userId)) notFound();

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
      <BackLink href={`/supervisar/${campaignId}/usuarios`}>Volver a participantes</BackLink>
      <div className="mb-5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Aportes de participante</p>
        <h1 className="mt-2 text-2xl font-extrabold text-ink">{participant.participant_name}</h1>
        <p className="mt-1 text-[13px] text-ink-2">{campaign.name} · {participant.participant_email || "Sin correo"}</p>
      </div>
      <div className="mb-5 rounded-lg border border-line bg-sunken p-4 text-[13px] text-ink-2">Vista de solo lectura. El archivo de cada aporte no puede verse ni descargarse desde supervisión.</div>
      <div className="space-y-3">
        {result.rows.map((contribution) => (
          <Link key={contribution.id} href={`/supervisar/${campaignId}/usuarios/${userId}/aportes/${contribution.id}`} className="block rounded-lg border border-line bg-surface p-5 shadow-sm hover:border-accent">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[15px] font-extrabold text-ink">Aporte #{contribution.id}</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-ink-2">{contribution.description}</p></div><Tag tone={statusTone(String(contribution.status))}>{statusLabel[String(contribution.status)] ?? contribution.status}</Tag></div>
            <div className="mt-4 grid gap-3 border-t border-line pt-4 text-[12px] sm:grid-cols-4"><p><span className="text-ink-3">Enviado</span><br /><span className="font-mono text-ink-2">{new Date(contribution.submitted_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span></p><p><span className="text-ink-3">Tipo</span><br /><span className="text-ink-2">{contribution.file_type}</span></p><p><span className="text-ink-3">Peso</span><br /><span className="font-mono text-ink-2">{contribution.file_size_bytes ? `${formatearTamano(Number(contribution.file_size_bytes))}` : "Sin dato"}</span></p><p><span className="text-ink-3">Acción</span><br /><span className="font-semibold text-accent">Ver datos</span></p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
