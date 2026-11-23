"use client";

// Pestañas de /supervisar (por revisar / supervisadas) con la barra de filtros de
// components/campanas/BarraDeFiltros.tsx, aplicada en el navegador (lib/campanas/filtro-local.ts).
// Supervisadas, reportadas/rechazadas y finalizadas van en dos bloques: las del SuperUsuario y las de los otros supervisores.
// Desde el 2026-11-23 la pestaña y los filtros viven en la URL (?pestana=supervisadas|reportadas|finalizadas, ?q=,
// ?tematica=, ?etiqueta=, ?tipo=, ?orden=), escritos con history.replaceState (sin volver a pedir la página): al
// regresar de una campaña con "Volver" o con el botón atrás se ve la misma pestaña con los mismos filtros.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Tag from "@/components/ui/Tag";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import { avisoSinResultados, conFiltro, etiquetasPorTematica, filtrarCampanas, opcionesDeTematica, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import type { CampanaSupervisable } from "@/lib/supervision/root";
import SelectorDeVistaCampanas from "@/components/campanas/SelectorDeVistaCampanas";
import ProgressBar from "@/components/ui/ProgressBar";
import { BASE_PATH } from "@/lib/base-path";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
import { porcentajeDeMeta } from "@/lib/campanas/meta";

type TabKey = "pending" | "supervised" | "finished" | "flagged";

/** Cómo se escribe cada pestaña en ?pestana= ("Por supervisar" es la de entrada y no se escribe). */
const PESTANA_EN_LA_URL: Record<TabKey, string> = {
  pending: "",
  supervised: "supervisadas",
  flagged: "reportadas",
  finished: "finalizadas",
};

function pestanaDeLaUrl(valor: string): TabKey {
  const encontrada = (Object.keys(PESTANA_EN_LA_URL) as TabKey[]).find((k) => PESTANA_EN_LA_URL[k] === valor && valor);
  return encontrada ?? "pending";
}

/** Cambia parámetros de la URL actual sin navegar (vacío = se quita). */
function escribirEnLaUrl(cambios: Record<string, string | undefined>) {
  const parametros = new URLSearchParams(window.location.search);
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor) parametros.set(clave, valor);
    else parametros.delete(clave);
  }
  const consulta = parametros.toString();
  window.history.replaceState(null, "", consulta ? `?${consulta}` : window.location.pathname);
}

const tematicaDe = (campaign: CampanaSupervisable) => campaign.tag;

export default function PestanasDeSupervision({
  pendientes: todasPendientes,
  supervisadas: todasSupervisadas,
  finalizadas: todasFinalizadas,
  conIncidencia: todasConIncidencia,
}: {
  pendientes: CampanaSupervisable[];
  supervisadas: CampanaSupervisable[];
  finalizadas: CampanaSupervisable[];
  conIncidencia: CampanaSupervisable[];
}) {
  // El estado inicial sale de la URL real (useSearchParams), no de los searchParams del servidor: con el botón atrás
  // Next restaura la página de su caché, armada con la URL de cuando se cargó, sin lo que se escribió después.
  const consulta = useSearchParams();
  const [activeTab, setActiveTabState] = useState<TabKey>(() => pestanaDeLaUrl(consulta.get("pestana") ?? ""));
  const [filtros, setFiltros] = useState<FiltrosLocales>(() => ({
    q: consulta.get("q") ?? "",
    tematica: consulta.get("tematica") ?? "",
    etiqueta: consulta.get("etiqueta") ?? "",
    tipo: consulta.get("tipo") ?? "",
    orden: consulta.get("orden") ?? "",
  }));

  function setActiveTab(pestana: TabKey) {
    setActiveTabState(pestana);
    escribirEnLaUrl({ pestana: PESTANA_EN_LA_URL[pestana] });
  }

  const tematicas = useMemo(
    () => opcionesDeTematica([...todasPendientes, ...todasSupervisadas, ...todasFinalizadas, ...todasConIncidencia].map(tematicaDe)),
    [todasPendientes, todasSupervisadas, todasFinalizadas, todasConIncidencia],
  );

  // Las listas filtradas; los contadores de las pestañas usan las completas.
  const pendientes = useMemo(() => filtrarCampanas(todasPendientes, filtros, tematicaDe), [todasPendientes, filtros]);
  const supervisadas = useMemo(() => filtrarCampanas(todasSupervisadas, filtros, tematicaDe), [todasSupervisadas, filtros]);
  const finalizadas = useMemo(() => filtrarCampanas(todasFinalizadas, filtros, tematicaDe), [todasFinalizadas, filtros]);
  const conIncidencia = useMemo(() => filtrarCampanas(todasConIncidencia, filtros, tematicaDe), [todasConIncidencia, filtros]);

  function cambiarFiltro(clave: keyof ValoresDeFiltros, valor: string) {
    setFiltros((actuales) => conFiltro(actuales, clave, valor));
  }

  // Los filtros a la URL. En un efecto y no en cambiarFiltro: en móvil, "Filtrar" aplica varios filtros seguidos.
  useEffect(() => {
    escribirEnLaUrl({ q: filtros.q, tematica: filtros.tematica, etiqueta: filtros.etiqueta, tipo: filtros.tipo, orden: filtros.orden });
  }, [filtros]);

  const etiquetasDelFiltro = useMemo(
    () => etiquetasPorTematica([...todasPendientes, ...todasSupervisadas, ...todasFinalizadas, ...todasConIncidencia], tematicaDe),
    [todasPendientes, todasSupervisadas, todasFinalizadas, todasConIncidencia],
  );

  const renderCampaignList = (items: CampanaSupervisable[], total: number, vacio: string) => items.length === 0 ? (
    <div className="rounded-lg border border-system-200 bg-white p-5 text-[13px] text-system-600">
      {avisoSinResultados(total, vacio)}
    </div>
  ) : (
    <SelectorDeVistaCampanas
      toolbar={<span className="text-[12px] text-system-500">Vista</span>}
      persistKey="dfg:root:supervision:campanas:vista"
      renderChildren={(vistaCuadricula) => items.map((campaign) => {
        const etiquetaDeEstado = activeTab === "pending"
          ? campaign.supervision === "mia" ? <Tag tone="ok">La supervisas tú</Tag> : <Tag tone="warn">Disponible</Tag>
          : activeTab === "supervised"
            ? <Tag tone={campaign.status === "activa" ? "ok" : "warn"}>{campaign.status === "activa" ? "Activa" : campaign.status === "pausada" ? "Pausada" : "Aceptada"}</Tag>
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
            href={`/supervisar/${campaign.id}`}
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
                <p className="mt-2 text-xs text-system-600">Supervisa: {campaign.supervisadaPor || "Sin asignar"}</p><p className="text-[12.5px] text-system-500">
                  {(campaign.creatorName || "Usuario")} · {(campaign.tag || "Sin temática")} · meta {Number(campaign.goalContributions ?? 0)} aportes
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
                    {(campaign.tag) && (
                      <div className="mt-2">
                        <Tag tone="ok" className="max-w-full truncate whitespace-nowrap">{campaign.tag}</Tag>
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 space-y-1 text-[11px] text-system-600"><p>Supervisa: {campaign.supervisadaPor || "Sin asignar"}</p>
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
                      <Tag key={type}>{NOMBRE_DE_TIPO[type as keyof typeof NOMBRE_DE_TIPO]}</Tag>
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

  // Datos abiertos que nadie más decidirá (2026-11-09, a pedido del usuario): las que supervisa el SuperUsuario o
  // que no tienen supervisor. El SuperUsuario no tiene cuenta y no recibe datos_por_decidir: se le avisa aquí.
  const datosPorDecidirTuyos = todasFinalizadas.filter(
    (c) => c.datosAbiertos?.estado === "pendiente" && c.supervision !== "otro",
  ).length;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "pending", label: "Por supervisar", count: todasPendientes.length },
    { key: "supervised", label: "Campañas supervisadas", count: todasSupervisadas.length },
    { key: "flagged", label: "Campañas reportadas / rechazadas", count: todasConIncidencia.length },
    { key: "finished", label: "Campañas finalizadas", count: todasFinalizadas.length },
  ];

  const todas = activeTab === "pending" ? todasPendientes : activeTab === "supervised" ? todasSupervisadas : activeTab === "finished" ? todasFinalizadas : todasConIncidencia;
  const filtradas = activeTab === "pending" ? pendientes : activeTab === "supervised" ? supervisadas : activeTab === "finished" ? finalizadas : conIncidencia;
  return (<div className="mx-auto max-w-4xl lg:mx-0 lg:max-w-none"><div className="mb-6"><div className="w-full min-w-0"><h1 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Supervisión · SuperUsuario</h1><div className="mt-3">      <div
        role="group"
        aria-label="Categorías de supervisión"
        className="dashboard-nav mb-5 w-full min-w-0 max-w-full touch-pan-x flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
      >
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            aria-pressed={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${
              activeTab === key ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
            }`}
          >
            {label}&nbsp; <span className="font-mono text-[11px]">{count}</span>
          </button>
        ))}
      </div>

</div>
          <p className="mt-1 text-[13px] text-system-600">
            {activeTab === "pending" ? `${pendientes.length} esperando revisión` : activeTab === "supervised" ? `${supervisadas.length} bajo supervisión` : activeTab === "finished" ? `${finalizadas.length} finalizadas` : `${conIncidencia.length} con incidencia`}
          </p>
        </div>
      </div>

      {datosPorDecidirTuyos > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-500 bg-warning-50 p-4" role="status">
          <p className="text-[13px] text-warning-900">
            <span className="font-bold">
              {datosPorDecidirTuyos === 1
                ? "1 campaña terminada espera tu decisión"
                : `${datosPorDecidirTuyos} campañas terminadas esperan tu decisión`}
            </span>{" "}
            sobre sus datos abiertos. Nadie más puede decidirlo: las supervisas tú o no tienen supervisor.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("finished")}
            className="shrink-0 rounded-pill border border-system-300 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-system-900 hover:border-brand-600"
          >
            Ver campañas finalizadas
          </button>
        </div>
      )}

      <BarraDeFiltros
        ordenRedondeado
        valores={filtros}
        tematicas={tematicas}
        etiquetasPorTematica={etiquetasDelFiltro}
        onCambiar={cambiarFiltro}
        colapsableEnMovil
      />

      {activeTab === "pending" ? renderCampaignList(filtradas, todas.length, "No hay campa\u00f1as pendientes.") : <div className="space-y-6">{[true, false].map((mias) => <section key={String(mias)}><h2 className="mb-3 text-sm font-bold text-system-900">{mias ? "Supervisadas por ti" : "Supervisadas por otros supervisores"}</h2>{renderCampaignList(filtradas.filter((c) => (c.supervision === "mia") === mias), todas.filter((c) => (c.supervision === "mia") === mias).length, "No hay campa\u00f1as en este apartado.")}</section>)}</div>}
    </div>
  );
}
