"use client";

// Ventana para confirmar una acción (<dialog> nativo, como ui/AvisosDeAporte), en lugar de
// window.confirm: título, contenido libre y botones "Cancelar" y el de la acción. Mientras
// `ocupado` es true no se cierra (ni con Esc ni con clic afuera) y el botón muestra `textoOcupado`.
// La usa "Pausar campaña" en /mis-campanas.

import { useEffect, useRef, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";

export default function VentanaDeConfirmacion({
  abierto,
  titulo,
  children,
  textoConfirmar,
  textoOcupado,
  ocupado = false,
  peligro = false,
  onCancelar,
  onConfirmar,
}: {
  abierto: boolean;
  titulo: string;
  children: ReactNode;
  textoConfirmar: string;
  textoOcupado: string;
  ocupado?: boolean;
  /** Botón rojo para acciones que no se deshacen. */
  peligro?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  function cancelar() {
    if (!ocupado) onCancelar();
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="ventana-de-confirmacion-titulo"
      onClose={() => {
        if (abierto) onCancelar();
      }}
      onCancel={(e) => {
        if (ocupado) e.preventDefault();
      }}
      // Clic en el fondo (fuera de la caja): se cierra.
      onClick={(e) => {
        if (e.target === dialogo.current) cancelar();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="border-b border-system-200 p-5">
          <h2 id="ventana-de-confirmacion-titulo" className="text-lg font-extrabold text-system-900">
            {titulo}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-[12.5px] text-system-600">{children}</div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-system-200 p-4">
          <Button type="button" variant="ghost" size="sm" onClick={cancelar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button type="button" variant={peligro ? "danger" : "primary"} size="sm" onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? (
              <span className="inline-flex items-center gap-2">
                <IndicadorDeCarga />
                {textoOcupado}
              </span>
            ) : textoConfirmar}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
