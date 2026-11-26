// Pantalla /supervisar/[campaignId]/usuarios: participantes de la campaña.
// Server Component con SQL directo; la campaña se valida con obtenerCampanaSupervisadaPorRoot() (sesión raíz).
// Búsqueda por nombre o correo (?q=, 2026-11-22).

import { notFound } from "next/navigation";
import { ListaDeRenglones, Renglon } from "@/components/sistema/Renglones";
import { BackLink } from "../../_ui";
import { pool } from "@/lib/db";
import { obtenerCampanaSupervisadaPorRoot } from "@/lib/supervision/root";
import type { Metadata } from "next";
import { exigirSesionRoot } from "@/lib/supervision/root";
import FiltrosEnLaUrl from "@/components/sistema/FiltrosEnLaUrl";
import { busquedaDeLaUrl, coincideConLaBusqueda, cuantosDeCuantos } from "@/lib/filtros-en-la-url";

export const metadata: Metadata = { title: "Participantes de la campaña" };

export default async function CampaignUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  await exigirSesionRoot();
  const { campaignId } = await params;
  const campaign = await obtenerCampanaSupervisadaPorRoot(campaignId);
  if (!campaign) notFound();
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
  const q = busquedaDeLaUrl((await searchParams).q);
  const participantes = result.rows.filter((p) => coincideConLaBusqueda(q, p.name, p.email));

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink href={`/supervisar/${campaignId}`}>Volver al detalle de campaña</BackLink>
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Participantes</p>
        <h1 className="mt-2 text-2xl font-extrabold text-system-900">Usuarios · {campaign.name}</h1>
        <p className="mt-1 text-[13px] text-system-600">Las personas que enviaron aportes a esta campaña. Abre una para ver sus aportes y en qué etapa están.</p>
        <p className="mt-1 text-[13px] text-system-500">{cuantosDeCuantos(participantes.length, result.rows.length)} participantes con al menos un aporte</p>
      </div>

      {result.rows.length > 0 && (
        <FiltrosEnLaUrl busqueda={{ etiqueta: "Buscar participantes", placeholder: "Buscar por nombre o correo" }} />
      )}

      {result.rowCount === 0 ? (
        <div className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">Todavía no hay usuarios participantes.</div>
      ) : participantes.length === 0 ? (
        <div className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">Ningún participante coincide con «{(await searchParams).q}».</div>
      ) : (
        // Renglones como la vista de lista de Mis aportes (2026-11-25; antes una tabla): toda la tarjeta abre sus
        // aportes. Sin tarjetas propias para el teléfono, así que se ven igual en todos los anchos.
        <ListaDeRenglones etiqueta="Participantes">
          {participantes.map((participant) => (
            <Renglon
              key={participant.id}
              href={`/supervisar/${campaignId}/usuarios/${participant.id}/aportes`}
              titulo={participant.name}
              detalles={[
                participant.email || "Sin correo",
                `${participant.contributions} ${participant.contributions === 1 ? "aporte" : "aportes"}`,
                `Último aporte: ${new Date(participant.last_submitted).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`,
              ]}
            />
          ))}
        </ListaDeRenglones>
      )}
      <div className="mt-5 rounded-lg border border-system-200 bg-system-100 p-4 text-[13px] text-system-600">Vista exclusiva del SuperUsuario como supervisor de esta campaña. Los archivos de los aportes no están disponibles en esta sección.</div>
    </div>
  );
}
