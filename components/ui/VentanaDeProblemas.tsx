"use client";

// Ventana de la app (no del navegador) que explica por qué no se pudo guardar un formulario
// (2026-10-27, a pedido del usuario: al crear o editar una campaña no se sabía qué faltaba).
// Lista cada problema; al elegir uno se cierra y lleva a su campo (`alIr`). <dialog> nativo como
// ui/VentanaDeConfirmacion: Esc o clic afuera la cierran y el foco vuelve a donde estaba.
// La usa /mis-campanas/nueva (NuevaCampanaForm).

import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import { VENTANA, claseDeVentana } from "@/components/ui/ventana-emergente";

export type ProblemaDeFormulario = { campo: string; mensaje: string };

export default function VentanaDeProblemas({
  abierto,
  titulo,
  problemas,
  onCerrar,
  alIr,
}: {
  abierto: boolean;
  titulo: string;
  problemas: ProblemaDeFormulario[];
  onCerrar: () => void;
  /** Lleva al campo del problema; se llama cuando la ventana ya se cerró. */
  alIr: (campo: string) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  // Campo al que ir: se va después de que el diálogo se cierra, porque al cerrarse el navegador
  // devuelve el foco (y el scroll) al botón que lo abrió.
  const pendiente = useRef<string | null>(null);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="ventana-de-problemas-titulo"
      aria-describedby="ventana-de-problemas-lista"
      onClose={() => {
        if (abierto) onCerrar();
        const campo = pendiente.current;
        pendiente.current = null;
        if (campo) requestAnimationFrame(() => alIr(campo));
      }}
      onClick={(e) => {
        if (e.target === dialogo.current) onCerrar();
      }}
      className={claseDeVentana("normal", "border-error-200")}
    >
      <div className={VENTANA.marco}>
        <div className={`flex items-start gap-3 ${VENTANA.encabezado}`}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error-700 text-[17px] font-bold text-white"
            aria-hidden
          >
            !
          </span>
          <div>
            <h2 id="ventana-de-problemas-titulo" className={VENTANA.titulo}>
              {titulo}
            </h2>
            <p className={VENTANA.subtitulo}>
              {problemas.length === 1 ? "Corrige esto y vuelve a intentarlo:" : `Corrige estas ${problemas.length} cosas y vuelve a intentarlo:`}
            </p>
          </div>
        </div>

        <ul id="ventana-de-problemas-lista" className="flex-1 overflow-y-auto px-3 py-4 md:px-6">
          {problemas.map((p, i) => (
            <li key={`${p.campo}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  pendiente.current = p.campo;
                  dialogo.current?.close();
                }}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left text-[15px] text-system-900 hover:bg-error-50"
              >
                <span className="mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full bg-error-700" aria-hidden />
                <span className="flex-1">{p.mensaje}</span>
                <span className="shrink-0 text-[14px] font-semibold text-brand-600">Ir →</span>
              </button>
            </li>
          ))}
        </ul>

        <div className={VENTANA.pie}>
          <Button type="button" variant="primary" onClick={onCerrar}>
            Entendido
          </Button>
        </div>
      </div>
    </dialog>
  );
}
