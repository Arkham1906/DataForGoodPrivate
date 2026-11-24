"use client";

// Abre el archivo del aporte a pantalla completa desde la pantalla de vista previa.

import { useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import Button from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";
import type { DataType } from "@/types";
import { MarcaDeAgua, useProteccionDeAportes } from "@/components/aportes/ProteccionDeAportes";
import TextoDelAporte from "@/components/ui/TextoDelAporte";

const MIME_PDF = "application/pdf";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIME_XLS = "application/vnd.ms-excel";

// `protegido` (pantallas de revisión, 2026-11-12): sin seleccionar texto ni arrastrar imágenes dentro de la
// vista previa; el iframe no tiene scripts, así que no se puede bloquear de otra forma.
function envolverHtmlAislado(contenido: string, protegido = false) {
  const sinCopiar = protegido
    ? "html, body { -webkit-user-select: none; user-select: none; } img { -webkit-user-drag: none; pointer-events: none; }"
    : "";
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
          ${sinCopiar}
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
  mimeType,
  alt,
  descripcion,
  sinArchivo = false,
  children,
}: {
  aporteId: string | number;
  tipo: DataType;
  mimeType?: string;
  alt: string;
  descripcion: string;
  sinArchivo?: boolean;
  children: ReactNode;
}) {
  const proteccion = useProteccionDeAportes();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const origenRef = useRef<{ boton: HTMLButtonElement; x: number; y: number } | null>(null);
  const solicitudRef = useRef(0);
  const solicitudAbortadaRef = useRef<AbortController | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [cargandoDocumento, setCargandoDocumento] = useState(false);
  const [htmlDocumento, setHtmlDocumento] = useState<string | null>(null);
  const [errorDocumento, setErrorDocumento] = useState<string | null>(null);
  const src = `${BASE_PATH}/api/aportes/${aporteId}/archivo`;
  const esTextoPlano = tipo === "texto" || mimeType === "text/plain";

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
        setHtmlDocumento(envolverHtmlAislado(html, proteccion !== null));
      }
    } catch (error) {
      if (!abortController.signal.aborted && solicitud === solicitudRef.current) {
        console.error("Error preparando la vista previa local del archivo", error);
        setErrorDocumento("No se pudo abrir la vista previa del archivo.");
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

  function abrir(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (dialogRef.current?.open) return;
    origenRef.current = { boton: event.currentTarget, x: window.scrollX, y: window.scrollY };
    dialogRef.current?.showModal();
    setAbierto(true);
    if (tipo === "documento" && !esTextoPlano) void cargarDocumento();
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
          {tipo === "documento" || esTextoPlano ? (
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
          ) : null}
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={(event) => {
          event.stopPropagation();
          setAbierto(false);
          limpiarDocumento();
          // El foco nativo del dialog puede desplazar la página hasta otra sección.
          // Restituir el botón y la posición exacta también al cerrar con Escape.
          const origen = origenRef.current;
          origenRef.current = null;
          if (origen) {
            origen.boton.focus({ preventScroll: true });
            window.scrollTo({ left: origen.x, top: origen.y, behavior: "instant" });
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (event.target === dialogRef.current) cerrar();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-system-950 p-4 text-white backdrop:bg-system-950/90"
        aria-label={alt}
      >
        {/* La ventana va por encima de todo y taparía la marca de agua de la página (2026-11-12). */}
        {proteccion && abierto && <MarcaDeAgua marca={proteccion.marca} clara />}
        <div className={`relative flex h-full w-full items-center justify-center ${tipo === "documento" ? "pt-12" : ""}`}>
          <button
            type="button"
            onClick={cerrar}
            className="absolute right-2 top-2 z-10 rounded-pill bg-system-800 px-4 py-2 text-sm font-semibold text-white hover:bg-system-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Cerrar
          </button>
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
          ) : esTextoPlano ? (
            proteccion ? (
              // Protegida (2026-11-12): en un iframe el texto se podría seleccionar y copiar.
              <div className="h-full w-full max-w-4xl">
                <TextoDelAporte src={src} alto="h-full" />
              </div>
            ) : (
              <iframe src={src} title={alt} sandbox="" className="h-full w-full rounded-lg bg-white" />
            )
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
