"use client";

// Confirmación antes de un cambio importante en el panel (2026-11-22, a pedido del usuario): "¿Seguro que quieres…?",
// qué va a pasar y si se puede deshacer, en ui/VentanaDeConfirmacion. Uso:
//   const { pedirConfirmacion, ventana } = useConfirmacion();
//   <Button onClick={() => pedirConfirmacion({ pregunta, detalle, textoConfirmar, accion })}>…</Button>
//   {ventana}
// `accion` es la server action (o una función que la llama): si devuelve { ok: false, error }, la ventana sigue
// abierta con el error; si sale bien (o la acción redirige), se cierra. La ventana solo se monta abierta, porque
// hay un botón por renglón.

import { useState, type ReactNode } from "react";

import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";

type Resultado = { ok: true } | { ok: false; error: string } | void | undefined | null;

export type PedidoDeConfirmacion = {
  /** La pregunta, que es el título: "¿Seguro que quieres ocultar «Movilidad»?" */
  pregunta: string;
  /** Qué pasa al confirmar y si se puede deshacer. */
  detalle: ReactNode;
  /** El botón de la acción, con el verbo: "Sí, ocultar". */
  textoConfirmar: string;
  textoOcupado?: string;
  /** Botón rojo: acciones que quitan, bloquean o no se deshacen. */
  peligro?: boolean;
  accion: () => Promise<Resultado>;
  /** Después de que salió bien (p. ej. limpiar un formulario). */
  alTerminar?: () => void;
};

export function useConfirmacion() {
  const [pedido, setPedido] = useState<PedidoDeConfirmacion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pedirConfirmacion(nuevo: PedidoDeConfirmacion) {
    setError(null);
    setPedido(nuevo);
  }

  async function confirmar() {
    if (!pedido) return;
    setOcupado(true);
    setError(null);
    try {
      const resultado = await pedido.accion();
      if (resultado && resultado.ok === false) {
        setError(resultado.error);
        return;
      }
      pedido.alTerminar?.();
      setPedido(null);
    } catch (e) {
      // Una server action que redirige avisa con un error especial: se deja pasar para que navegue.
      if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
      setError("No se pudo completar. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  const ventana = pedido ? (
    <VentanaDeConfirmacion
      abierto
      titulo={pedido.pregunta}
      textoConfirmar={pedido.textoConfirmar}
      textoOcupado={pedido.textoOcupado ?? "Guardando…"}
      ocupado={ocupado}
      peligro={pedido.peligro}
      onCancelar={() => setPedido(null)}
      onConfirmar={() => void confirmar()}
    >
      <div className="space-y-2.5 text-[13.5px] leading-relaxed text-system-600">{pedido.detalle}</div>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] font-medium text-error-700">
          {error}
        </p>
      ) : null}
    </VentanaDeConfirmacion>
  ) : null;

  return { pedirConfirmacion, ventana, ocupado };
}
