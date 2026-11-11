"use client";

// Presenta los aportes aceptados de un usuario en lista o cuadrícula.

import Link from "next/link";
import { useSyncExternalStore } from "react";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { MiniaturaDeAporte } from "@/components/ui/ArchivoDelAporte";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";

const CLAVE_VISTA = "dfg:revisiones:aportes-aceptados:vista";
const EVENTO_VISTA = "dfg:revisiones:aportes-aceptados:vista-cambio";
let vistaCuadriculaEnMemoria = true;

function leerVistaCuadricula(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_VISTA) !== "lista";
  } catch {
    return vistaCuadriculaEnMemoria;
  }
}

function suscribirVista(alCambiar: () => void): () => void {
  window.addEventListener("storage", alCambiar);
  window.addEventListener(EVENTO_VISTA, alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener(EVENTO_VISTA, alCambiar);
  };
}

function guardarVistaCuadricula(vistaCuadricula: boolean): void {
  vistaCuadriculaEnMemoria = vistaCuadricula;
  try {
    window.localStorage.setItem(CLAVE_VISTA, vistaCuadricula ? "cuadricula" : "lista");
  } catch {
    // Si el navegador bloquea el almacenamiento, la selección dura mientras la página siga abierta.
  }
  window.dispatchEvent(new Event(EVENTO_VISTA));
}

type AporteAceptado = {
  id: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  description: string;
  fileType: string;
  submittedAt: string;
  acceptedAt: string | null;
  sinArchivo: boolean;
  archivoBorrado: boolean;
};

export default function VistaAportesAceptados({
  campaignId,
  aportes,
}: {
  campaignId: string;
  aportes: AporteAceptado[];
}) {
  const vistaCuadricula = useSyncExternalStore(suscribirVista, leerVistaCuadricula, () => true);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Tag tone="ok">{aportes.length} aceptados</Tag>
        <div role="group" aria-label="Cambiar vista de aportes aceptados" className="relative flex shrink-0 gap-0 overflow-hidden rounded-lg border border-system-300 bg-system-100 p-1">
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

      <div className={vistaCuadricula ? "grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-2"}>
        {aportes.map((aporte) => (
          <Link
            key={aporte.id}
            href={`/revisiones/campanas/${campaignId}/usuarios/${aporte.participantId}/aportes/${aporte.id}`}
            className={vistaCuadricula
              ? "flex h-full min-w-0 flex-col gap-4 rounded-lg border border-system-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600"
              : "flex min-w-0 items-center gap-4 rounded-lg border border-system-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-600 max-md:items-start max-md:gap-3"}
          >
            {aporte.archivoBorrado ? (
              <div className={vistaCuadricula ? "flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-[12px] text-system-500" : "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-system-300 bg-system-100 text-center text-[9px] text-system-500"}>
                Archivo eliminado
              </div>
            ) : (
              <MiniaturaDeAporte
                aporteId={aporte.id}
                tipo={aporte.fileType}
                sinArchivo={aporte.sinArchivo}
                alt={`Aporte de ${aporte.participantName}`}
                className={vistaCuadricula ? "aspect-[4/3] w-full object-cover" : "h-14 w-14 shrink-0"}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-system-900">{aporte.participantName}</p>
                  <p className="truncate font-mono text-[10px] text-system-500">{aporte.participantEmail || "Sin correo"}</p>
                </div>
                <Tag tone="ok">Aceptado</Tag>
              </div>
              <div className={vistaCuadricula ? "min-h-20" : "min-w-0"}>
                <h2 className="text-[13px] font-extrabold text-system-900">Aporte #{aporte.id}</h2>
                <p className={vistaCuadricula ? "mt-1 line-clamp-2 text-[12px] leading-5 text-system-600" : "mt-1 line-clamp-1 text-[12px] leading-5 text-system-600"}>
                  {aporte.description || "Sin descripción"}
                </p>
              </div>
              <div className={vistaCuadricula ? "mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t border-system-200 pt-3 text-[11px]" : "flex shrink-0 items-center gap-4 text-[11px] max-md:flex-wrap max-md:gap-x-3"}>
                <p><span className="text-system-500">Tipo</span><br /><span className="font-semibold text-system-700">{NOMBRE_DE_TIPO[aporte.fileType as keyof typeof NOMBRE_DE_TIPO] ?? aporte.fileType}</span></p>
                <p><span className="text-system-500">Enviado</span><br /><span className="font-mono text-system-600">{new Date(aporte.submittedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span></p>
                <p><span className="text-system-500">Aceptado</span><br /><span className="font-mono text-system-600">{aporte.acceptedAt ? new Date(aporte.acceptedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin dato"}</span></p>
                <span className="col-span-2 border-t border-system-100 pt-2 font-semibold text-brand-600">Ver detalles →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
