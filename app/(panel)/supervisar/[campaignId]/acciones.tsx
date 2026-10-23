"use client";

// Botones de /supervisar/[campaignId]. Llaman a la server action decidirComoSuperUsuario
// (lib/supervision/acciones-root.ts), que usa las reglas de lib/supervision/decision.ts.
// En revisión, si no la supervisa otro: Aceptar o Rechazar (con motivo y sanción opcional al creador,
// components/supervision/FormularioDeRechazo). Sin "Supervisar esta campaña" desde el 2026-10-22: decidir
// la toma en el mismo paso. "Reportar" se quitó el 2026-10-16: quien supervisa ya sanciona.
// EstadoComoSuperUsuario: pausar, reanudar y finalizar (cambiarEstadoComoSuperUsuario).

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { cambiarEstadoComoSuperUsuario, decidirComoSuperUsuario } from "@/lib/supervision/acciones-root";
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
  const [accionEnCurso, setAccionEnCurso] = useState<AccionDeSupervision | null>(null);
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

  // Aceptar o rechazar: en revisión, si la supervisa el SuperUsuario o nadie (decidir la toma).
  const puedeDictaminar = supervision !== "otro" && status === "en_revision";

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        {encabezado}

        {supervision === "otro" && status === "en_revision" ? (
          <Tag>La supervisa otro supervisor</Tag>
        ) : supervision !== "mia" && (status === "finalizada" || status === "rechazada") ? (
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
