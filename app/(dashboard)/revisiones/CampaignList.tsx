"use client";

// Lista de campañas del revisor (pestañas "en curso" y "finalizadas").
// Datos: GET /api/revisiones (campañas con campana_revisores.estado = 'aceptado').
// Filtros (búsqueda, temática, tipo de dato y orden): components/campanas/BarraDeFiltros.tsx,
// aplicados en el navegador con lib/campanas/filtro-local.ts.
// `resumen` (2026-11-13): el dashboard del revisor, que arma la página en el servidor; va bajo el título.

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import { BASE_PATH } from "@/lib/base-path";
import { FILTROS_VACIOS, avisoSinResultados, filtrarCampanas, opcionesDeTematica, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import { EsqueletoDeFilas } from "@/components/ui/Esqueletos";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import { estaTerminada } from "@/lib/campanas/terminada";

type ReviewCampaign = {
  id: string;
  name: string;
  description: string;
  tag: string;
  participants: number;
  status: string;
  pendingContributions: number;
  currentContributions: number;
  goalContributions: number;
  creatorName: string;
  dataTypes: string[];
  endDate: string | null;
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

export default function CampaignList({ completed = false, resumen }: { completed?: boolean; resumen?: ReactNode }) {
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
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl">Revisor de aportes</h1>
        <p className="mt-1 text-[13px] text-system-600">Administra las campañas que tienes asignadas para revisar.</p>
      </div>

      {resumen}

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Estado de campañas">
        <Link href="/revisiones" className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${activeTab === "curso" ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"}`}>En curso {currentCount}</Link>
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
            <Link key={campaign.id} href={`/revisiones/campanas/${campaign.id}`} className={vistaCuadricula ? "flex h-full min-w-0 flex-col rounded-lg border border-system-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-600" : "block rounded-lg border border-system-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-600"}>
              <div className={vistaCuadricula ? "flex min-h-32 flex-col justify-between gap-4" : "flex flex-wrap items-start justify-between gap-4"}>
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-[16px] font-extrabold text-system-900">{campaign.name}</h3>
                  <p className="mt-1 text-[12.5px] text-system-600">{campaign.tag || "Sin temática"} · {campaign.participants} participantes</p>
                  {campaign.description && <p className={vistaCuadricula ? "mt-3 line-clamp-3 text-[13px] leading-5 text-system-600" : "mt-3 line-clamp-2 max-w-2xl text-[13px] leading-5 text-system-600"}>{campaign.description}</p>}
                </div>
                <div className={vistaCuadricula ? "flex items-center justify-between gap-2 border-t border-system-100 pt-3" : "flex items-center gap-2"}>
                  {!completed && <Tag tone="warn">{campaign.pendingContributions} pendientes</Tag>}
                  <span className="ml-auto text-[12.5px] font-bold text-brand-600">Abrir campaña →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
