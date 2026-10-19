"use client";

// Botones de /supervisar/[campaignId]. Llaman a las server actions tomarComoSuperUsuario y
// decidirComoSuperUsuario (lib/supervision/acciones-root.ts), que usan las reglas de lib/supervision/decision.ts.
// En revisión y tomada por el SuperUsuario: Aceptar o Rechazar (con motivo y sanción opcional al creador,
// components/supervision/FormularioDeRechazo). "Reportar" se quitó el 2026-10-16: quien supervisa ya sanciona.
// EstadoComoSuperUsuario: pausar, reanudar y finalizar (cambiarEstadoComoSuperUsuario).

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { cambiarEstadoComoSuperUsuario, decidirComoSuperUsuario, tomarComoSuperUsuario } from "@/lib/supervision/acciones-root";
import Tag from "@/components/ui/Tag";
import EstadoDeCampanaSupervisada from "@/components/supervision/EstadoDeCampanaSupervisada";
import FormularioDeRechazo, { type RechazoPedido } from "@/components/supervision/FormularioDeRechazo";
import type { AccionDeSupervision } from "@/lib/supervision/decision";
import type { PausaDeCampana } from "@/lib/campanas/pausa";

/** Pausar, reanudar o finalizar como SuperUsuario cualquier campaña activa o pausada (2026-10-15). */
export function EstadoComoSuperUsuario({
  campaignId,
  status,
  pausa,
}: {
  campaignId: string;
  status: string;
  pausa: PausaDeCampana | null;
}) {
  const router = useRouter();
  return (
    <EstadoDeCampanaSupervisada
      status={status}
      pausa={pausa}
      onCambiar={async (cambio, motivo) => {
        const resultado = await cambiarEstadoComoSuperUsuario(campaignId, cambio, motivo);
        if (!resultado.ok) return resultado.error;
        router.refresh();
        return null;
      }}
    />
  );
}

export default function AccionesDeSupervision({
  campaignId,
  status,
  supervision,
  encabezado,
}: {
  campaignId: string;
  status: string;
  supervision: "libre" | "mia" | "otro";
  encabezado: ReactNode;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [accionEnCurso, setAccionEnCurso] = useState<AccionDeSupervision | "tomar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);

  function decidir(accion: AccionDeSupervision, rechazo?: RechazoPedido) {
    setError(null);
    setAccionEnCurso(accion);
    iniciar(async () => {
      const resultado = await decidirComoSuperUsuario(
        campaignId,
        accion,
        rechazo ? { motivoDeLista: rechazo.motivoDeLista, motivo: rechazo.motivo, sancion: rechazo.sancion } : {},
      );
      setAccionEnCurso(null);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.push(accion === "aceptada" ? "/supervisar/campanas" : "/supervisar");
    });
  }

  function tomar() {
    setError(null);
    setAccionEnCurso("tomar");
    iniciar(async () => {
      const resultado = await tomarComoSuperUsuario(campaignId);
      setAccionEnCurso(null);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  // Aceptar o rechazar: solo en revisión y si la supervisa el SuperUsuario.
  const puedeDictaminar = supervision === "mia" && status === "en_revision";

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        {encabezado}

        {supervision === "libre" && status === "en_revision" ? (
          <button
            type="button"
            onClick={tomar}
            disabled={pendiente}
            className="rounded-pill bg-brand-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60"
          >
            {accionEnCurso === "tomar" ? "Tomando…" : "Supervisar esta campaña"}
          </button>
        ) : supervision !== "mia" && (status === "en_revision" || status === "finalizada" || status === "rechazada") ? (
          <Tag>{supervision === "otro" ? "La supervisa otro supervisor" : "Sin supervisor"}</Tag>
        ) : puedeDictaminar ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowRejectForm(true);
              }}
              disabled={pendiente}
              className="rounded-pill border border-error-700/40 bg-error-50 px-3.5 py-2 text-[12.5px] font-bold text-error-700 disabled:opacity-60"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => decidir("aceptada")}
              disabled={pendiente}
              className="rounded-pill border border-success-700/40 bg-success-50 px-3.5 py-2 text-[12.5px] font-bold text-success-700 disabled:opacity-60"
            >
              {accionEnCurso === "aceptada" ? "Aceptando…" : "Aceptar campaña"}
            </button>
          </div>
        ) : null}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-error-700/30 bg-error-50 p-4 text-sm text-error-700">{error}</div>
      )}

      {showRejectForm && puedeDictaminar && (
        <FormularioDeRechazo
          ocupado={pendiente}
          onCancelar={() => setShowRejectForm(false)}
          onConfirmar={(rechazo) => decidir("rechazada", rechazo)}
        />
      )}
    </>
  );
}
