"use client";

// Botones de /supervisar/[campaignId]. Llaman a las server actions tomarComoSuperUsuario y
// decidirComoSuperUsuario (lib/supervision/acciones-root.ts), que usan las reglas de lib/supervision/decision.ts.
// Una campaña ya aceptada (aceptada, activa o pausada) se puede reportar aunque la haya aceptado
// otro supervisor (2026-10-15); en revisión, solo la que tomó el SuperUsuario.
// EstadoComoSuperUsuario: pausar, reanudar y finalizar (cambiarEstadoComoSuperUsuario).

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Textarea } from "@/components/ui/Input";
import { cambiarEstadoComoSuperUsuario, decidirComoSuperUsuario, tomarComoSuperUsuario } from "@/lib/supervision/acciones-root";
import Tag from "@/components/ui/Tag";
import EstadoDeCampanaSupervisada from "@/components/supervision/EstadoDeCampanaSupervisada";
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
  const [rejectionReason, setRejectionReason] = useState("");

  function decidir(accion: AccionDeSupervision, motivo = "") {
    setError(null);
    setAccionEnCurso(accion);
    iniciar(async () => {
      const resultado = await decidirComoSuperUsuario(campaignId, accion, motivo);
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

  function confirmRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const motivo = rejectionReason.trim();
    if (!motivo) {
      setError("Debes explicar el motivo del rechazo");
      return;
    }
    decidir("rechazada", motivo);
  }

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
        ) : (
        <div className="flex flex-wrap gap-2">
          {status === "en_revision" && (
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
          )}
          {status !== "finalizada" && status !== "rechazada" && (
            <button
              type="button"
              onClick={() => decidir("reportada")}
              disabled={pendiente}
              className="rounded-pill border border-system-300 bg-white px-3.5 py-2 text-[12.5px] font-bold text-system-600 disabled:opacity-60"
            >
              {accionEnCurso === "reportada" ? "Reportando…" : "Reportar"}
            </button>
          )}
          {status === "en_revision" && (
            <button
              type="button"
              onClick={() => decidir("aceptada")}
              disabled={pendiente}
              className="rounded-pill border border-success-700/40 bg-success-50 px-3.5 py-2 text-[12.5px] font-bold text-success-700 disabled:opacity-60"
            >
              {accionEnCurso === "aceptada" ? "Aceptando…" : "Aceptar campaña"}
            </button>
          )}
        </div>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-error-700/30 bg-error-50 p-4 text-sm text-error-700">{error}</div>
      )}

      {showRejectForm && supervision === "mia" && status === "en_revision" && (
        <form onSubmit={confirmRejection} className="mb-5 rounded-lg border border-error-700/40 bg-error-50 p-4">
          <label htmlFor="campaign-rejection-reason" className="mb-2 block text-[13px] font-semibold text-system-900">
            Motivo del rechazo <span className="text-error-700">*</span>
          </label>
          <Textarea
            id="campaign-rejection-reason"
            rows={4}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Explica al creador por qué se rechaza la campaña"
            required
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              disabled={pendiente}
              className="rounded-pill border border-system-300 bg-white px-3.5 py-2 text-[12.5px] font-bold text-system-600 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendiente || !rejectionReason.trim()}
              className="rounded-pill bg-error-700 px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
            >
              {accionEnCurso === "rechazada" ? "Rechazando…" : "Confirmar rechazo"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
