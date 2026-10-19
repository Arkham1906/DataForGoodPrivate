"use client";

// Pausar, reanudar y finalizar una campaña desde la supervisión (2026-10-15), y el aviso de por
// qué está pausada. Lo usan /supervision/[campaignId] (supervisor, con PATCH /api/campanas/[id])
// y /supervisar/[campaignId] (SuperUsuario, con cambiarEstadoComoSuperUsuario): cada pantalla
// pasa `onCambiar`, que devuelve el error o null. Pausar y finalizar piden motivo en una ventana
// (ui/VentanaDeConfirmacion); reanudar solo aparece si la pausó la supervisión.
// Reglas en lib/supervision/estado-por-supervision.ts.

import { useState } from "react";
import { Textarea } from "@/components/ui/Input";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { MAXIMO_MOTIVO_DE_SUPERVISION, type PausaDeCampana } from "@/lib/campanas/pausa";

export type CambioDeEstado = "pausar" | "reanudar" | "finalizar";

export default function EstadoDeCampanaSupervisada({
  status,
  pausa,
  onCambiar,
}: {
  status: string;
  pausa: PausaDeCampana | null | undefined;
  onCambiar: (cambio: CambioDeEstado, motivo: string) => Promise<string | null>;
}) {
  const [ventana, setVentana] = useState<"pausar" | "finalizar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enCurso, setEnCurso] = useState<CambioDeEstado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDeVentana, setErrorDeVentana] = useState<string | null>(null);

  if (status !== "activa" && status !== "pausada") return null;
  const pausadaPorSupervision = status === "pausada" && pausa?.por === "supervision";

  async function cambiar(cambio: CambioDeEstado, texto = "") {
    setEnCurso(cambio);
    const fallo = await onCambiar(cambio, texto);
    setEnCurso(null);
    return fallo;
  }

  function abrir(cambio: "pausar" | "finalizar") {
    setError(null);
    setErrorDeVentana(null);
    setMotivo("");
    setVentana(cambio);
  }

  async function confirmar() {
    if (!ventana) return;
    const texto = motivo.trim();
    if (!texto) {
      setErrorDeVentana(ventana === "pausar" ? "Escribe por qué se pausa la campaña." : "Escribe por qué se finaliza la campaña.");
      return;
    }
    const fallo = await cambiar(ventana, texto);
    if (fallo) {
      setErrorDeVentana(fallo);
      return;
    }
    setVentana(null);
  }

  async function reanudar() {
    setError(null);
    setError(await cambiar("reanudar"));
  }

  const ocupado = enCurso !== null;

  return (
    <section className="mb-5 rounded-lg border border-system-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-bold text-system-900">Estado de la campaña</h2>
          <p className="mt-0.5 text-[12.5px] text-system-600">
            {status === "activa"
              ? "Está recibiendo aportes. Puedes pausarla o finalizarla explicando el motivo."
              : pausadaPorSupervision
                ? "La pausó la supervisión: no recibe aportes hasta que se reanude."
                : "La pausó quien la organiza: solo esa persona puede reanudarla."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "activa" && (
            <button
              type="button"
              onClick={() => abrir("pausar")}
              disabled={ocupado}
              className="rounded-pill border border-warning-200 bg-warning-50 px-3.5 py-2 text-[12.5px] font-bold text-warning-800 disabled:opacity-60"
            >
              Pausar campaña
            </button>
          )}
          {pausadaPorSupervision && (
            <button
              type="button"
              onClick={() => void reanudar()}
              disabled={ocupado}
              className="rounded-pill border border-success-700/40 bg-success-50 px-3.5 py-2 text-[12.5px] font-bold text-success-700 disabled:opacity-60"
            >
              {enCurso === "reanudar" ? "Reanudando…" : "Reanudar campaña"}
            </button>
          )}
          <button
            type="button"
            onClick={() => abrir("finalizar")}
            disabled={ocupado}
            className="rounded-pill border border-error-700/40 bg-error-50 px-3.5 py-2 text-[12.5px] font-bold text-error-700 disabled:opacity-60"
          >
            Finalizar campaña
          </button>
        </div>
      </div>

      {status === "pausada" && (
        <div className="mt-3 rounded-lg border border-warning-200 bg-warning-50 p-3 text-[12.5px] text-system-900">
          <p className="font-semibold">Motivo de la pausa</p>
          <p className="mt-1 whitespace-pre-line text-system-600">
            {pausa?.por === "supervision" ? pausa.motivo || "Sin motivo registrado" : "Quien organiza la campaña no da motivo al pausarla."}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-error-700">{error}</p>
      )}

      <VentanaDeConfirmacion
        abierto={ventana !== null}
        titulo={ventana === "finalizar" ? "¿Finalizar esta campaña?" : "¿Pausar esta campaña?"}
        textoConfirmar={ventana === "finalizar" ? "Finalizar campaña" : "Pausar campaña"}
        textoOcupado={ventana === "finalizar" ? "Finalizando…" : "Pausando…"}
        ocupado={ocupado}
        peligro={ventana === "finalizar"}
        onCancelar={() => setVentana(null)}
        onConfirmar={() => void confirmar()}
      >
        <ul className="mb-4 flex list-disc flex-col gap-1.5 pl-5">
          {ventana === "finalizar" ? (
            <>
              <li>Dejará de recibir aportes y pasará a los datos abiertos.</li>
              <li>A quien la organiza le llega una notificación con el motivo.</li>
            </>
          ) : (
            <>
              <li>No recibirá aportes nuevos ni aparecerá en Campañas y Explorar.</li>
              <li>Quien la organiza y quien quiera aportar verán el motivo.</li>
              <li>Solo la supervisión podrá reanudarla.</li>
            </>
          )}
        </ul>
        <label htmlFor="motivo-de-supervision" className="mb-2 block text-[13px] font-semibold text-system-900">
          Motivo <span className="text-error-700">*</span>
        </label>
        <Textarea
          id="motivo-de-supervision"
          rows={4}
          maxLength={MAXIMO_MOTIVO_DE_SUPERVISION}
          value={motivo}
          onChange={(event) => {
            setMotivo(event.target.value);
            setErrorDeVentana(null);
          }}
          placeholder={ventana === "finalizar" ? "Explica por qué se finaliza la campaña" : "Explica por qué se pausa la campaña"}
          disabled={ocupado}
          required
        />
        {errorDeVentana && (
          <p role="alert" className="mt-2 text-[12.5px] text-error-700">{errorDeVentana}</p>
        )}
      </VentanaDeConfirmacion>
    </section>
  );
}
