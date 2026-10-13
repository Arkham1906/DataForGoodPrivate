"use client";

// Ventana "Antes de enviar" (<dialog> nativo, como ui/SelectorDeTemas): se abre al dar "Enviar aporte"
// y pide las dos casillas obligatorias, consentimiento de uso y contenido acorde a la campaña (textos en
// lib/aportes/consentimiento.ts). Su botón es el que envía de verdad. La usan /campanas/[id]/aportar y el
// formulario anónimo de /c/[token]. Solo informa: el servidor rechaza el aporte si no llegan las dos.

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import {
  AVISO_DE_CONTENIDO,
  AVISO_DE_USO,
  CAMPO_ACEPTA_USO,
  CAMPO_CONFIRMA_CONTENIDO,
  CONSECUENCIA_DEL_CONTENIDO,
} from "@/lib/aportes/consentimiento";

export type Avisos = { aceptaUso: boolean; confirmaContenido: boolean };

const SIN_MARCAR: Avisos = { aceptaUso: false, confirmaContenido: false };

export default function AvisosDeAporte({
  abierto,
  enviando,
  onCancelar,
  onConfirmar,
}: {
  abierto: boolean;
  enviando: boolean;
  onCancelar: () => void;
  /** Se llama con las dos casillas marcadas; quien la usa envía el aporte y la cierra. */
  onConfirmar: (avisos: Avisos) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  // Se aceptan en cada aporte: al cerrar la ventana vuelven a quedar sin marcar.
  const [avisos, setAvisos] = useState(SIN_MARCAR);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  function cancelar() {
    if (!enviando) onCancelar();
  }

  const listo = avisos.aceptaUso && avisos.confirmaContenido;

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="avisos-de-aporte-titulo"
      onClose={() => {
        setAvisos(SIN_MARCAR);
        if (abierto) onCancelar();
      }}
      // Esc mientras se envía: no se cierra.
      onCancel={(e) => {
        if (enviando) e.preventDefault();
      }}
      // Clic en el fondo (fuera de la caja): se cierra.
      onClick={(e) => {
        if (e.target === dialogo.current) cancelar();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="border-b border-system-200 p-5">
          <h2 id="avisos-de-aporte-titulo" className="text-lg font-extrabold text-system-900">
            Antes de enviar
          </h2>
          <p className="mt-1 text-[12.5px] text-system-600">Marca las dos casillas para enviar tu aporte.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <label className="mb-3 flex items-start gap-2 text-[12.5px] text-system-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={avisos.aceptaUso}
              onChange={(e) => setAvisos({ ...avisos, aceptaUso: e.target.checked })}
              disabled={enviando}
            />
            {AVISO_DE_USO}
          </label>
          <label className="flex items-start gap-2 text-[12.5px] text-system-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={avisos.confirmaContenido}
              onChange={(e) => setAvisos({ ...avisos, confirmaContenido: e.target.checked })}
              disabled={enviando}
            />
            {AVISO_DE_CONTENIDO}
          </label>
          <p className="mt-3 text-[11.5px] text-system-500">{CONSECUENCIA_DEL_CONTENIDO}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-system-200 p-4">
          <Button type="button" variant="ghost" size="sm" onClick={cancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={() => onConfirmar(avisos)} disabled={!listo || enviando}>
            {enviando ? (
              <span className="inline-flex items-center gap-2">
                <IndicadorDeCarga />
                Enviando…
              </span>
            ) : "Enviar aporte"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/** Agrega las dos casillas al FormData con el formato que espera el servidor. */
export function agregarAvisos(datos: FormData, avisos: Avisos) {
  if (avisos.aceptaUso) datos.set(CAMPO_ACEPTA_USO, "si");
  if (avisos.confirmaContenido) datos.set(CAMPO_CONFIRMA_CONTENIDO, "si");
}
