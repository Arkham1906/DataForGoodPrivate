"use client";

// Pantalla /supervision/[campaignId]: revisar una campaña en_revision y dictaminar.
// Componente cliente. Datos: GET /api/campanas?id=.
// Acciones: tomar con PATCH /api/campanas/[id] { action: "tomar" }; dictaminar con
// PATCH { action: "aceptada" | "rechazada" | "reportada", motivo }. Reglas en lib/supervision/decision.ts.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Tag from "@/components/ui/Tag";
import { Textarea } from "@/components/ui/Input";
import { BackLink } from "../_ui";
import { BASE_PATH } from "@/lib/base-path";

type Campaign = {
  id: string;
  name: string;
  status?: string;
  tag?: string;
  tematica?: string;
  creatorName?: string;
  supervisorId?: string | null;
  supervisedByRoot?: boolean;
  organizer?: string;
  goalContributions?: number;
  currentContributions?: number;
  participants?: number;
  quotaPerUser?: number;
  description?: string;
  dataTypes?: string[];
  locationCity?: string;
  locationState?: string;
  locationColonia?: string;
  startDate?: string | null;
  endDate?: string | null;
};

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const campaignId = params.campaignId;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isCreator, setIsCreator] = useState(false);
  const [isMySupervision, setIsMySupervision] = useState(false);

  useEffect(() => {
    async function loadCampaign() {
      try {
        const response = await fetch(`${BASE_PATH}/api/campanas?id=${campaignId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("No se pudo cargar la campaña");
        }

        const payload = await response.json();
        setCampaign(payload?.data ?? null);
        setIsCreator(Boolean(payload?.viewer?.isCreator));
        setIsMySupervision(Boolean(payload?.viewer?.isMySupervision));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar la campaña");
      } finally {
        setLoading(false);
      }
    }

    if (campaignId) {
      void loadCampaign();
    }
  }, [campaignId]);

  async function handleDecision(action: "aceptada" | "rechazada" | "reportada", motivo = "") {
    if (!campaignId) return;

    try {
      setActionLoading(action);
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, motivo }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo registrar la decisión");
      }

      if (action === "aceptada") {
        router.push("/supervision/campanas");
        return;
      }

      router.push("/supervision");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la decisión");
    } finally {
      setActionLoading(null);
    }
  }

  // Una campaña la supervisa un solo supervisor: quien la toma primero.
  async function handleTake() {
    if (!campaignId) return;

    try {
      setActionLoading("tomar");
      setError(null);
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tomar" }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo tomar la campaña");
      }

      setCampaign(payload?.data ?? campaign);
      setIsMySupervision(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo tomar la campaña");
    } finally {
      setActionLoading(null);
    }
  }

  function confirmRejection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const motivo = rejectionReason.trim();
    if (!motivo) {
      setError("Debes explicar el motivo del rechazo");
      return;
    }
    void handleDecision("rechazada", motivo);
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl text-[13px] text-system-600">Cargando campaña…</div>;
  }

  if (error || !campaign) {
    return (
      <div className="mx-auto max-w-4xl">
        <BackLink href="/supervision">Volver a supervisar</BackLink>
        <p className="text-[14px] text-system-600">{error ?? "No se encontró la campaña."}</p>
      </div>
    );
  }

  const statusMap = {
    en_revision: { label: "En revisión", tone: "warn" },
    aceptada: { label: "Aceptada", tone: "warn" },
    activa: { label: "Activa", tone: "ok" },
    rechazada: { label: "Rechazada", tone: "danger" },
    borrador: { label: "Borrador", tone: "default" },
    finalizada: { label: "Finalizada", tone: "default" },
    pausada: { label: "Pausada", tone: "default" },
  } as const;

  const parseDateOnly = (date: string | null | undefined) => {
    if (!date) return null;
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const isAvailable = campaign.status === "en_revision" && !campaign.supervisorId && !campaign.supervisedByRoot;
  const currentStatus = statusMap[String(campaign.status ?? "en_revision") as keyof typeof statusMap] ?? { label: "En revisión", tone: "warn" };
  const formatDate = (date: string | null | undefined) => {
    const parsed = parseDateOnly(date);
    return parsed ? parsed.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "sin fecha";
  };
  const dataTypes = Array.isArray(campaign.dataTypes) && campaign.dataTypes.length > 0 ? campaign.dataTypes : ["texto"];
  const location = [campaign.locationColonia, campaign.locationCity, campaign.locationState].filter(Boolean).join(", ") || "Sin ubicación";

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink href="/supervision">Volver a supervisar</BackLink>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Detalle de campaña</p>
          <h1 className="mt-2 text-2xl font-extrabold text-system-900">{campaign.name}</h1>
          <p className="mt-1 text-[13px] text-system-600">
            {(campaign.tag || campaign.tematica || "Sin temática")} · creada por {campaign.creatorName || "Usuario"} · meta {Number(campaign.goalContributions ?? 0)} aportes
          </p>
        </div>

        {isCreator ? (
          // Un supervisor no supervisa sus propias campañas (el PATCH también lo rechaza).
          <Tag>Tu campaña · no puedes supervisarla</Tag>
        ) : isAvailable ? (
          <button
            type="button"
            onClick={() => void handleTake()}
            disabled={actionLoading !== null}
            className="rounded-pill bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60"
          >
            {actionLoading === "tomar" ? "Tomando…" : "Supervisar esta campaña"}
          </button>
        ) : !isMySupervision ? (
          <Tag>La supervisa otro supervisor</Tag>
        ) : (
        <div className="flex flex-wrap gap-2">
          {campaign.status === "en_revision" && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowRejectForm(true);
              }}
              disabled={actionLoading !== null}
              className="rounded-pill border border-error-700/40 bg-error-50 px-3.5 py-2 text-[12.5px] font-bold text-error-700 disabled:opacity-60"
            >
              Rechazar
            </button>
          )}
          {campaign.status !== "finalizada" && (
            <button
              type="button"
              onClick={() => handleDecision("reportada")}
              disabled={actionLoading !== null}
              className="rounded-pill border border-system-300 bg-white px-3.5 py-2 text-[12.5px] font-bold text-system-600 disabled:opacity-60"
            >
              {actionLoading === "reportada" ? "Reportando…" : "Reportar"}
            </button>
          )}
          {campaign.status === "en_revision" && (
            <button
              type="button"
              onClick={() => handleDecision("aceptada")}
              disabled={actionLoading !== null}
              className="rounded-pill border border-success-700/40 bg-success-50 px-3.5 py-2 text-[12.5px] font-bold text-success-700 disabled:opacity-60"
            >
              {actionLoading === "aceptada" ? "Aceptando…" : "Aceptar campaña"}
            </button>
          )}
        </div>
        )}
      </div>

      {showRejectForm && isMySupervision && campaign.status === "en_revision" && (
        <form onSubmit={confirmRejection} className="mb-5 rounded-lg border border-error-700/40 bg-error-50 p-4">
          <label htmlFor="campaign-rejection-reason" className="mb-2 block text-[13px] font-semibold text-system-900">
            Motivo del rechazo <span className="text-error-700">*</span>
          </label>
          <Textarea
            id="campaign-rejection-reason"
            rows={4}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Explica al creador por qué se rechaza la campaña"
            required
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              disabled={actionLoading !== null}
              className="rounded-pill border border-system-300 bg-white px-3.5 py-2 text-[12.5px] font-bold text-system-600 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={actionLoading !== null || !rejectionReason.trim()}
              className="rounded-pill bg-error-700 px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
            >
              {actionLoading === "rechazada" ? "Rechazando…" : "Confirmar rechazo"}
            </button>
          </div>
        </form>
      )}

      <div className="mb-5 rounded-lg border border-system-200 bg-system-100 p-4 text-[13px] text-system-600">
        La decisión queda registrada y vinculada al supervisor que la toma.
      </div>

      <section className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
        <p className="text-[13.5px] leading-6 text-system-600">{campaign.description}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex justify-between gap-4 border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Usuario de la campaña</span>
              <span className="text-right font-semibold">{campaign.creatorName || "Usuario"}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Organizador</span>
              <span className="text-right">{campaign.organizer || "Sin especificar"}</span>
            </div>
            <div className="flex justify-between gap-4 border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Temática</span>
              <span className="text-right">{campaign.tag || campaign.tematica || "Sin temática"}</span>
            </div>
            <div className="flex justify-between border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Estado</span>
              <Tag tone={currentStatus.tone}>{currentStatus.label}</Tag>
            </div>
            <div className="flex justify-between border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Tipo de aporte</span>
              <span>{dataTypes.join(" y ")}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between gap-4 border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Ubicación</span>
              <span className="text-right">{location}</span>
            </div>
            <div className="flex justify-between border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Periodo</span>
              <span className="text-right font-mono">{formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}</span>
            </div>
            <div className="flex justify-between border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Progreso</span>
              <span className="font-mono">{Number(campaign.currentContributions ?? 0)} / {Number(campaign.goalContributions ?? 0)} aportes</span>
            </div>
            <div className="flex justify-between border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Participantes</span>
              <span className="font-mono">{Number(campaign.participants ?? 0)}</span>
            </div>
            <div className="flex justify-between border-b border-system-200 pb-3 text-[13px]">
              <span className="text-system-600">Cuota por usuario</span>
              <span className="font-mono">{Number(campaign.quotaPerUser ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {(campaign.status === "activa" || campaign.status === "finalizada") && (
            <Link href={`/supervision/${campaign.id}/usuarios`} className="rounded-pill bg-brand-600 px-5 py-3 text-[12.5px] font-bold text-white shadow-sm hover:bg-brand-800">
              Ver participantes
            </Link>
          )}
          {isMySupervision && (
            <Link href={`/supervision/${campaign.id}/panel`} className="rounded-pill border border-system-300 bg-white px-5 py-3 text-[12.5px] font-bold text-system-600 hover:border-brand-600 hover:text-brand-600">
              Abrir panel
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}