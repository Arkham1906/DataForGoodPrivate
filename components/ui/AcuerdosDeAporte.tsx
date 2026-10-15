"use client";

// Acuerdos para aportar (2026-10-15, a pedido del usuario; reemplaza a la ventana "Antes de enviar" que salía
// en cada aporte). Dos casillas cortas, "Acepto el acuerdo de confirmación" y "Acepto el acuerdo de uso del
// aporte", y "Leer los acuerdos", que abre una ventana (<dialog> nativo) con el texto completo
// (lib/aportes/consentimiento.ts).
//   - InscripcionACampana: con cuenta, se aceptan una sola vez al inscribirse (POST /api/campanas/[id]/inscripcion).
//     En /campanas/[id] y, si aún no se inscribió, arriba de /campanas/[id]/aportar.
//   - CasillasDeAcuerdos + agregarAcuerdos: sin cuenta (/c/[token]), en el formulario de cada aporte.
// El servidor vuelve a exigirlos en los dos casos.

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import { BASE_PATH } from "@/lib/base-path";
import {
  AVISO_DE_CONTENIDO,
  AVISO_DE_USO,
  CAMPO_ACEPTA_USO,
  CAMPO_CONFIRMA_CONTENIDO,
  CASILLA_DE_CONFIRMACION,
  CASILLA_DE_USO,
  CONSECUENCIA_DEL_CONTENIDO,
} from "@/lib/aportes/consentimiento";

export type Acuerdos = { confirmaContenido: boolean; aceptaUso: boolean };

export const SIN_ACUERDOS: Acuerdos = { confirmaContenido: false, aceptaUso: false };

export const acuerdosCompletos = (a: Acuerdos) => a.confirmaContenido && a.aceptaUso;

/** Ventana de solo lectura con el texto completo de los dos acuerdos. */
function VentanaDeAcuerdos({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierta && !el.open) el.showModal();
    if (!abierta && el.open) el.close();
  }, [abierta]);

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="acuerdos-de-aporte-titulo"
      onClose={() => {
        if (abierta) onCerrar();
      }}
      // Clic en el fondo (fuera de la caja): se cierra.
      onClick={(e) => {
        if (e.target === dialogo.current) onCerrar();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="border-b border-system-200 p-5">
          <h2 id="acuerdos-de-aporte-titulo" className="text-lg font-extrabold text-system-900">
            Acuerdos para aportar
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-5 text-[12.5px] text-system-600">
          <h3 className="mb-1 text-[13px] font-bold text-system-900">Acuerdo de confirmación</h3>
          <p className="mb-4">{AVISO_DE_CONTENIDO}</p>
          <h3 className="mb-1 text-[13px] font-bold text-system-900">Acuerdo de uso del aporte</h3>
          <p>{AVISO_DE_USO}</p>
          <p className="mt-4 text-[11.5px] text-system-500">{CONSECUENCIA_DEL_CONTENIDO}</p>
        </div>
        <div className="flex justify-end border-t border-system-200 p-4">
          <Button type="button" variant="primary" size="sm" onClick={onCerrar}>
            Entendido
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/** Las dos casillas cortas y el enlace para leer los acuerdos completos. */
export function CasillasDeAcuerdos({
  acuerdos,
  onCambio,
  deshabilitado = false,
}: {
  acuerdos: Acuerdos;
  onCambio: (acuerdos: Acuerdos) => void;
  deshabilitado?: boolean;
}) {
  const [leyendo, setLeyendo] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-start gap-2 text-[12.5px] text-system-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={acuerdos.confirmaContenido}
          onChange={(e) => onCambio({ ...acuerdos, confirmaContenido: e.target.checked })}
          disabled={deshabilitado}
        />
        {CASILLA_DE_CONFIRMACION}
      </label>
      <label className="flex items-start gap-2 text-[12.5px] text-system-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={acuerdos.aceptaUso}
          onChange={(e) => onCambio({ ...acuerdos, aceptaUso: e.target.checked })}
          disabled={deshabilitado}
        />
        {CASILLA_DE_USO}
      </label>
      <button
        type="button"
        onClick={() => setLeyendo(true)}
        className="self-start text-[12px] font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
      >
        Leer los acuerdos
      </button>
      <VentanaDeAcuerdos abierta={leyendo} onCerrar={() => setLeyendo(false)} />
    </div>
  );
}

/** Agrega las dos casillas al FormData de un aporte sin cuenta, con el formato que espera el servidor. */
export function agregarAcuerdos(datos: FormData, acuerdos: Acuerdos) {
  if (acuerdos.aceptaUso) datos.set(CAMPO_ACEPTA_USO, "si");
  if (acuerdos.confirmaContenido) datos.set(CAMPO_CONFIRMA_CONTENIDO, "si");
}

/** Bloque "Inscríbete para aportar": casillas y botón. Llama a onInscrito cuando el servidor lo confirma. */
export function InscripcionACampana({ campanaId, onInscrito }: { campanaId: string; onInscrito: () => void }) {
  const [acuerdos, setAcuerdos] = useState(SIN_ACUERDOS);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function inscribirme() {
    setEnviando(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campanas/${encodeURIComponent(campanaId)}/inscripcion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [CAMPO_CONFIRMA_CONTENIDO]: acuerdos.confirmaContenido ? "si" : "",
          [CAMPO_ACEPTA_USO]: acuerdos.aceptaUso ? "si" : "",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "No se pudo completar la inscripción");
      onInscrito();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la inscripción");
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-system-600">
        Para aportar, inscríbete aceptando estos acuerdos. Solo se piden una vez en esta campaña.
      </p>
      <CasillasDeAcuerdos acuerdos={acuerdos} onCambio={setAcuerdos} deshabilitado={enviando} />
      {error && (
        <p role="alert" className="rounded border border-error-700 bg-error-50 p-2 text-[12px] text-error-700">
          {error}
        </p>
      )}
      <Button variant="primary" className="w-full" disabled={!acuerdosCompletos(acuerdos) || enviando} onClick={() => void inscribirme()}>
        {enviando ? (
          <span className="inline-flex items-center gap-2">
            <IndicadorDeCarga />
            Inscribiendo…
          </span>
        ) : "Inscribirme para aportar"}
      </Button>
    </div>
  );
}
