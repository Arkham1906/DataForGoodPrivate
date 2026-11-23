"use client";

// Campo "Archivo" de los formularios para aportar (/campanas/[id]/aportar y /c/[token]).
// Muestra los formatos y tamaños de los tipos que acepta la campaña, avisa al momento si el
// archivo no sirve (errorDeArchivo de lib/aportes/archivo.ts; el servidor vuelve a validar)
// y, con video o audio, que esos se guardan con sus metadatos. Si la campaña acepta texto,
// el archivo es opcional y se puede quitar el elegido.
// `amplio` (2026-11-18, /campanas/[id]/aportar): zona grande con ícono, tipos en fichas, arrastrar y soltar,
// y el archivo elegido con vista previa (foto), tamaño, "Cambiar" y "Quitar". Sin `amplio` se ve como
// antes (lo usa así el formulario sin cuenta de /c/[token]).

import { useEffect, useMemo, useState } from "react";
import { IconoDeTipoDeArchivo, IconoSubir } from "@/components/aportes/IconosDelAporte";
import {
  AVISO_METADATOS_MEDIA,
  FORMATOS,
  acceptDeArchivo,
  archivoEsOpcional,
  errorDeArchivo,
  extensionesDe,
  formatearTamano,
  textoDeTamano,
  tipoPorNombre,
  type FormatoDeDocumento,
  type TipoDeArchivo,
} from "@/lib/aportes/archivo";

const NOMBRE: Record<TipoDeArchivo, string> = {
  foto: "Foto",
  video: "Video",
  audio: "Audio",
  documento: "Archivo",
  texto: "Texto",
};

export default function SelectorDeArchivo({
  tipos,
  formatosDeDocumento = [],
  archivo,
  error,
  onCambio,
  reinicio = 0,
  className = "",
  compactoEnEscritorio = false,
  amplio = false,
  mostrarAyudaSoloTexto = true,
}: {
  tipos: TipoDeArchivo[];
  /** Formatos de "Archivo" que acepta la campaña (2026-10-28); [] = todos. */
  formatosDeDocumento?: FormatoDeDocumento[];
  archivo: File | null;
  error: string | null;
  /** Archivo elegido (null si no sirve o se quitó) y el error para mostrar. */
  onCambio: (archivo: File | null, error: string | null) => void;
  /** Cambiarlo vacía el <input> (después de enviar). */
  reinicio?: number;
  className?: string;
  /** Reduce el espacio de la zona de selección en la vista amplia del formulario anónimo. */
  compactoEnEscritorio?: boolean;
  /** Vista grande con vista previa y arrastrar y soltar (pantalla de aportar con cuenta). */
  amplio?: boolean;
  mostrarAyudaSoloTexto?: boolean;
}) {
  // Al quitar el archivo se vacía también el <input>, para poder volver a elegir el mismo.
  const [vaciado, setVaciado] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const opcional = archivoEsOpcional(tipos);
  const conMetadatos = tipos.includes("video") || tipos.includes("audio");
  // Vista previa de una foto elegida; la URL se libera al cambiar de archivo o salir.
  const vistaPrevia = useMemo(
    () => (amplio && archivo && archivo.type.startsWith("image/") ? URL.createObjectURL(archivo) : null),
    [amplio, archivo]
  );
  useEffect(() => () => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  function revisar(elegido: File | null) {
    if (!elegido) return onCambio(null, null);
    const problema = errorDeArchivo(elegido, tipos, formatosDeDocumento);
    onCambio(problema ? null : elegido, problema);
  }

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    revisar(e.target.files?.[0] ?? null);
  }

  function quitar() {
    setVaciado((v) => v + 1);
    onCambio(null, null);
  }

  if (amplio) {
    const tipoElegido = archivo ? tipoPorNombre(archivo) : null;
    const entrada = (
      <input key={`${reinicio}-${vaciado}`} type="file" accept={acceptDeArchivo(tipos, formatosDeDocumento)} className="sr-only" onChange={elegir} />
    );
    return (
      <div className={className}>
        {archivo ? (
          <div className="flex items-center gap-4 rounded-xl border border-success-300 bg-success-50 p-3 max-sm:flex-col max-sm:items-stretch">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-success-200 bg-white text-success-700 max-sm:size-auto max-sm:h-40">
              {vistaPrevia ? (
                // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por next/image.
                <img src={vistaPrevia} alt="Vista previa del archivo elegido" className="h-full w-full object-cover" />
              ) : (
                <IconoDeTipoDeArchivo tipo={tipoElegido ?? "documento"} className="size-9" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-all text-[14px] font-semibold text-system-900">{archivo.name}</p>
              <p className="mt-0.5 text-[12px] text-system-600">
                {tipoElegido ? NOMBRE[tipoElegido] : "Archivo"} · {formatearTamano(archivo.size)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-pill border border-system-300 bg-white px-3 py-1 text-[12px] font-semibold text-system-800 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600 hover:border-brand-600">
                  {entrada}
                  Cambiar
                </label>
                <button type="button" onClick={quitar} className="rounded-pill border border-transparent px-3 py-1 text-[12px] font-semibold text-error-700 hover:bg-error-50">
                  Quitar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              revisar(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`group flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600 ${arrastrando ? "border-brand-600 bg-brand-50" : "border-system-300 bg-system-50 hover:border-brand-500 hover:bg-brand-50/60"}`}
          >
            {entrada}
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-transform group-hover:-translate-y-0.5">
              <IconoSubir className="size-6" />
            </span>
            <span className="text-[14px] font-semibold text-system-900">
              {arrastrando ? "Suelta el archivo aquí" : "Toca o haz clic para elegir un archivo"}
            </span>
            <span className="text-[12px] text-system-500 max-md:hidden">o arrástralo a este recuadro</span>
            <span className="mt-2 flex flex-wrap justify-center gap-1.5">
              {tipos.map((tipo) => (
                <span
                  key={tipo}
                  title={extensionesDe(tipo, formatosDeDocumento).join(" ")}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-system-200 bg-white px-2.5 py-1 text-[11.5px] text-system-700"
                >
                  <IconoDeTipoDeArchivo tipo={tipo} className="size-3.5 text-brand-600" />
                  <span className="font-semibold">{NOMBRE[tipo]}</span>
                  <span className="text-system-500">
                    {extensionesDe(tipo, formatosDeDocumento).join(" ")} · {textoDeTamano(FORMATOS[tipo].tamanoMaximo)}
                  </span>
                </span>
              ))}
            </span>
          </label>
        )}
        {mostrarAyudaSoloTexto && opcional && !archivo && (
          <p className="mt-2 text-[12px] text-system-600">
            ¿No tienes archivo? Puedes enviar <span className="font-semibold text-system-900">solo un texto</span>: escríbelo en el siguiente paso.
          </p>
        )}
        {conMetadatos && <p className="mt-2 text-[11.5px] leading-5 text-system-500">{AVISO_METADATOS_MEDIA}</p>}
        {error && <p role="alert" className="mt-2 rounded-lg border border-error-700 bg-error-50 p-2.5 text-[12px] text-error-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="mb-1.5 text-[13px] font-medium text-system-900">
        Archivo {opcional ? <span className="font-normal text-system-500">(opcional)</span> : <span className="text-error-700">*</span>}
      </p>
      <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-system-300 bg-system-100 p-6 text-center text-[13px] text-system-600 hover:border-brand-600 ${compactoEnEscritorio ? "lg:p-2" : ""}`}>
        <input key={`${reinicio}-${vaciado}`} type="file" accept={acceptDeArchivo(tipos, formatosDeDocumento)} className="hidden" onChange={elegir} />
        {archivo ? (
          <span className="font-medium break-all text-system-900">{archivo.name}</span>
        ) : (
          <>
            <span className="font-medium text-system-900">Toca o haz clic para elegir un archivo</span>
            {tipos.map((tipo) => (
              <span key={tipo} className="font-mono text-[11px]">
                {NOMBRE[tipo]}: {extensionesDe(tipo, formatosDeDocumento).join(" ")} · máximo {textoDeTamano(FORMATOS[tipo].tamanoMaximo)}
              </span>
            ))}
          </>
        )}
      </label>
      {opcional && (
        <p className="mt-1.5 text-[11.5px] text-system-500">
          {/* Desde el 2026-11-11 sin archivo se escribe un texto con título (aportes/CamposDelAporte). */}
          Sin archivo, puedes enviar solo un texto.
          {archivo && (
            <button type="button" className="ml-1 font-semibold text-brand-600 hover:underline" onClick={quitar}>
              Quitar archivo
            </button>
          )}
        </p>
      )}
      {conMetadatos && <p className="mt-1.5 text-[11.5px] text-system-500">{AVISO_METADATOS_MEDIA}</p>}
      {error && <p className="mt-2 rounded border border-error-700 bg-error-50 p-2 text-[12px] text-error-700">{error}</p>}
    </div>
  );
}
