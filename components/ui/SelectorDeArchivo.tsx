"use client";

// Campo "Archivo" de los formularios para aportar (/campanas/[id]/aportar y /c/[token]).
// Muestra los formatos y tamaños de los tipos que acepta la campaña, avisa al momento si el
// archivo no sirve (errorDeArchivo de lib/aportes/archivo.ts; el servidor vuelve a validar)
// y, con video o audio, que esos se guardan con sus metadatos. Si la campaña acepta texto,
// el archivo es opcional y se puede quitar el elegido.

import { useState } from "react";
import {
  AVISO_METADATOS_MEDIA,
  FORMATOS,
  acceptDeArchivo,
  archivoEsOpcional,
  errorDeArchivo,
  textoDeTamano,
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
  archivo,
  error,
  onCambio,
  reinicio = 0,
  className = "",
}: {
  tipos: TipoDeArchivo[];
  archivo: File | null;
  error: string | null;
  /** Archivo elegido (null si no sirve o se quitó) y el error para mostrar. */
  onCambio: (archivo: File | null, error: string | null) => void;
  /** Cambiarlo vacía el <input> (después de enviar). */
  reinicio?: number;
  className?: string;
}) {
  // Al quitar el archivo se vacía también el <input>, para poder volver a elegir el mismo.
  const [vaciado, setVaciado] = useState(0);
  const opcional = archivoEsOpcional(tipos);
  const conMetadatos = tipos.includes("video") || tipos.includes("audio");

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0] ?? null;
    if (!elegido) return onCambio(null, null);
    const problema = errorDeArchivo(elegido, tipos);
    onCambio(problema ? null : elegido, problema);
  }

  return (
    <div className={className}>
      <p className="mb-1.5 text-[13px] font-medium text-system-900">
        Archivo {opcional ? <span className="font-normal text-system-500">(opcional)</span> : <span className="text-error-700">*</span>}
      </p>
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-system-300 bg-system-100 p-6 text-center text-[13px] text-system-600 hover:border-brand-600">
        <input key={`${reinicio}-${vaciado}`} type="file" accept={acceptDeArchivo(tipos)} className="hidden" onChange={elegir} />
        {archivo ? (
          <span className="font-medium break-all text-system-900">{archivo.name}</span>
        ) : (
          <>
            <span className="font-medium text-system-900">Toca o haz clic para elegir un archivo</span>
            {tipos.map((tipo) => (
              <span key={tipo} className="font-mono text-[11px]">
                {NOMBRE[tipo]}: {FORMATOS[tipo].extensiones.join(" ")} · máximo {textoDeTamano(FORMATOS[tipo].tamanoMaximo)}
              </span>
            ))}
          </>
        )}
      </label>
      {opcional && (
        <p className="mt-1.5 text-[11.5px] text-system-500">
          Puedes enviar solo la descripción.
          {archivo && (
            <button type="button" className="ml-1 font-semibold text-brand-600 hover:underline" onClick={() => {
                setVaciado((v) => v + 1);
                onCambio(null, null);
              }}
            >
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
