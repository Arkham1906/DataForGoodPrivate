"use client";

// Pestaña "Campañas" del supervisor (/supervision/campanas; hasta el 2026-11-13 era /supervision, page.tsx):
// campañas en revisión que puedes tomar y las que ya supervisas. /supervision es ahora el dashboard.
// Componente cliente. Datos: GET /api/campanas, GET /api/campanas?supervised=true y GET /api/auth/sesion.
// Filtros y categorías: components/campanas/BarraDeFiltros.tsx; aplicados en el navegador
// con lib/campanas/filtro-local.ts. Arriba, las pestañas Campañas / Reportes / Sanciones
// (components/moderacion/PestanasDeModeracion).

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import SelectorDeVistaCampanas from "@/components/campanas/SelectorDeVistaCampanas";
import { BASE_PATH } from "@/lib/base-path";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { NOMBRE_DE_TIPO, type TipoDeDato } from "@/lib/campanas/sistema-opciones";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { FILTROS_VACIOS, avisoSinResultados, conFiltro, etiquetasPorTematica, filtrarCampanas, opcionesDeTematica, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import PestanasDeModeracion from "@/components/moderacion/PestanasDeModeracion";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import { estaTerminada } from "@/lib/campanas/terminada";

type CampaignApiItem = {
  id: string;
  creatorId: string;
  supervisorId?: string | null;
  supervisedByRoot?: boolean;
  datosAbiertos?: { estado: string } | null;
  creatorName: string;
  name: string;
  hasBanner?: boolean;
  bannerVersion?: string;
  bannerScale?: number;
  bannerPositionX?: number;
  bannerPositionY?: number;
  tag?: string;
  tematica?: string;
  etiquetas?: { nombre: string; pendiente: boolean }[];
  status: string;
  latestSupervisionAction?: "aceptada" | "rechazada" | "reportada" | "reasignada" | null;
  approvedContributions?: number;
  goalContributions?: number;
  participants?: number;
  dataTypes?: TipoDeDato[];
  todoElPais?: boolean;
  locationCity?: string;
  locationState?: string;
};

const tematicaDe = (campaign: CampaignApiItem) => String(campaign.tag ?? campaign.tematica ?? "").trim();

type TabKey = "pending" | "supervised" | "finished" | "flagged";

export default function ListaDeSupervision() {
  const [pendingCampaigns, setPendingCampaigns] = useState<CampaignApiItem[]>([]);
  const [supervisedCampaigns, setSupervisedCampaigns] = useState<CampaignApiItem[]>([]);
  const [finishedCampaigns, setFinishedCampaigns] = useState<CampaignApiItem[]>([]);
  const [flaggedCampaigns, setFlaggedCampaigns] = useState<CampaignApiItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [filtros, setFiltros] = useState<FiltrosLocales>(FILTROS_VACIOS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function load() {
      try {
        const [campaignsResponse, supervisedResponse, sessionResponse] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/campanas?supervised=true`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" }),
        ]);

        if (!campaignsResponse.ok) {
          throw new Error("No se pudieron cargar las campañas");
        }

        if (!supervisedResponse.ok) {
          throw new Error("No se pudieron cargar las campañas supervisadas");
        }

        const campaignsPayload = await campaignsResponse.json();
        const supervisedPayload = await supervisedResponse.json();
        const sessionPayload = await sessionResponse.json().catch(() => ({ data: null }));
        const userId = sessionPayload?.data?.id ? String(sessionPayload.data.id) : null;

        const rows = Array.isArray(campaignsPayload?.data) ? campaignsPayload.data : [];
        const supervisedRows = Array.isArray(supervisedPayload?.data) ? supervisedPayload.data : [];
        const visible = rows.filter((campaign: CampaignApiItem) => {
          const isPending = String(campaign.status ?? "") === "en_revision";
          const isOwn = userId !== null && String(campaign.creatorId ?? "") === userId;
          // Solo las libres (cualquiera puede tomarlas) o las que ya tomó este
          // supervisor: una campaña tiene un único supervisor.
          const isFree = !campaign.supervisorId && !campaign.supervisedByRoot;
          const isMine = userId !== null && String(campaign.supervisorId ?? "") === userId;
          return isPending && !isOwn && (isFree || isMine);
        });

        setPendingCampaigns(visible);
        const supervised = supervisedRows as CampaignApiItem[];
        setSupervisedCampaigns(supervised.filter((campaign) => {
          const status = String(campaign.status ?? "");
          return status === "activa" || status === "aceptada";
        }));
        setFinishedCampaigns(supervised.filter((campaign) => estaTerminada(String(campaign.status ?? ""))));
        setFlaggedCampaigns(supervised.filter((campaign) =>
          campaign.latestSupervisionAction === "reportada" || String(campaign.status ?? "") === "rechazada"
        ));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [recarga]);

  const pendingCount = useMemo(() => pendingCampaigns.length, [pendingCampaigns]);
  const supervisedCount = useMemo(() => supervisedCampaigns.length, [supervisedCampaigns]);
  const finishedCount = useMemo(() => finishedCampaigns.length, [finishedCampaigns]);
  const flaggedCount = useMemo(() => flaggedCampaigns.length, [flaggedCampaigns]);

  function renderCategoryTabs(selectedTab: TabKey, onSelect: (tab: TabKey) => void) {
    const tabs: { key: TabKey; label: string; count: number }[] = [
      { key: "pending", label: "Por supervisar", count: pendingCount },
      { key: "supervised", label: "Campañas supervisadas", count: supervisedCount },
      { key: "flagged", label: "Campañas reportadas / rechazadas", count: flaggedCount },
      { key: "finished", label: "Campañas finalizadas", count: finishedCount },
    ];

    return (
      <div
        role="group"
        aria-label="Categorías de supervisión"
        tabIndex={0}
        className="dashboard-nav w-full min-w-0 max-w-full touch-pan-x flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
      >
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            aria-pressed={selectedTab === key}
            onClick={() => onSelect(key)}
            className={`shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${selectedTab === key ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"}`}
          >
            {label}&nbsp; <span className="font-mono text-[11px]">{count}</span>
          </button>
        ))}
      </div>
    );
  }

  const themeOptions = useMemo(
    () => opcionesDeTematica([...pendingCampaigns, ...supervisedCampaigns, ...finishedCampaigns, ...flaggedCampaigns].map(tematicaDe)),
    [pendingCampaigns, supervisedCampaigns, finishedCampaigns, flaggedCampaigns]
  );

  function cambiarFiltro(clave: keyof ValoresDeFiltros, valor: string) {
    setFiltros((actuales) => conFiltro(actuales, clave, valor));
  }

  const etiquetasDelFiltro = useMemo(
    () => etiquetasPorTematica([...pendingCampaigns, ...supervisedCampaigns, ...finishedCampaigns, ...flaggedCampaigns], tematicaDe),
    [pendingCampaigns, supervisedCampaigns, finishedCampaigns, flaggedCampaigns]
  );

  const filteredPendingCampaigns = useMemo(
    () => filtrarCampanas(pendingCampaigns, filtros, tematicaDe),
    [pendingCampaigns, filtros]
  );

  const filteredSupervisedCampaigns = useMemo(
    () => filtrarCampanas(supervisedCampaigns, filtros, tematicaDe),
    [supervisedCampaigns, filtros]
  );

  const filteredFinishedCampaigns = useMemo(
    () => filtrarCampanas(finishedCampaigns, filtros, tematicaDe),
    [finishedCampaigns, filtros]
  );

  const filteredFlaggedCampaigns = useMemo(
    () => filtrarCampanas(flaggedCampaigns, filtros, tematicaDe),
    [flaggedCampaigns, filtros]
  );

  // `todas`: las de la pestaña sin filtrar; sin el filtro de tipo se cuentan para el aviso de tipo de dato (2026-11-24).
  const renderCampaignList = (items: CampaignApiItem[], todas: CampaignApiItem[], vacio: string) => items.length === 0 ? (
    <div className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">
      {avisoSinResultados(todas.length, vacio, { tipo: filtros.tipo, sinFiltroDeTipo: filtrarCampanas(todas, { ...filtros, tipo: "" }, tematicaDe).length })}
    </div>
  ) : (
    <SelectorDeVistaCampanas
      toolbar={<span className="text-[12px] text-system-500">Vista</span>}
      persistKey="dfg:supervision:campanas:vista"
      renderChildren={(vistaCuadricula) => items.map((campaign) => {
        const etiquetaDeEstado = activeTab === "pending"
          ? campaign.supervisorId ? <Tag tone="ok">La supervisas tú</Tag> : <Tag tone="warn">Disponible</Tag>
          : activeTab === "supervised"
            ? <Tag tone={campaign.status === "activa" ? "ok" : "warn"}>{campaign.status === "activa" ? "Activa" : "Aceptada"}</Tag>
            : activeTab === "flagged"
              ? <Tag tone={campaign.latestSupervisionAction === "reportada" ? "warn" : "danger"}>{campaign.latestSupervisionAction === "reportada" ? "Reportada" : "Rechazada"}</Tag>
              : <Tag>Finalizada</Tag>;
        const datosPorDecidir = activeTab === "finished" && campaign.datosAbiertos?.estado === "pendiente";
        const ubicacion = textoDeUbicacion({
          todoElPais: campaign.todoElPais,
          municipio: campaign.locationCity,
          estado: campaign.locationState,
        }, "Sin ubicación");

        return (
          <Link
            key={campaign.id}
            href={`/supervision/${campaign.id}`}
            className={vistaCuadricula
              ? "block rounded-lg border border-system-200 bg-white p-5 shadow-sm transition-shadow hover:border-brand-600 hover:shadow-md"
              : "grid min-w-0 grid-cols-1 items-center gap-x-5 gap-y-3 rounded-lg border border-system-200 bg-white p-4 shadow-sm transition-shadow hover:border-brand-600 hover:shadow-md md:grid-cols-[minmax(0,1.3fr)_minmax(160px,1.2fr)_minmax(96px,0.7fr)_minmax(140px,1fr)] md:gap-x-4 xl:grid-cols-[minmax(190px,1.3fr)_minmax(200px,1.2fr)_minmax(110px,0.7fr)_minmax(160px,1fr)] xl:gap-x-5"}
          >
            {vistaCuadricula ? (
              <>
                <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-[15px] font-extrabold text-system-900">{campaign.name}</h2>
                  <div className="flex flex-wrap gap-1.5">{etiquetaDeEstado}{datosPorDecidir && <Tag tone="warn">Datos por decidir</Tag>}</div>
                </div>
                {campaign.hasBanner && (
                  <div data-campana-banner className="mt-3 aspect-[4/3] overflow-hidden rounded-lg bg-system-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${BASE_PATH}/api/campanas/${campaign.id}/banner?v=${encodeURIComponent(campaign.bannerVersion ?? "")}`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                      style={{ objectPosition: `${campaign.bannerPositionX ?? 50}% ${campaign.bannerPositionY ?? 50}%`, transform: `scale(${campaign.bannerScale ?? 1})` }}
                    />
                  </div>
                )}
                <p className="text-[12.5px] text-system-500">
                  {(campaign.creatorName || "Usuario")} · {(campaign.tag || campaign.tematica || "Sin temática")} · meta {Number(campaign.goalContributions ?? 0)} aportes
                </p>
                {activeTab === "supervised" && <div className="mt-3"><ProgressBar pct={porcentajeDeMeta(Number(campaign.approvedContributions ?? 0), Number(campaign.goalContributions ?? 0))} tone="ok" /><p className="mt-2 text-[11px] text-system-600">{campaign.approvedContributions ?? 0} / {campaign.goalContributions ?? 0} aportes aprobados · {campaign.participants ?? 0} participantes</p></div>}
              </>
            ) : (
              <>
                <div className="flex min-w-0 items-center justify-start gap-3 md:pr-8 xl:pr-14">
                  {campaign.hasBanner ? (
                    <div className="hidden h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-system-100 md:flex">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${BASE_PATH}/api/campanas/${campaign.id}/banner?v=${encodeURIComponent(campaign.bannerVersion ?? "")}`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        style={{ objectPosition: `${campaign.bannerPositionX ?? 50}% ${campaign.bannerPositionY ?? 50}%`, transform: `scale(${campaign.bannerScale ?? 1})` }}
                      />
                    </div>
                  ) : (
                    <div className="hidden h-12 w-12 shrink-0 md:block" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <h2 className="min-w-0 break-words text-[15px] font-extrabold text-system-900">{campaign.name}</h2>
                    {activeTab !== "pending" && <div className="mt-1 flex flex-wrap gap-1.5">{etiquetaDeEstado}{datosPorDecidir && <Tag tone="warn">Datos por decidir</Tag>}</div>}
                    {(campaign.tag || campaign.tematica) && (
                      <div className="mt-2">
                        <Tag tone="ok" className="max-w-full truncate whitespace-nowrap">{campaign.tag || campaign.tematica}</Tag>
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 space-y-1 text-[11px] text-system-600">
                  <p className="truncate" title={campaign.creatorName || "Usuario"}>
                    <span className="font-semibold text-system-700">Creador:</span> {campaign.creatorName || "Usuario"}
                  </p>
                  <p className="truncate" title={ubicacion}>
                    <span className="font-semibold text-system-700">Ubicación:</span> {ubicacion}
                  </p>
                </div>
                <div className="min-w-0 text-[11px] text-system-600">
                  <p className="font-semibold text-system-700">Meta total:</p>
                  <p className="font-mono">{Number(campaign.goalContributions ?? 0).toLocaleString("es-MX")} aportes</p>
                  {activeTab === "supervised" && <p className="mt-1">{campaign.approvedContributions ?? 0} aprobados · {campaign.participants ?? 0} participantes</p>}
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-semibold text-system-700">Tipo de dato:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(campaign.dataTypes ?? []).map((type) => (
                      <Tag key={type}>{NOMBRE_DE_TIPO[type]}</Tag>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Link>
        );
      })}
    />
  );

  if (loading) {
    return (
      <PantallaEsqueleto tipo="tabla" etiqueta="Cargando campañas por supervisar…" className="mx-auto max-w-4xl lg:mx-0 lg:max-w-none" />
    );
  }

  if (error) {
    return <div className="mx-auto max-w-4xl rounded-lg border border-error-700/30 bg-error-50 p-4 text-sm text-error-700 lg:mx-0 lg:max-w-none">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl lg:mx-0 lg:max-w-none">
      <PestanasDeModeracion zona="supervision" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="w-full min-w-0">
          {/* h1 con aspecto de etiqueta: el título de la pantalla (WCAG 1.3.1); antes era un <p>. */}
          <h1 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Supervisión</h1>
          <div className="mt-3 w-full min-w-0">{renderCategoryTabs(activeTab, setActiveTab)}</div>
          <p className="mt-1 text-[13px] text-system-600">
            {activeTab === "pending" ? `${filteredPendingCampaigns.length} esperando revisión` : activeTab === "supervised" ? `${filteredSupervisedCampaigns.length} bajo supervisión` : activeTab === "finished" ? `${filteredFinishedCampaigns.length} finalizadas` : `${filteredFlaggedCampaigns.length} con incidencia`}
          </p>
        </div>
      </div>

      <BarraDeFiltros
        ordenRedondeado
        valores={filtros}
        tematicas={themeOptions}
        etiquetasPorTematica={etiquetasDelFiltro}
        onCambiar={cambiarFiltro}
        colapsableEnMovil
      />

      {activeTab === "pending"
        ? renderCampaignList(filteredPendingCampaigns, pendingCampaigns, "No hay campañas pendientes por revisar.")
        : activeTab === "supervised"
          ? renderCampaignList(filteredSupervisedCampaigns, supervisedCampaigns, "Todavía no tienes campañas aceptadas bajo supervisión.")
          : activeTab === "finished"
            ? renderCampaignList(filteredFinishedCampaigns, finishedCampaigns, "Todavía no tienes campañas finalizadas.")
            : renderCampaignList(filteredFlaggedCampaigns, flaggedCampaigns, "No tienes campañas reportadas o rechazadas.")}
    </div>
  );
}
