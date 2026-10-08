// Pantalla .../usuarios/[userId]/aportes/[aporteId] de /revisiones: detalle de un aporte (solo lectura).
// Server Component con SQL directo tras exigirUsuario(); solo para revisores aceptados de la campaña.

import Link from "next/link";
import { notFound } from "next/navigation";
import Tag from "@/components/ui/Tag";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/session";
import { BASE_PATH } from "@/lib/base-path";
import { formatearTamano } from "@/lib/aportes/archivo";

export default async function ReviewerContributionDetailPage({ params }: { params: Promise<{ campaignId: string; userId: string; aporteId: string }> }) {
  const { campaignId, userId, aporteId } = await params;
  const reviewer = await exigirUsuario();

  const result = await pool.query(
    `SELECT a.id, a.participant_name, a.participant_email, a.description, a.file_type,
            a.file_size_bytes, a.caracteristicas, a.submitted_at, a.reviewed_at,
            c.name AS campaign_name
     FROM aportes a
     JOIN campanas c ON c.id = a.campaign_id
     JOIN campana_revisores cr ON cr.campana_id = c.id
     WHERE a.id = $1 AND a.campaign_id = $2 AND a.user_id = $3
       AND a.first_pass_by_user_id = $4 AND a.status = 'aceptado'
       AND cr.usuario_id = $4 AND cr.estado = 'aceptado'
     LIMIT 1`,
    [aporteId, campaignId, userId, reviewer.id]
  );
  if (result.rowCount === 0) notFound();

  const contribution = result.rows[0];
  const features = Array.isArray(contribution.caracteristicas) ? contribution.caracteristicas : [];
  const fileSize = contribution.file_size_bytes ? ` · ${formatearTamano(Number(contribution.file_size_bytes))}` : "";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/revisiones/campanas/${campaignId}/usuarios/${userId}/aportes`} className="mb-5 inline-block text-[13px] text-system-600 hover:text-system-900">
        ← Volver a aportes
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[.12em] text-brand-600">Detalle del aporte</p>
          <h1 className="mt-2 text-2xl font-extrabold text-system-900">Aporte #{contribution.id}</h1>
          <p className="mt-1 text-[13px] text-system-600">{contribution.participant_name} · {contribution.campaign_name}</p>
        </div>
        <Tag tone="ok">Aceptado por ti</Tag>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
        <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-[15px] font-extrabold text-system-900">Archivo aprobado</h2>
          {contribution.file_type === "foto" ? (
            <a href={`${BASE_PATH}/api/aportes/${aporteId}/archivo`} target="_blank" rel="noreferrer" className="block">
              <img
                src={`${BASE_PATH}/api/aportes/${aporteId}/archivo`}
                alt={`Imagen aportada por ${contribution.participant_name}`}
                className="aspect-video w-full rounded-lg border border-system-300 bg-system-100 object-contain"
              />
              <span className="mt-3 inline-block text-[12.5px] font-bold text-brand-600">Abrir imagen en tamaño completo</span>
            </a>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-[12.5px] text-system-400">
              Vista previa no disponible para {contribution.file_type}
            </div>
          )}
          <p className="mt-3 font-mono text-[11.5px] text-system-400">{contribution.file_type}{fileSize}</p>
        </section>

        <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-extrabold text-system-900">Datos del aporte</h2>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Participante</dt><dd className="text-right font-medium text-system-900">{contribution.participant_name}</dd></div>
            <div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Correo</dt><dd className="text-right text-system-900">{contribution.participant_email || "Sin correo"}</dd></div>
            <div className="border-b border-system-200 pb-3"><dt className="text-system-600">Descripción</dt><dd className="mt-1 leading-6 text-system-900">{contribution.description}</dd></div>
            <div className="border-b border-system-200 pb-3"><dt className="text-system-600">Características</dt><dd className="mt-2 flex flex-wrap gap-1.5">{features.length > 0 ? features.map((item: string) => <Tag key={item}>{item}</Tag>) : "Sin características"}</dd></div>
            <div className="flex justify-between gap-4 border-b border-system-200 pb-3"><dt className="text-system-600">Enviado</dt><dd className="text-right font-mono">{new Date(contribution.submitted_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-system-600">Aceptado</dt><dd className="text-right font-mono">{contribution.reviewed_at ? new Date(contribution.reviewed_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin dato"}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
