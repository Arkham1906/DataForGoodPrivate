"use client";

// Lista de campañas del revisor (botones "en curso" y "finalizadas"): la pestaña "Campañas"
// (/revisiones/campanas y /revisiones/finalizadas; 2026-11-13, a pedido del usuario: el dashboard tiene
// su propia pestaña en /revisiones). Arriba, las pestañas Dashboard / Campañas (PestanasDelRevisor).
// Datos: GET /api/revisiones (campañas con campana_revisores.estado = 'aceptado').
// Filtros (búsqueda, temática, tipo de dato y orden): components/campanas/BarraDeFiltros.tsx,
// aplicados en el navegador con lib/campanas/filtro-local.ts.

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import PestanasDelRevisor, { RUTA_DE_CAMPANAS_DEL_REVISOR } from "@/components/revisiones/PestanasDelRevisor";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import ProgressBar from "@/components/ui/ProgressBar";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import { BASE_PATH } from "@/lib/base-path";
import { FILTROS_VACIOS, avisoSinResultados, filtrarCampanas, opcionesDeTematica, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import { EsqueletoDeFilas } from "@/components/ui/Esqueletos";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import { estaTerminada } from "@/lib/campanas/terminada";
import { etiquetaDeCierre } from "@/lib/campanas/etiqueta-de-cierre";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";

type ReviewCampaign = {
  id: string;
  name: string;
  description: string;
  tag: string;
  tematica: string;
  hasBanner: boolean;
  bannerVersion?: string;
  bannerScale: number;
  bannerPositionX: number;
  bannerPositionY: number;
  participants: number;
  status: string;
  pendingContributions: number;
  currentContributions: number;
  goalContributions: number;
  approvedContributions: number;
  creatorName: string;
  dataTypes: string[];
  endDate: string | null;
  daysRemaining: number | null;
};

const tematicaDe = (campaign: ReviewCampaign) => campaign.tag;

const CLAVE_VISTA_REVISIONES = "dfg:revisiones:campanas:vista";
const EVENTO_VISTA_REVISIONES = "dfg:revisiones:campanas:vista-cambio";
let vistaCuadriculaEnMemoria = true;

function leerVistaCuadricula(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_VISTA_REVISIONES) !== "lista";
  } catch {
    return vistaCuadriculaEnMemoria;
  }
}

function suscribirVista(alCambiar: () => void): () => void {
  window.addEventListener("storage", alCambiar);
  window.addEventListener(EVENTO_VISTA_REVISIONES, alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener(EVENTO_VISTA_REVISIONES, alCambiar);
  };
}

function guardarVistaCuadricula(vistaCuadricula: boolean): void {
  vistaCuadriculaEnMemoria = vistaCuadricula;
  try {
    window.localStorage.setItem(CLAVE_VISTA_REVISIONES, vistaCuadricula ? "cuadricula" : "lista");
  } catch {
    // La preferencia se conserva en memoria si el navegador bloquea el almacenamiento.
  }
  window.dispatchEvent(new Event(EVENTO_VISTA_REVISIONES));
}

export default function CampaignList({ completed = false }: { completed?: boolean }) {
  const [campaigns, setCampaigns] = useState<ReviewCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosLocales>(FILTROS_VACIOS);
  const vistaCuadricula = useSyncExternalStore(suscribirVista, leerVistaCuadricula, () => true);

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${BASE_PATH}/api/revisiones`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        const rows = Array.isArray(payload.data) ? payload.data as ReviewCampaign[] : [];
        setCampaigns(rows);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [completed, recarga]);

  const activeTab = completed ? "finalizadas" : "curso";
  const title = completed ? "Campañas finalizadas" : "Campañas en curso";
  const currentCount = campaigns.filter((campaign) => !estaTerminada(campaign.status)).length;
  const completedCount = campaigns.filter((campaign) => estaTerminada(campaign.status)).length;
  const tabCampaigns = useMemo(
    () => campaigns.filter((campaign) => completed ? estaTerminada(campaign.status) : !estaTerminada(campaign.status)),
    [campaigns, completed]
  );
  const visibleCampaigns = useMemo(() => filtrarCampanas(tabCampaigns, filtros, tematicaDe), [tabCampaigns, filtros]);
  const tematicas = useMemo(() => opcionesDeTematica(campaigns.map(tematicaDe)), [campaigns]);

  function cambiarFiltro(clave: keyof ValoresDeFiltros, valor: string) {
    setFiltros((actuales) => ({ ...actuales, [clave]: valor }));
  }

  return (
    <div className="mx-auto max-w-5xl lg:mx-0 lg:max-w-none">
      <PestanasDelRevisor />
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl">Revisor de aportes</h1>
        <p className="mt-1 text-[13px] text-system-600">Administra las campañas que tienes asignadas para revisar.</p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Estado de campañas">
        <Link href={RUTA_DE_CAMPANAS_DEL_REVISOR} className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${activeTab === "curso" ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"}`}>En curso {currentCount}</Link>
        <Link href="/revisiones/finalizadas" className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${activeTab === "finalizadas" ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"}`}>Finalizadas {completedCount}</Link>
      </nav>

      <BarraDeFiltros
        valores={filtros}
        tematicas={tematicas}
        onCambiar={cambiarFiltro}
        colapsableEnMovil
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-extrabold text-system-900">{title}</h2>
          {!loading && <Tag tone={completed ? "default" : "on"}>{visibleCampaigns.length}</Tag>}
        </div>
        <div role="group" aria-label="Cambiar vista de campañas" className="relative flex shrink-0 gap-0 overflow-hidden rounded-lg border border-system-300 bg-system-100 p-1">
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-[5px] top-[5px] z-0 h-10 w-10 rounded-md bg-brand-600 shadow-inner transition-transform duration-200 ease-out motion-reduce:transition-none ${vistaCuadricula ? "translate-x-full" : "translate-x-0"}`}
          />
          <Button
            type="button"
            size="sm"
            className={`!relative !z-10 !size-10 !rounded-md !border-transparent !bg-transparent !p-0 hover:!bg-transparent ${!vistaCuadricula ? "!text-white" : "!text-system-600"}`}
            onClick={() => guardarVistaCuadricula(false)}
            aria-label="Vista de lista"
            aria-pressed={!vistaCuadricula}
            title="Vista de lista"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </Button>
          <Button
            type="button"
            size="sm"
            className={`!relative !z-10 !size-10 !rounded-md !border-transparent !bg-transparent !p-0 hover:!bg-transparent ${vistaCuadricula ? "!text-white" : "!text-system-600"}`}
            onClick={() => guardarVistaCuadricula(true)}
            aria-label="Vista cuadriculada"
            aria-pressed={vistaCuadricula}
            title="Vista cuadriculada"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
          </Button>
        </div>
      </div>

      {loading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando campañas…</span>
          <EsqueletoDeFilas cantidad={3} />
        </div>
      ) : error ? <p className="rounded border border-error-700 bg-error-50 p-3 text-sm text-error-700">{error}</p> : visibleCampaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">
          {avisoSinResultados(tabCampaigns.length, `No tienes campañas ${completed ? "finalizadas" : "en curso"} asignadas.`)}
        </div>
      ) : (
        <div className={vistaCuadricula ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"}>
          {visibleCampaigns.map((campaign) => (
            vistaCuadricula ? (
              <Link key={campaign.id} href={`/revisiones/campanas/${campaign.id}`} className="flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-system-200 bg-white transition-colors hover:border-brand-600">
                <div data-campana-banner className="aspect-[16/10] overflow-hidden bg-system-100">
                  {campaign.hasBanner && (
                    <img
                      src={`${BASE_PATH}/api/campanas/${campaign.id}/banner?v=${encodeURIComponent(campaign.bannerVersion ?? "")}`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      style={{ objectPosition: `${campaign.bannerPositionX}% ${campaign.bannerPositionY}%`, transform: `scale(${campaign.bannerScale})` }}
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="min-h-[2.75rem] line-clamp-2 min-w-0 break-words text-[16px] font-semibold leading-snug text-system-900" title={campaign.name}>{campaign.name}</h3>
                  <div className="mt-2 flex h-8 items-start overflow-hidden">
                    <Tag tone="ok" className="max-w-full truncate whitespace-nowrap">{campaign.tematica || "Sin temática"}</Tag>
                  </div>
                  <div className="mt-auto">
                    <ProgressBar pct={campaign.goalContributions > 0 ? (campaign.approvedContributions / campaign.goalContributions) * 100 : 0} tone="ok" conPorcentaje />
                    <div className="mt-3 flex min-h-14 flex-wrap content-start gap-1.5 overflow-hidden">
                      {campaign.dataTypes.map((type) => <Tag key={type}>{NOMBRE_DE_TIPO[type as keyof typeof NOMBRE_DE_TIPO] ?? type}</Tag>)}
                      {!completed && <Tag tone="warn">{campaign.pendingContributions} pendientes</Tag>}
                    </div>
                    <p className="mt-2 min-h-5 border-t border-system-200 pt-2 text-[12px] text-system-600">{etiquetaDeCierre(campaign.daysRemaining)}</p>
                  </div>
                </div>
              </Link>
            ) : (
              <Link key={campaign.id} href={`/revisiones/campanas/${campaign.id}`} className="grid min-w-0 grid-cols-1 items-center gap-3 rounded-lg border border-system-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600 md:grid-cols-[minmax(240px,1.6fr)_minmax(170px,1fr)_minmax(140px,0.8fr)_minmax(190px,1.1fr)] md:gap-x-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded-md bg-system-100">
                    {campaign.hasBanner ? (
                      // eslint-disable-next-line @next/next/no-img-element -- el banner se sirve por una API autenticada.
                      <img
                        src={`${BASE_PATH}/api/campanas/${campaign.id}/banner?v=${encodeURIComponent(campaign.bannerVersion ?? "")}`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        style={{ objectPosition: `${campaign.bannerPositionX}% ${campaign.bannerPositionY}%`, transform: `scale(${campaign.bannerScale})` }}
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[8px] font-semibold uppercase tracking-[0.06em] text-system-400">Sin imagen</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 break-words text-[15px] font-extrabold text-system-900">{campaign.name}</h3>
                    <div className="mt-1">
                      <Tag tone="ok" className="max-w-full truncate whitespace-nowrap">{campaign.tag || campaign.tematica || "Sin temática"}</Tag>
                    </div>
                  </div>
                </div>
                <div className="min-w-0 text-[11px] text-system-600">
                  <p className="truncate" title={campaign.creatorName || "Usuario"}><span className="font-semibold text-system-700">Creador:</span> {campaign.creatorName || "Usuario"}</p>
                  <p className="mt-1">{campaign.participants} participantes</p>
                </div>
                <div className="min-w-0 text-[11px] text-system-600">
                  <p className="font-semibold text-system-700">Meta total:</p>
                  <p className="font-mono">{campaign.goalContributions.toLocaleString("es-MX")} aportes</p>
                  {!completed && <Tag tone="warn" className="mt-1">{campaign.pendingContributions} pendientes</Tag>}
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-semibold text-system-700">Tipo de dato:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {campaign.dataTypes.map((type) => <Tag key={type}>{NOMBRE_DE_TIPO[type as keyof typeof NOMBRE_DE_TIPO] ?? type}</Tag>)}
                  </div>
                </div>
              </Link>
            )
          ))}
        </div>
      )}
    </div>
  );
}
