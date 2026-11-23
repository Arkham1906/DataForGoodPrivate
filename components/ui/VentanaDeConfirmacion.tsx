"use client";

// Ventana para confirmar una acción (<dialog> nativo, como ui/AcuerdosDeAporte), en lugar de
// window.confirm: título, contenido libre y botones "Cancelar" y el de la acción. Mientras
// `ocupado` es true no se cierra (ni con Esc ni con clic afuera) y el botón muestra `textoOcupado`.
// La usan "Pausar campaña" y "Finalizar campaña" en /mis-campanas y "Reportar campaña" en /campanas/[id] (ui/ReportarAPlataforma).
// En el panel, a través de components/sistema/useConfirmacion (2026-11-22).

import { useEffect, useId, useRef, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import IndicadorDeCarga from "@/components/ui/IndicadorDeCarga";
import { VENTANA, claseDeVentana } from "@/components/ui/ventana-emergente";

export default function VentanaDeConfirmacion({
  abierto,
  titulo,
  children,
  textoConfirmar,
  textoOcupado,
  ocupado = false,
  peligro = false,
  confirmarDeshabilitado = false,
  textoCancelar = "Cancelar",
  ocultarCancelar = false,
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
  /** Deshabilita el botón de la acción (p. ej. falta llenar un campo del contenido). */
  confirmarDeshabilitado?: boolean;
  /** Texto del botón para cerrar sin hacer nada (p. ej. "Ahora no" en un aviso). */
  textoCancelar?: string;
  ocultarCancelar?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  // Id propio de cada ventana (2026-11-22; antes fijo, por eso hay que montarla solo abierta si hay varias).
  const idTitulo = useId();

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
      aria-labelledby={idTitulo}
      // stopPropagation (2026-11-13): React hace subir "close" y "cancel" por el árbol de componentes, así que, dentro de
      // otro <dialog> (p. ej. el aviso de riesgos de "Permitir aportes sin cuenta" en Compartir), cerrar esta ventana
      // también cerraba la de afuera.
      onClose={(e) => {
        if (e.target !== e.currentTarget) return;
        e.stopPropagation();
        if (abierto) onCancelar();
      }}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.stopPropagation();
        if (ocupado) e.preventDefault();
      }}
      // Clic en el fondo (fuera de la caja): se cierra. No sube a una ventana de afuera.
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === dialogo.current) cancelar();
      }}
      className={claseDeVentana()}
    >
      <div className={VENTANA.marco}>
        <div className={VENTANA.encabezado}>
          <h2 id={idTitulo} className={VENTANA.titulo}>
            {titulo}
          </h2>
        </div>

        <div className={VENTANA.cuerpo}>{children}</div>

        <div className={VENTANA.pie}>
          {!ocultarCancelar && (
            <Button type="button" variant="ghost" onClick={cancelar} disabled={ocupado}>
              {textoCancelar}
            </Button>
          )}
          <Button type="button" variant={peligro ? "danger" : "primary"} onClick={onConfirmar} disabled={ocupado || confirmarDeshabilitado}>
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
