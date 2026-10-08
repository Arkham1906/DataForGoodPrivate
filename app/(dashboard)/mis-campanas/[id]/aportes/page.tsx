"use client";

// Pantalla /mis-campanas/[id]/aportes: bandeja de aportes del creador.
// Componente cliente. Datos: GET /api/campanas/[id] y GET /api/aportes?campaignId= (solo el creador).
// Incluye la sección de participantes baneados (baneados.tsx). Los botones de arriba filtran
// la tabla por estado (antes parecían pestañas pero solo eran contadores).

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Tag from "@/components/ui/Tag";
import ButtonLink from "@/components/ui/ButtonLink";
import type { Campaign, Contribution } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import BaneadosDeCampana from "./baneados";
import PantallaEsqueleto from "@/components/ui/Esqueletos";

const STAGE_LABEL: Record<string, string> = {
  pendiente: "Sin revisar",
  espera_final: "Espera final",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};

type Filtro = "todos" | "pendientes" | "aceptados" | "rechazados";

const EN_FILTRO: Record<Filtro, (status: string) => boolean> = {
  todos: () => true,
  pendientes: (status) => status === "pendiente" || status === "espera_final",
  aceptados: (status) => status === "aceptado",
  rechazados: (status) => status === "rechazado",
};

export default function BandejaAportesPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [inbox, setInbox] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useEffect(() => {
    async function load() {
      try {
        const [campaignRes, aportesRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas/${params.id}`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/aportes?campaignId=${encodeURIComponent(params.id)}`, { cache: "no-store" }),
        ]);

        const campaignPayload = await campaignRes.json().catch(() => ({}));
        if (!campaignRes.ok) throw new Error(campaignPayload.error ?? "No se pudo cargar la campaña");
        setCampaign(campaignPayload.data as Campaign);

        const aportesPayload = await aportesRes.json().catch(() => ({}));
        if (!aportesRes.ok) throw new Error(aportesPayload.error ?? "No se pudieron cargar los aportes");
        setInbox(Array.isArray(aportesPayload.data) ? (aportesPayload.data as Contribution[]) : []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar la información");
      }
    }
    void load();
  }, [params.id]);

  if (error) return <p className="text-sm text-error-700">{error}</p>;
  if (!campaign) return <PantallaEsqueleto tipo="tabla" etiqueta="Cargando aportes…" />;

  const filtros: { id: Filtro; etiqueta: string }[] = [
    { id: "todos", etiqueta: "Todos" },
    { id: "pendientes", etiqueta: campaign.hasReviewerAssigned ? "Pendientes" : "Por revisar" },
    { id: "aceptados", etiqueta: "Aceptados" },
    { id: "rechazados", etiqueta: "Rechazados" },
  ];
  const visibles = inbox.filter((item) => EN_FILTRO[filtro](item.status));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/mis-campanas" className="mb-4 inline-block text-[13px] text-system-600 hover:text-system-900">
        ← Volver a mis campañas
      </Link>

      <h1 className="text-xl font-extrabold text-system-900">Aportes recibidos</h1>
      <p className="mb-4 text-[13px] text-system-600">{campaign.name}</p>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold ${
              filtro === f.id ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600"
            }`}
          >
            {f.etiqueta} <span className="ml-1 font-mono">{inbox.filter((item) => EN_FILTRO[f.id](item.status)).length}</span>
          </button>
        ))}
      </div>

      {campaign.hasReviewerAssigned ? (
        <div className="mb-5 rounded-lg border-l-4 border-brand-600 bg-system-100 p-3.5 text-[12.5px] text-system-600">
          Esta campaña tiene revisor asignado: puede aceptar o rechazar aportes igual que tú, y su
          decisión es final.
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-lg bg-warning-50 p-4 text-[12.5px] text-warning-800">
          <span>
            Esta campaña no tiene revisor de aportes asignado. Todos los envíos llegan
            sin filtro previo y tú decides en una sola instancia.
          </span>
          <ButtonLink href={`/mis-campanas/${campaign.id}/aportes/agregar-revisor`} size="sm">
            Agregar revisor
          </ButtonLink>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">
          {inbox.length === 0 ? "Aún no llegan aportes a esta campaña." : "No hay aportes en este estado."}
        </p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {visibles.map((item) => (
              <article key={item.id} className="rounded-lg border border-system-200 bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-system-900">{item.participantName}</p>
                    <p className="mt-1 font-mono text-[11.5px] text-system-400">
                      {new Date(item.submittedAt).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                      })} · {new Date(item.submittedAt).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Tag tone={item.status === "espera_final" ? "warn" : "default"}>
                    {STAGE_LABEL[item.status]}
                  </Tag>
                </div>
                <p className="mt-3 break-words text-[13px] text-system-600">{item.description}</p>
                <p className="mt-2 text-[12px] text-system-600">Tipo: {item.fileType}</p>
                <ButtonLink
                  href={`/mis-campanas/${campaign.id}/aportes/${item.id}`}
                  size="sm"
                  className="mt-3 w-full justify-center"
                >
                  Abrir
                </ButtonLink>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-system-200 md:block">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-system-100 text-[11px] uppercase tracking-wide text-system-400">
              <tr>
                <th className="px-3 py-2.5">Participante</th>
                <th className="px-3 py-2.5">Descripción</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Etapa</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((item) => (
                <tr key={item.id} className="border-t border-system-200">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-system-900">{item.participantName}</p>
                    <p className="font-mono text-[11.5px] text-system-400">
                      {new Date(item.submittedAt).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      ·{" "}
                      {new Date(item.submittedAt).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-system-600">{item.description}</td>
                  <td className="px-3 py-3 text-system-600">{item.fileType}</td>
                  <td className="px-3 py-3">
                    <Tag tone={item.status === "espera_final" ? "warn" : "default"}>
                      {STAGE_LABEL[item.status]}
                    </Tag>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <ButtonLink href={`/mis-campanas/${campaign.id}/aportes/${item.id}`} size="sm">
                      Abrir
                    </ButtonLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {!campaign.hasReviewerAssigned && (
        <div className="mt-4 rounded-lg bg-system-100 p-3.5 text-[12.5px] text-system-600">
          Sin revisor, todos los aportes los decides tú: un revisor puede aceptarlos o
          rechazarlos contigo y aligerar la cola de pendientes.
        </div>
      )}

      <BaneadosDeCampana campaignId={campaign.id} />
    </div>
  );
}
