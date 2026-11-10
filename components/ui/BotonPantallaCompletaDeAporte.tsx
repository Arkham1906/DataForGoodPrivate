"use client";

// Abre el archivo del aporte a pantalla completa desde la pantalla de vista previa.

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import Button from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";
import type { DataType } from "@/types";

const MIME_PDF = "application/pdf";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIME_XLS = "application/vnd.ms-excel";

function envolverHtmlAislado(contenido: string) {
  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; connect-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { color: #172033; font: 16px/1.6 Arial, sans-serif; margin: 24px auto; max-width: 900px; padding: 0 16px; }
          img { height: auto; max-width: 100%; }
          table { border-collapse: collapse; max-width: 100%; }
          td, th { border: 1px solid #cbd5e1; padding: 6px 10px; }
        </style>
      </head>
      <body>${contenido}</body>
    </html>`;
}

function escaparHtml(valor: string) {
  return valor.replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caracter] ?? caracter);
}

export default function BotonPantallaCompletaDeAporte({
  aporteId,
  tipo,
  alt,
  descripcion,
  sinArchivo = false,
  children,
}: {
  aporteId: string | number;
  tipo: DataType;
  alt: string;
  descripcion: string;
  sinArchivo?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const solicitudRef = useRef(0);
  const solicitudAbortadaRef = useRef<AbortController | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [cargandoDocumento, setCargandoDocumento] = useState(false);
  const [htmlDocumento, setHtmlDocumento] = useState<string | null>(null);
  const [errorDocumento, setErrorDocumento] = useState<string | null>(null);
  const src = `${BASE_PATH}/api/aportes/${aporteId}/archivo`;

  async function cargarDocumento() {
    const solicitud = ++solicitudRef.current;
    const abortController = new AbortController();
    solicitudAbortadaRef.current = abortController;
    setCargandoDocumento(true);
    setHtmlDocumento(null);
    setErrorDocumento(null);

    try {
      const response = await fetch(src, { cache: "no-store", signal: abortController.signal });
      if (!response.ok) throw new Error(`No se pudo obtener el archivo (${response.status})`);
      const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim();
      const contenido = await response.arrayBuffer();
      let html: string;

      if (mime === MIME_XLSX || mime === MIME_XLS) {
        const XLSX = await import("@e965/xlsx");
        const libro = XLSX.read(new Uint8Array(contenido), { type: "array", sheetRows: 100 });
        if (libro.SheetNames.length === 0) throw new Error("El archivo de Excel no contiene hojas.");
        html = libro.SheetNames.map((nombre, indice) => {
          const hoja = libro.Sheets[nombre];
          return `<section><h2>${escaparHtml(nombre)}</h2>${XLSX.utils.sheet_to_html(hoja, { id: `hoja-${indice}` })}</section>`;
        }).join("");
      } else if (mime === MIME_PDF || mime === MIME_DOCX || mime === MIME_PPTX) {
        const { OfficeParser, OfficeGenerator } = await import("officeparser/slim");
        const worker = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const documento = await OfficeParser.parseOffice(new Uint8Array(contenido), {
          extractAttachments: true,
          pdfWorkerSrc: worker,
        });
        const generado = await OfficeGenerator.generate(documento, "html");
        html = generado.value;
      } else {
        throw new Error("Este formato no cuenta con vista previa en la aplicación.");
      }

      if (solicitud === solicitudRef.current && !abortController.signal.aborted) {
        setHtmlDocumento(envolverHtmlAislado(html));
      }
    } catch (error) {
      if (!abortController.signal.aborted && solicitud === solicitudRef.current) {
        console.error("Error preparando la vista previa local del archivo", error);
        setErrorDocumento("No se pudo abrir la vista previa. Puedes descargar el archivo para abrirlo con una aplicación compatible.");
      }
    } finally {
      if (solicitud === solicitudRef.current) setCargandoDocumento(false);
    }
  }

  function limpiarDocumento() {
    solicitudRef.current += 1;
    solicitudAbortadaRef.current?.abort();
    solicitudAbortadaRef.current = null;
    setCargandoDocumento(false);
    setHtmlDocumento(null);
    setErrorDocumento(null);
  }

  function abrir() {
    if (dialogRef.current?.open) return;
    dialogRef.current?.showModal();
    setAbierto(true);
    if (tipo === "documento") void cargarDocumento();
  }

  function cerrar() {
    dialogRef.current?.close();
  }

  return (
    <>
      {tipo === "foto" ? (
        <button
          type="button"
          onClick={abrir}
          className="block w-full cursor-zoom-in rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          aria-haspopup="dialog"
          aria-label="Abrir la imagen a pantalla completa"
        >
          {children}
        </button>
      ) : (
        <div className="relative">
          {children}
          {tipo === "documento" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={abrir}
              className="mt-2 w-full"
              aria-haspopup="dialog"
            >
              Abrir
            </Button>
          ) : tipo === "video" ? null : (
            <button
              type="button"
              onClick={abrir}
              className="absolute right-2 top-2 inline-flex size-10 items-center justify-center rounded-pill bg-system-900/80 text-white shadow-sm hover:bg-system-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-haspopup="dialog"
              aria-label="Abrir el aporte a pantalla completa"
              title="Abrir a pantalla completa"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => {
          setAbierto(false);
          limpiarDocumento();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) cerrar();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-system-950 p-4 text-white backdrop:bg-system-950/90"
        aria-label={alt}
      >
        <div className={`relative flex h-full w-full items-center justify-center ${tipo === "documento" ? "pt-12" : ""}`}>
          <button
            type="button"
            onClick={cerrar}
            className="absolute right-2 top-2 z-10 rounded-pill bg-system-800 px-4 py-2 text-sm font-semibold text-white hover:bg-system-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Cerrar
          </button>
          {tipo === "documento" && (
            <a
              href={src}
              download
              className="absolute right-24 top-2 z-10 rounded-pill bg-system-800 px-4 py-2 text-sm font-semibold text-white hover:bg-system-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Descargar original
            </a>
          )}
          {abierto && (sinArchivo ? (
            <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 text-system-900">
              <h2 className="mb-3 text-lg font-bold">Aporte de solo texto</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{descripcion}</p>
            </div>
          ) : tipo === "foto" ? (
            // eslint-disable-next-line @next/next/no-img-element -- archivo servido por API autenticada
            <img src={src} alt={alt} className="h-full w-full object-contain" />
          ) : tipo === "video" ? (
            <video src={src} controls playsInline preload="metadata" className="h-full w-full object-contain" aria-label={alt} />
          ) : tipo === "audio" ? (
            <div className="w-full max-w-xl rounded-lg border border-system-700 bg-system-900 p-6 text-center">
              <p className="mb-5 text-lg font-bold">Audio</p>
              <audio src={src} controls preload="metadata" className="w-full" aria-label={alt} />
            </div>
          ) : tipo === "texto" ? (
            <iframe src={src} title={alt} sandbox="" className="h-full w-full rounded-lg bg-white" />
          ) : tipo === "documento" ? (
            cargandoDocumento ? (
              <p role="status" className="text-sm text-system-100">Preparando vista previa en este dispositivo…</p>
            ) : errorDocumento ? (
              <p role="alert" className="max-w-xl rounded-lg border border-error-700 bg-system-900 p-6 text-sm text-white">
                {errorDocumento}
              </p>
            ) : htmlDocumento ? (
              <iframe
                srcDoc={htmlDocumento}
                title={`Vista previa de ${alt}`}
                sandbox=""
                className="h-full w-full rounded-lg bg-white"
              />
            ) : null
          ) : (
            <div className="w-full max-w-xl rounded-lg border border-system-700 bg-system-900 p-6 text-center">
              <p className="mb-3 text-lg font-bold">Vista previa no disponible</p>
              <p className="text-sm text-system-200">Puedes descargar el archivo para abrirlo con una aplicación compatible.</p>
            </div>
          ))}
        </div>
      </dialog>
    </>
  );
}
