"use client";

// Pantalla /supervision/[campaignId]: revisar una campaña en_revision y dictaminar.
// Componente cliente. Datos: GET /api/campanas?id=.
// Acciones: tomar con PATCH /api/campanas/[id] { action: "tomar" }; dictaminar con
// PATCH { action: "aceptada" | "rechazada", motivoDeLista, motivo, sancion }. Al rechazar se puede sancionar
// al creador (components/supervision/FormularioDeRechazo); "Reportar" se quitó el 2026-10-16.
// Reglas en lib/supervision/decision.ts.
// Activa o pausada: PATCH { action: "pausar" | "reanudar" | "finalizar", motivo } con
// components/supervision/EstadoDeCampanaSupervisada (lib/supervision/estado-por-supervision.ts).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Tag from "@/components/ui/Tag";
import FormularioDeRechazo, { type RechazoPedido } from "@/components/supervision/FormularioDeRechazo";
import { BackLink } from "../_ui";
import { BASE_PATH } from "@/lib/base-path";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import EstadoDeCampanaSupervisada, { type CambioDeEstado } from "@/components/supervision/EstadoDeCampanaSupervisada";
import type { PausaDeCampana } from "@/lib/campanas/pausa";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

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
  approvedContributions?: number;
  participants?: number;
  quotaPerUser?: number;
  description?: string;
  dataTypes?: string[];
  locationCity?: string;
  locationState?: string;
  locationColonia?: string;
  startDate?: string | null;
  endDate?: string | null;
  pausa?: PausaDeCampana | null;
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
  const [errorDeDecision, setErrorDeDecision] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isMySupervision, setIsMySupervision] = useState(false);

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
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
  }, [campaignId, recarga]);

  async function handleDecision(action: "aceptada" | "rechazada", rechazo?: RechazoPedido) {
    if (!campaignId) return;

    try {
      setActionLoading(action);
      setErrorDeDecision(null);
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(rechazo ?? {}) }),
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
      // Junto a los botones, no en lugar de la página (como `error`): así se puede corregir y reintentar.
      setErrorDeDecision(cause instanceof Error ? cause.message : "No se pudo registrar la decisión");
    } finally {
      setActionLoading(null);
    }
  }

  // Pausar, reanudar o finalizar la campaña que supervisa (2026-10-15). Devuelve el error o null.
  async function handleCambioDeEstado(cambio: CambioDeEstado, motivo: string): Promise<string | null> {
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: cambio, motivo }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return payload?.error ?? "No se pudo cambiar el estado de la campaña";
      if (payload?.data) setCampaign(payload.data);
      return null;
    } catch {
      return "No se pudo cambiar el estado de la campaña";
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

  if (loading) {
    return <PantallaEsqueleto tipo="detalle" etiqueta="Cargando campaña…" className="mx-auto max-w-4xl" />;
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
                setErrorDeDecision(null);
                setShowRejectForm(true);
              }}
              disabled={actionLoading !== null}
              className="rounded-pill border border-error-700/40 bg-error-50 px-3.5 py-2 text-[12.5px] font-bold text-error-700 disabled:opacity-60"
            >
              Rechazar
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

      {errorDeDecision && (
        <div role="alert" className="mb-5 rounded-lg border border-error-700/30 bg-error-50 p-4 text-sm text-error-700">{errorDeDecision}</div>
      )}

      {showRejectForm && isMySupervision && campaign.status === "en_revision" && (
        <FormularioDeRechazo
          ocupado={actionLoading !== null}
          onCancelar={() => setShowRejectForm(false)}
          onConfirmar={(rechazo) => void handleDecision("rechazada", rechazo)}
        />
      )}

      <div className="mb-5 rounded-lg border border-system-200 bg-system-100 p-4 text-[13px] text-system-600">
        La decisión queda registrada y vinculada al supervisor que la toma.
      </div>

      {isMySupervision && !isCreator && (
        <EstadoDeCampanaSupervisada status={String(campaign.status ?? "")} pausa={campaign.pausa} onCambiar={handleCambioDeEstado} />
      )}

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
              <span className="font-mono">{Number(campaign.approvedContributions ?? 0)} / {Number(campaign.goalContributions ?? 0)} aprobados</span>
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
          {(campaign.status === "activa" || campaign.status === "pausada" || campaign.status === "finalizada") && (
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