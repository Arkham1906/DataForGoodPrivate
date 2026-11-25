// Pantalla /supervisar/[campaignId]/usuarios/[userId]/aportes: aportes de un participante.
// Server Component con SQL directo; exige sesión raíz vía lib/supervision/root.ts.
// Filtros (2026-11-22): ?q= (descripción o número), ?estado= y ?tipo= (tipo de archivo).

import Link from "next/link";
import { notFound } from "next/navigation";
import Tag from "@/components/ui/Tag";
import { BackLink } from "../../../../_ui";
import { pool } from "@/lib/db";
import { columnaDeRespuestas } from "@/lib/campanas/tabla-checklists";
import { columnasDeArchivo } from "@/lib/aportes/tabla-archivos";
import { obtenerCampanaSupervisadaPorRoot } from "@/lib/supervision/root";
import { formatearTamano } from "@/lib/aportes/archivo";
import type { Metadata } from "next";
import { exigirSesionRoot } from "@/lib/supervision/root";
import FiltrosEnLaUrl from "@/components/sistema/FiltrosEnLaUrl";
import { busquedaDeLaUrl, coincideConLaBusqueda, cuantosDeCuantos, opcionDeLaUrl } from "@/lib/filtros-en-la-url";

export const metadata: Metadata = { title: "Aportes de un participante" };

const ESTADOS = [
  { valor: "pendiente", etiqueta: "En revisión" },
  { valor: "aceptado", etiqueta: "Aceptados" },
  { valor: "rechazado", etiqueta: "Rechazados" },
] as const;

export default async function UserContributionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string; userId: string }>;
  searchParams: Promise<{ q?: string; estado?: string; tipo?: string }>;
}) {
  await exigirSesionRoot();
  const { campaignId, userId } = await params;
  const campaign = await obtenerCampanaSupervisadaPorRoot(campaignId);
  if (!campaign) notFound();
  if (!/^\d+$/.test(userId)) notFound();

  const result = await pool.query(
    `SELECT id, participant_name, participant_email, description, file_type, ${columnasDeArchivo()},
            ${columnaDeRespuestas()}, status, submitted_at, rejection_reason, first_pass_by
     FROM aportes
     WHERE campaign_id = $1 AND user_id = $2
     ORDER BY submitted_at DESC`,
    [campaignId, userId]
  );
  if (result.rowCount === 0) notFound();

  const participant = result.rows[0];
  const filtros = await searchParams;
  const tipos = [...new Set(result.rows.map((r) => String(r.file_type ?? "")).filter(Boolean))].sort();
  const q = busquedaDeLaUrl(filtros.q);
  const estado = opcionDeLaUrl(filtros.estado, ESTADOS.map((e) => e.valor));
  const tipo = opcionDeLaUrl(filtros.tipo, tipos);
  const aportes = result.rows.filter(
    (r) =>
      // "espera_final" ya no existe (revisión en una sola instancia), pero cuenta como en revisión.
      (!estado || (estado === "pendiente" ? r.status === "pendiente" || r.status === "espera_final" : r.status === estado)) &&
      (!tipo || r.file_type === tipo) &&
      coincideConLaBusqueda(q, r.description, r.id, `#${r.id}`),
  );
  const statusLabel: Record<string, string> = { pendiente: "En revisión", espera_final: "Espera aprobación final", aceptado: "Aceptado", rechazado: "Rechazado" };
  const statusTone = (status: string) => status === "aceptado" ? "ok" : status === "rechazado" ? "danger" : "warn";

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href={`/supervisar/${campaignId}/usuarios`}>Volver a participantes</BackLink>
      <div className="mb-5">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Aportes de participante</p>
        <h1 className="mt-2 text-2xl font-extrabold text-system-900">{participant.participant_name}</h1>
        <p className="mt-1 text-[13px] text-system-600">Los aportes que esta persona envió a la campaña, con su fecha, su tipo y su estado.</p>
        <p className="mt-1 text-[13px] text-system-500">{campaign.name} · {participant.participant_email || "Sin correo"}</p>
      </div>
      <div className="mb-5 rounded-lg border border-system-200 bg-system-100 p-4 text-[13px] text-system-600">Vista de solo lectura. El archivo de cada aporte no puede verse ni descargarse desde supervisión.</div>
      <FiltrosEnLaUrl
        busqueda={{ etiqueta: "Buscar aportes", placeholder: "Buscar por descripción o número" }}
        listas={[
          { clave: "estado", etiqueta: "Filtrar por estado", todas: "Estado: todos", opciones: [...ESTADOS] },
          ...(tipos.length > 1
            ? [{ clave: "tipo", etiqueta: "Filtrar por tipo de archivo", todas: "Tipo: todos", opciones: tipos.map((t) => ({ valor: t, etiqueta: t })) }]
            : []),
        ]}
      />
      {aportes.length < result.rows.length && (
        <p className="mb-3 text-[12.5px] text-system-500">{cuantosDeCuantos(aportes.length, result.rows.length)} aportes</p>
      )}
      {aportes.length === 0 && (
        <div className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">Ningún aporte coincide con los filtros.</div>
      )}
      <div className="space-y-3">
        {aportes.map((contribution) => (
          <Link key={contribution.id} href={`/supervisar/${campaignId}/usuarios/${userId}/aportes/${contribution.id}`} className="block rounded-lg border border-system-200 bg-white p-5 shadow-sm hover:border-brand-600">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[15px] font-extrabold text-system-900">Aporte #{contribution.id}</h2><p className="mt-2 max-w-2xl text-[13px] leading-6 text-system-600">{contribution.description}</p></div><Tag tone={statusTone(String(contribution.status))}>{statusLabel[String(contribution.status)] ?? contribution.status}</Tag></div>
            <div className="mt-4 grid gap-3 border-t border-system-200 pt-4 text-[12px] sm:grid-cols-4"><p><span className="text-system-500">Enviado</span><br /><span className="font-mono text-system-600">{new Date(contribution.submitted_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span></p><p><span className="text-system-500">Tipo</span><br /><span className="text-system-600">{contribution.file_type}</span></p><p><span className="text-system-500">Peso</span><br /><span className="font-mono text-system-600">{contribution.file_size_bytes ? `${formatearTamano(Number(contribution.file_size_bytes))}` : "Sin dato"}</span></p><p><span className="text-system-500">Acción</span><br /><span className="font-semibold text-brand-600">Ver datos</span></p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
