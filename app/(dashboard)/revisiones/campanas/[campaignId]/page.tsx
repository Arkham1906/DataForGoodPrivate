"use client";

// Pantalla /revisiones/campanas/[campaignId]: aportes por revisar de una campaña.
// Componente cliente. Datos: GET /api/campanas/[id] y GET /api/aportes?campaignId=&reviewer=true (solo revisor aceptado).

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { MiniaturaDeAporte } from "@/components/ui/ArchivoDelAporte";
import type { Campaign, Contribution } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
import PantallaEsqueleto from "@/components/ui/Esqueletos";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

const CLAVE_VISTA_APORTES_PENDIENTES = "dfg:revisiones:aportes-pendientes:vista";
const EVENTO_VISTA_APORTES_PENDIENTES = "dfg:revisiones:aportes-pendientes:vista-cambio";
let vistaAportesPendientesEnMemoria = false;

function leerVistaAportesPendientes(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_VISTA_APORTES_PENDIENTES) === "cuadricula";
  } catch {
    return vistaAportesPendientesEnMemoria;
  }
}

function suscribirVistaAportesPendientes(alCambiar: () => void): () => void {
  window.addEventListener("storage", alCambiar);
  window.addEventListener(EVENTO_VISTA_APORTES_PENDIENTES, alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener(EVENTO_VISTA_APORTES_PENDIENTES, alCambiar);
  };
}

function guardarVistaAportesPendientes(vistaCuadricula: boolean): void {
  vistaAportesPendientesEnMemoria = vistaCuadricula;
  try {
    window.localStorage.setItem(CLAVE_VISTA_APORTES_PENDIENTES, vistaCuadricula ? "cuadricula" : "lista");
  } catch {
    // Si el navegador bloquea el almacenamiento, la selección dura mientras la página siga abierta.
  }
  window.dispatchEvent(new Event(EVENTO_VISTA_APORTES_PENDIENTES));
}

export default function ReviewerCampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const vistaCuadricula = useSyncExternalStore(suscribirVistaAportesPendientes, leerVistaAportesPendientes, () => false);
  const [error, setError] = useState<string | null>(null);

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function load() {
      try {
        const [campaignResponse, contributionsResponse] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas/${campaignId}`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/aportes?campaignId=${campaignId}&reviewer=true`, { cache: "no-store" }),
        ]);
        const campaignPayload = await campaignResponse.json().catch(() => ({}));
        const contributionsPayload = await contributionsResponse.json().catch(() => ({}));
        if (!campaignResponse.ok) throw new Error(campaignPayload.error ?? "No se pudo cargar la campaña");
        if (!contributionsResponse.ok) throw new Error(contributionsPayload.error ?? "No se pudieron cargar los aportes");
        setCampaign(campaignPayload.data as Campaign);
        setContributions(Array.isArray(contributionsPayload.data) ? contributionsPayload.data as Contribution[] : []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar la campaña");
      }
    }
    if (campaignId) void load();
  }, [campaignId, recarga]);

  if (error) return <p className="mx-auto max-w-4xl text-sm text-error-700">{error}</p>;
  if (!campaign) return <PantallaEsqueleto tipo="tabla" etiqueta="Cargando campaña…" className="mx-auto max-w-4xl" />;

  const pending = contributions.filter((item) => item.status === "pendiente");
  const accepted = contributions.filter((item) => item.status === "aceptado");

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={campaign.status === "finalizada" ? "/revisiones/finalizadas" : "/revisiones/campanas"} className="mb-4 inline-block text-[13px] text-system-600 hover:text-system-900">← Volver a campañas</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">Revisor de aportes</p><h1 className="mt-2 break-words text-2xl font-extrabold text-system-900">{campaign.name}</h1><p className="mt-1 text-[13px] text-system-600">Los aportes de esta campaña que esperan tu decisión y los que ya aceptaste. Abre uno para revisarlo.</p><p className="mt-1 text-[13px] text-system-500">{campaign.tag || "Sin temática"} · {campaign.participants} participantes</p></div>
        <Tag tone={campaign.status === "finalizada" ? "default" : "on"}>{campaign.status === "finalizada" ? "Finalizada" : "En curso"}</Tag>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <section className="flex min-h-32 flex-col rounded-lg border border-warning-200 bg-warning-50 p-4 sm:min-h-36">
          <p className="text-[12px] font-bold uppercase tracking-wide text-warning-800">Por aceptar</p>
          <p className="mt-1 text-3xl font-extrabold text-system-900">{pending.length}</p>
          <p className="mt-auto pt-2 text-[13px] text-system-600">Aportes que requieren tu revisión.</p>
        </section>
        <Link href={`/revisiones/campanas/${campaignId}/usuarios`} className="flex min-h-32 flex-col rounded-lg border border-system-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600 sm:min-h-36">
          <p className="text-[12px] font-bold uppercase tracking-wide text-success-700">Aportes aceptados</p>
          <p className="mt-1 text-3xl font-extrabold text-system-900">{accepted.length}</p>
          <p className="mt-auto flex items-center justify-between gap-3 pt-2 text-[13px] text-system-600">
            <span>Consulta directamente los aportes que aceptaste.</span>
            <span className="shrink-0 font-bold text-brand-600">Ver aportes →</span>
          </p>
        </Link>
      </div>

      <section className="rounded-lg border border-system-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-system-900">Aportes por aceptar</h2>
          <div className="flex shrink-0 items-center gap-2">
            <Tag tone="warn">{pending.length}</Tag>
            <div role="group" aria-label="Cambiar vista de aportes" className="relative flex shrink-0 gap-0 overflow-hidden rounded-lg border border-system-300 bg-system-100 p-1">
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-[5px] top-[5px] z-0 h-10 w-10 rounded-md bg-brand-600 shadow-inner transition-transform duration-200 ease-out motion-reduce:transition-none ${vistaCuadricula ? "translate-x-full" : "translate-x-0"}`}
              />
              <Button
                type="button"
                size="sm"
                className={`!relative !z-10 !size-10 !rounded-md !border-transparent !bg-transparent !p-0 hover:!bg-transparent ${!vistaCuadricula ? "!text-white" : "!text-system-600"}`}
                onClick={() => guardarVistaAportesPendientes(false)}
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
                onClick={() => guardarVistaAportesPendientes(true)}
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
        </div>
        {pending.length === 0 ? (
          <p className="rounded-lg bg-system-50 p-4 text-[13px] text-system-600">No hay aportes pendientes de validación.</p>
        ) : (
          <div className={vistaCuadricula ? "grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-2"}>
            {pending.map((item) => (
              <Link
                key={item.id}
                href={`/revisiones/${item.id}`}
                className={vistaCuadricula
                  ? "flex h-full min-w-0 flex-col gap-4 rounded-lg border border-system-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600"
                  : "flex min-w-0 items-center gap-4 overflow-hidden rounded-lg border border-system-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-600 max-md:items-start max-md:gap-3"}
              >
                {item.archivoBorrado ? (
                  <div className={vistaCuadricula ? "flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-[12px] text-system-500" : "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-center text-[9px] text-system-500"}>
                    Archivo eliminado
                  </div>
                ) : (
                  <MiniaturaDeAporte
                    aporteId={item.id}
                    tipo={item.fileType}
                    sinArchivo={item.sinArchivo}
                    mimeType={item.fileMimeType}
                    alt={`Aporte de ${item.participantName}`}
                    className={vistaCuadricula ? "aspect-[4/3] w-full object-cover" : "h-14 w-14 shrink-0"}
                  />
                )}
                <div className={vistaCuadricula ? "flex min-w-0 flex-1 flex-col gap-2" : "flex min-w-0 flex-1 flex-nowrap items-center gap-4 overflow-hidden"}>
                  <div className={vistaCuadricula ? "flex min-w-0 items-start justify-between gap-2" : "contents"}>
                    <p className="min-w-0 truncate text-[13px] font-bold text-system-900">{item.participantName}</p>
                    <Tag tone="warn" className="shrink-0">Pendiente</Tag>
                  </div>
                  <div className={vistaCuadricula ? "min-h-20" : "contents"}>
                    <h3 className="text-[13px] font-extrabold text-system-900">Aporte #{item.id}</h3>
                    <p className={vistaCuadricula ? "mt-1 line-clamp-2 text-[12px] leading-5 text-system-600" : "min-w-0 flex-1 truncate text-[12px] text-system-600"}>
                      {item.description || "Sin descripción"}
                    </p>
                  </div>
                  <div className={vistaCuadricula ? "mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t border-system-200 pt-3 text-[11px]" : "flex shrink-0 items-center gap-4 whitespace-nowrap text-[11px]"}>
                    <p><span className="text-system-500">Tipo</span><br /><span className="font-semibold text-system-700">{NOMBRE_DE_TIPO[item.fileType] ?? item.fileType}</span></p>
                    <p><span className="text-system-500">Enviado</span><br /><span className="font-mono text-system-600">{new Date(item.submittedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span></p>
                    <p><span className="text-system-500">Estado</span><br /><span className="font-mono text-system-600">Pendiente de revisión</span></p>
                    <span className="col-span-2 border-t border-system-100 pt-2 font-semibold text-brand-600">Revisar aporte →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
