"use client";

// Pantalla /mis-campanas: campañas que creaste, con filtros por estado.
// Componente cliente. Datos: GET /api/campanas?mine=true.
// Acciones en "Más", con PATCH /api/campanas/[id] { status }: "Pausar" (activa → pausada),
// "Reanudar" (pausada → activa; no si la pausó la supervisión, que se muestra con su motivo)
// y "Finalizar" (activa o pausada). Pausar y Finalizar se confirman en una ventana emergente
// (ui/VentanaDeConfirmacion). "Compartir" (activa, 2026-10-19) abre el mismo cuadro de
// /campanas/[id] (enlace, redes sociales y QR; campanas/[id]/compartir.tsx). Solo el creador las ve:
// la lista viene de mine=true y el servidor revisa creator_id.

import { useEffect, useState } from "react";
import ButtonLink from "@/components/ui/ButtonLink";
import MenuDeAcciones from "@/components/ui/MenuDeAcciones";
import Tag from "@/components/ui/Tag";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Campaign, CampaignStatus } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { EsqueletoDeTarjetas } from "@/components/ui/Esqueletos";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import CompartirCampana from "@/app/(dashboard)/campanas/[id]/compartir";
import { resumenDeIncentivos, textoDelPeriodo } from "@/lib/campanas/especial-reglas";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

const labels: Record<CampaignStatus, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aceptada: "Aceptada",
  activa: "Activa",
  pausada: "Pausada",
  finalizada: "Finalizada",
  rechazada: "Rechazada",
};

type Filtro = "todas" | CampaignStatus;

const FILTROS: { valor: Filtro; etiqueta: string; fijo?: boolean }[] = [
  { valor: "todas", etiqueta: "Todas", fijo: true },
  { valor: "en_revision", etiqueta: "En revisión", fijo: true },
  { valor: "aceptada", etiqueta: "Aceptadas", fijo: true },
  { valor: "activa", etiqueta: "Activas", fijo: true },
  { valor: "pausada", etiqueta: "Pausadas" },
  { valor: "finalizada", etiqueta: "Finalizadas", fijo: true },
  { valor: "rechazada", etiqueta: "Rechazadas" },
  { valor: "borrador", etiqueta: "Borradores" },
];

function mapCampaign(row: Record<string, unknown>): Campaign {
  const status = String(row.status ?? "borrador") as CampaignStatus;
  return {
    id: String(row.id ?? ""),
    creatorId: String(row.creatorId ?? ""),
    creatorName: String(row.creatorName ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    tag: String(row.tag ?? ""),
    tematica: String(row.tematica ?? ""),
    status: labels[status] ? status : "borrador",
    dataTypes: Array.isArray(row.dataTypes) ? (row.dataTypes as Campaign["dataTypes"]) : [],
    goalContributions: Number(row.goalContributions ?? 0),
    quotaPerUser: Number(row.quotaPerUser ?? 1),
    currentContributions: Number(row.currentContributions ?? 0),
    approvedContributions: Number(row.approvedContributions ?? 0),
    pendingContributions: Number(row.pendingContributions ?? 0),
    rejectedContributions: Number(row.rejectedContributions ?? 0),
    participants: Number(row.participants ?? 0),
    startDate: row.startDate as string | null,
    endDate: row.endDate as string | null,
    locationCity: String(row.locationCity ?? ""),
    locationState: String(row.locationState ?? ""),
    xpPerContribution: Number(row.xpPerContribution ?? 0),
    daysRemaining: row.daysRemaining as number | null,
    hasReviewerAssigned: Boolean(row.hasReviewerAssigned),
    especial: (row.especial as Campaign["especial"]) ?? null,
    pausa: (row.pausa as Campaign["pausa"]) ?? null,
  };
}

export default function MisCampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [cambioError, setCambioError] = useState<Record<string, string>>({});
  // Campaña cuya ventana de "Pausar" está abierta.
  const [porPausar, setPorPausar] = useState<Campaign | null>(null);
  const [porCompartir, setPorCompartir] = useState<Campaign | null>(null);
  // Campaña cuya ventana de "Finalizar" está abierta (2026-10-16; antes window.confirm).
  const [porFinalizar, setPorFinalizar] = useState<Campaign | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    void fetch(`${BASE_PATH}/api/campanas?mine=true`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        setCampaigns(
          (Array.isArray(payload.data) ? payload.data : []).map((item: unknown) =>
            mapCampaign(item as Record<string, unknown>)
          )
        );
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas"))
      .finally(() => setCargando(false));
  }, [recarga]);

  const count = (status: CampaignStatus) => campaigns.filter((campaign) => campaign.status === status).length;
  // Los estados fijos siempre se ven; el resto solo si hay alguna campaña en él.
  const filtros = FILTROS.filter((f) => f.fijo || (f.valor !== "todas" && count(f.valor) > 0));
  const visibles = filtro === "todas" ? campaigns : campaigns.filter((campaign) => campaign.status === filtro);

  // Solo el creador ve esta pantalla (viene de mine=true): no hace falta
  // revisar rol ni dueño aparte, ya está filtrado por sesión.
  async function cambiarEstado(id: string, nuevo: "pausada" | "activa" | "finalizada") {
    // "Pausar" y "Finalizar" ya se confirmaron en su ventana emergente (VentanaDeConfirmacion).

    const fallo = {
      finalizada: "No se pudo finalizar la campaña",
      pausada: "No se pudo pausar la campaña",
      activa: "No se pudo reanudar la campaña",
    }[nuevo];
    setCambiandoId(id);
    setCambioError((prev) => ({ ...prev, [id]: "" }));
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nuevo }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? fallo);
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: nuevo } : c)));
    } catch (cause) {
      setCambioError((prev) => ({ ...prev, [id]: cause instanceof Error ? cause.message : fallo }));
    } finally {
      setCambiandoId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl lg:mx-0 lg:max-w-none">
      <div className="mb-2 flex items-start justify-between gap-4 max-md:gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mis campañas</h1>
          <p className="mt-1 text-[13px] text-system-600 max-md:text-[12px] max-md:leading-5">Administra las campañas que has creado.</p>
        </div>
        <ButtonLink
          href="/mis-campanas/nueva"
          variant="primary"
          size="sm"
          className="whitespace-nowrap max-md:max-w-[126px] max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px] max-md:leading-4"
        >
          Nueva campaña
        </ButtonLink>
      </div>

      <div
        className="dashboard-nav mb-5 mt-4 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:gap-1.5 md:flex-wrap md:overflow-visible md:pb-0"
        role="group"
        aria-label="Filtrar por estado"
      >
        {filtros.map((f) => {
          const activo = filtro === f.valor;
          const total = f.valor === "todas" ? campaigns.length : count(f.valor);
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => setFiltro(f.valor)}
              className={`shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${
                activo ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
              }`}
            >
              {f.etiqueta} <span className="font-mono text-[11.5px] opacity-80">{total}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p>
      ) : cargando ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando tus campañas…</span>
          <EsqueletoDeTarjetas cantidad={4} columnas={2} />
        </div>
      ) : campaigns.length === 0 ? (
        <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">Todavía no has creado campañas.</p>
      ) : visibles.length === 0 ? (
        <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">No tienes campañas en este estado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibles.map((campaign) => {
            const pct = campaign.goalContributions
              ? Math.min(100, Math.round((campaign.currentContributions / campaign.goalContributions) * 100))
              : 0;
            const puedeFinalizar = campaign.status === "activa" || campaign.status === "pausada";
            const cambiando = cambiandoId === campaign.id;

            return (
              <div key={campaign.id} className="rounded-lg border border-system-200 bg-white p-4 max-md:p-3.5">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-[13.5px] font-medium text-system-900 max-md:text-[13px]">{campaign.name}</p>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {campaign.especial && campaign.especial.etapa !== "terminada" && <Tag tone="warn">Especial ×{campaign.especial.multiplicador}</Tag>}
                    <Tag tone={campaign.status === "activa" ? "ok" : campaign.status === "aceptada" || campaign.status === "pausada" ? "warn" : "default"}>{labels[campaign.status]}</Tag>
                  </div>
                </div>
                <p className="mb-2.5 font-mono text-[11.5px] text-system-600 max-md:text-[10.5px]">
                  {campaign.startDate ?? "Sin fecha"} - {campaign.endDate ?? "Sin fecha"}
                </p>
                <ProgressBar
                  pct={campaign.status === "finalizada" ? 100 : pct}
                  tone={campaign.status === "finalizada" ? "ok" : "accent"}
                />
                <p className="my-2.5 font-mono text-[12px] text-system-600 max-md:text-[11px]">
                  {campaign.currentContributions} / {campaign.goalContributions} - {campaign.pendingContributions} aportes pendientes
                  {campaign.especial && <> · {textoDelPeriodo(campaign.especial)}</>}
                </p>
                {campaign.especial && (
                  <p className="-mt-1 mb-2.5 text-[12px] text-system-600 max-md:text-[11px]">{resumenDeIncentivos(campaign.especial)}</p>
                )}
                {/* Una acción principal y "Panel" a la vista; lo demás en "Más" (Ley de Hick, 2026-10-07). */}
                <div className="flex flex-wrap items-center gap-1.5 max-md:gap-1">
                  <ButtonLink href={`/mis-campanas/${campaign.id}/aportes`} variant="primary" size="sm" className="max-md:px-2 max-md:py-1.5 max-md:text-[11px]">
                    Revisar aportes
                    {campaign.pendingContributions > 0 && <span className="font-mono">({campaign.pendingContributions})</span>}
                  </ButtonLink>
                  <ButtonLink href={`/mis-campanas/${campaign.id}/panel`} size="sm" className="max-md:px-2 max-md:py-1.5 max-md:text-[11px]">Panel</ButtonLink>
                  <MenuDeAcciones
                    etiqueta={`Más acciones de ${campaign.name}`}
                    opciones={[
                      ...(campaign.status === "activa"
                        ? [{ etiqueta: "Compartir", alElegir: () => setPorCompartir(campaign) }]
                        : []),
                      { etiqueta: "Editar", href: `/mis-campanas/nueva?edit=${campaign.id}` },
                      ...(puedeFinalizar
                        ? [{ etiqueta: campaign.especial ? "Editar incentivos" : "Hacer especial", href: `/mis-campanas/${campaign.id}/especial` }]
                        : []),
                      ...(campaign.status === "activa"
                        ? [{ etiqueta: "Pausar campaña", alElegir: () => setPorPausar(campaign), deshabilitado: cambiando }]
                        : []),
                      // La que pausó la supervisión solo la reanuda la supervisión (2026-10-15).
                      ...(campaign.status === "pausada" && campaign.pausa?.por !== "supervision"
                        ? [{ etiqueta: "Reanudar campaña", alElegir: () => void cambiarEstado(campaign.id, "activa"), deshabilitado: cambiando }]
                        : []),
                      ...(puedeFinalizar
                        ? [
                            {
                              etiqueta: "Finalizar campaña",
                              alElegir: () => setPorFinalizar(campaign),
                              peligro: true,
                              deshabilitado: cambiando,
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
                {campaign.status === "pausada" && campaign.pausa?.por === "supervision" ? (
                  <div className="mt-2 rounded-lg border border-warning-200 bg-warning-50 p-2.5 text-[11.5px] text-system-900">
                    <p className="font-semibold">La supervisión pausó esta campaña</p>
                    <p className="mt-0.5 whitespace-pre-line text-system-600">Motivo: {campaign.pausa.motivo || "sin motivo registrado"}</p>
                    <p className="mt-0.5 text-system-600">No recibe aportes hasta que la supervisión la reanude.</p>
                  </div>
                ) : campaign.status === "pausada" && (
                  <p className="mt-2 text-[11.5px] text-system-600">Pausada: no recibe aportes ni aparece en Campañas hasta que la reanudes.</p>
                )}
                {cambioError[campaign.id] && (
                  <p role="alert" className="mt-2 text-[11.5px] text-error-700">{cambioError[campaign.id]}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {porCompartir && (
        <CompartirCampana
          key={porCompartir.id}
          campanaId={porCompartir.id}
          nombre={porCompartir.name}
          tematica={porCompartir.tematica || porCompartir.tag}
          abierto
          onCerrar={() => setPorCompartir(null)}
        />
      )}

      <VentanaDeConfirmacion
        abierto={porPausar !== null}
        titulo="¿Pausar esta campaña?"
        textoConfirmar="Pausar campaña"
        textoOcupado="Pausando…"
        ocupado={porPausar !== null && cambiandoId === porPausar.id}
        onCancelar={() => setPorPausar(null)}
        onConfirmar={() => {
          if (!porPausar) return;
          void cambiarEstado(porPausar.id, "pausada").finally(() => setPorPausar(null));
        }}
      >
        {porPausar && <p className="mb-3 font-semibold text-system-900">{porPausar.name}</p>}
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>No recibirá aportes nuevos, ni de personas con cuenta ni por su enlace público.</li>
          <li>Dejará de aparecer en Campañas y en Explorar.</li>
          <li>Los aportes que ya recibió se conservan y puedes seguir revisándolos.</li>
          <li>No se finaliza sola: si su fecha de cierre pasa mientras está pausada, tendrás que poner una nueva para reanudarla.</li>
        </ul>
        <p className="mt-3">Puedes reanudarla cuando quieras desde el menú «Más».</p>
      </VentanaDeConfirmacion>

      <VentanaDeConfirmacion
        abierto={porFinalizar !== null}
        titulo="¿Finalizar esta campaña?"
        textoConfirmar="Finalizar campaña"
        textoOcupado="Finalizando…"
        peligro
        ocupado={porFinalizar !== null && cambiandoId === porFinalizar.id}
        onCancelar={() => setPorFinalizar(null)}
        onConfirmar={() => {
          if (!porFinalizar) return;
          void cambiarEstado(porFinalizar.id, "finalizada").finally(() => setPorFinalizar(null));
        }}
      >
        {porFinalizar && <p className="mb-3 font-semibold text-system-900">{porFinalizar.name}</p>}
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Dejará de recibir aportes nuevos, ni de personas con cuenta ni por su enlace público.</li>
          <li>Dejará de aparecer en Campañas y en Explorar.</li>
          <li>Sus aportes aprobados se publicarán en Datos abiertos.</li>
        </ul>
        <p className="mt-3">Para volver a abrirla tendrás que editarla y ponerle una fecha de cierre nueva.</p>
      </VentanaDeConfirmacion>
    </div>
  );
}
