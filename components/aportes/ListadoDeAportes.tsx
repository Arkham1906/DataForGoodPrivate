"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { MiniaturaDeAporte } from "@/components/ui/ArchivoDelAporte";
import EstrellasDeCalificacion from "@/components/aportes/EstrellasDeCalificacion";
import ExpDelAporte from "@/components/gamificacion/ExpDelAporte";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
import type { Contribution } from "@/types";

const CLAVE_VISTA_MIS_APORTES = "dfg:mis-aportes:vista";
const EVENTO_VISTA_MIS_APORTES = "dfg:mis-aportes:vista-cambio";
let vistaMisAportesEnMemoria = false;

function leerVistaDeMisAportes(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_VISTA_MIS_APORTES) === "cuadricula";
  } catch {
    return vistaMisAportesEnMemoria;
  }
}

function suscribirVistaDeMisAportes(alCambiar: () => void): () => void {
  const alCambiarVista = () => alCambiar();
  window.addEventListener("storage", alCambiarVista);
  window.addEventListener(EVENTO_VISTA_MIS_APORTES, alCambiarVista);
  return () => {
    window.removeEventListener("storage", alCambiarVista);
    window.removeEventListener(EVENTO_VISTA_MIS_APORTES, alCambiarVista);
  };
}

function guardarVistaDeMisAportes(vistaCuadricula: boolean): void {
  vistaMisAportesEnMemoria = vistaCuadricula;
  try {
    window.localStorage.setItem(CLAVE_VISTA_MIS_APORTES, vistaCuadricula ? "cuadricula" : "lista");
  } catch {
    // Si el navegador bloquea el almacenamiento, la selección dura mientras la página siga abierta.
  }
  window.dispatchEvent(new Event(EVENTO_VISTA_MIS_APORTES));
}

export function useVistaDeAportes() {
  return useSyncExternalStore(suscribirVistaDeMisAportes, leerVistaDeMisAportes, () => false);
}

export function SelectorDeVistaAportes() {
  const vistaCuadricula = useVistaDeAportes();
  return (
    <div role="group" aria-label="Cambiar vista de aportes" className="relative flex shrink-0 gap-0 overflow-hidden rounded-lg border border-system-300 bg-system-100 p-1">
      <span aria-hidden="true" className={`pointer-events-none absolute left-[3px] top-[3px] z-0 h-8 w-8 rounded-md bg-brand-600 shadow-inner transition-transform duration-200 ease-out motion-reduce:transition-none ${vistaCuadricula ? "translate-x-full" : "translate-x-0"}`} />
      <Button type="button" size="sm" className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${!vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`} onClick={() => guardarVistaDeMisAportes(false)} aria-label="Vista de lista" aria-pressed={!vistaCuadricula} title="Vista de lista">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Button>
      <Button type="button" size="sm" className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`} onClick={() => guardarVistaDeMisAportes(true)} aria-label="Vista cuadriculada" aria-pressed={vistaCuadricula} title="Vista cuadriculada">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
      </Button>
    </div>
  );

}

export type AporteEnListado = Pick<Contribution, "id" | "campaignId" | "campaignName" | "campaignTematica" | "fileType" | "fileMimeType" | "sinArchivo" | "status" | "calificacion" | "expOtorgada" | "submittedAt">;

export function ListadoDeAportes({ items }: { items: AporteEnListado[] }) {
  const vistaCuadricula = useVistaDeAportes();
  return (<div className={vistaCuadricula ? "grid grid-cols-2 gap-2 sm:gap-3" : "flex flex-col gap-2 sm:gap-3"}>{items.map((item) => {
        const estadoEtiqueta = item.status === "aceptado" ? "Aceptado" : item.status === "rechazado" ? "Rechazado" : "En revisión";
        const estadoTono = item.status === "aceptado" ? "ok" : item.status === "rechazado" ? "danger" : "warn";
        const nombreDeTipo = NOMBRE_DE_TIPO[item.fileType];
        const href = `/mis-aportes/${item.campaignId}/${item.id}`;

        return (
          <Link key={item.id} href={href} className={vistaCuadricula ? "flex h-full flex-col rounded-lg border border-system-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 max-md:p-3" : "flex items-center gap-3 rounded-lg border border-system-200 bg-white p-2.5 shadow-sm transition-colors hover:border-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 max-md:gap-2 max-md:p-2.5"}>
              {vistaCuadricula ? (
                <>
                  <MiniaturaDeAporte
                    aporteId={item.id}
                    tipo={item.fileType}
                    sinArchivo={item.sinArchivo}
                    mimeType={item.fileMimeType}
                    alt={`Vista previa de ${nombreDeTipo.toLowerCase()} en ${item.campaignName}`}
                    className="mb-2.5 aspect-video w-full max-w-60 mx-auto object-cover"
                  />
                  <div className="flex flex-1 flex-col text-left">
                    <div className="h-[72px] overflow-hidden">
                      <h2 className="line-clamp-2 text-[13px] leading-5 font-bold text-system-900">{item.campaignName}</h2>
                      <Tag tone={estadoTono} className="mt-1">{estadoEtiqueta}</Tag>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[12.5px] text-system-600">{item.campaignTematica || "Sin temática"}</p>
                    <div className="mt-1 mb-2 flex min-h-4 items-center gap-2 whitespace-nowrap text-[11px]">
                      {item.calificacion != null ? (
                        <EstrellasDeCalificacion valor={item.calificacion} className="text-[13px]" />
                      ) : (
                        <span className="text-system-500">Sin calificación</span>
                      )}
                      <ExpDelAporte estado={item.status} expOtorgada={item.expOtorgada} className="ml-auto" />
                    </div>
                    <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-system-200 pt-3 text-[12px]">
                      <div><dt className="text-system-500">Tipo</dt><dd className="mt-0.5 font-semibold text-system-900">{nombreDeTipo}</dd></div>
                      <div><dt className="text-system-500">Fecha</dt><dd className="mt-0.5 font-mono text-system-900">{new Date(item.submittedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</dd></div>
                    </dl>
                  </div>
                </>
              ) : (
                <>
                  <MiniaturaDeAporte aporteId={item.id} tipo={item.fileType} sinArchivo={item.sinArchivo} mimeType={item.fileMimeType} alt={`Vista previa de ${nombreDeTipo.toLowerCase()} en ${item.campaignName}`} className="h-12 w-12 shrink-0" />
                  <div className="min-w-0 flex-1 overflow-hidden text-left">
                    <div className="flex min-w-0 items-center gap-2 overflow-hidden text-[12px]">
                      <span className="truncate font-bold text-system-900">{item.campaignName}</span>
                      <span className="shrink-0 text-system-400">•</span>
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-system-500">{nombreDeTipo}</span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-[11px] text-system-600">
                      <span className="truncate">{item.campaignTematica || "Sin temática"}</span>
                      <span className="h-1 w-1 shrink-0 rounded-full bg-system-300" aria-hidden="true" />
                      <span className="hidden shrink-0 items-center md:inline-flex">
                        {item.calificacion != null ? (
                          <EstrellasDeCalificacion valor={item.calificacion} className="text-[13px]" />
                        ) : (
                          <span className="text-system-500">Sin calificación</span>
                        )}
                      </span>
                      <span className="hidden h-1 w-1 shrink-0 rounded-full bg-system-300 md:inline-block" aria-hidden="true" />
                      <span className="shrink-0">{new Date(item.submittedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
                      <span className="h-1 w-1 shrink-0 rounded-full bg-system-300" aria-hidden="true" />
                      <span className="shrink-0">{estadoEtiqueta}</span>
                    </div>
                    <span className="mt-1 flex items-center gap-2 md:hidden">
                      {item.calificacion != null ? (
                        <EstrellasDeCalificacion valor={item.calificacion} className="text-[13px]" />
                      ) : (
                        <span className="text-[11px] text-system-500">Sin calificación</span>
                      )}
                      <ExpDelAporte estado={item.status} expOtorgada={item.expOtorgada} />
                    </span>
                  </div>
                  <span className="hidden shrink-0 md:inline-flex">
                    <ExpDelAporte estado={item.status} expOtorgada={item.expOtorgada} />
                  </span>
                  <Tag tone={estadoTono} className="hidden shrink-0 md:inline-flex">{estadoEtiqueta}</Tag>
                </>
              )}
          </Link>
        );
      })}</div>);
}
