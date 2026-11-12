"use client";

// Decidir si los datos de una campaña terminada se publican (2026-11-04), con los aportes que juntó a la
// vista. Lo usan /supervision/[campaignId] (PATCH /api/campanas/[id]) y /supervisar/[campaignId]
// (decidirDatosAbiertosComoSuperUsuario): cada pantalla pasa `onDecidir`, que devuelve el error o null.
// Publicar se confirma; no publicar pide motivo. Reglas en lib/supervision/datos-abiertos.ts.

import { useId, useState } from "react";
import { Textarea } from "@/components/ui/Input";
import VentanaDeConfirmacion from "@/components/ui/VentanaDeConfirmacion";
import { MAXIMO_MOTIVO_DE_DATOS_ABIERTOS, type DatosAbiertosDeCampana } from "@/lib/campanas/datos-abiertos";
import { porcentajeDeMeta } from "@/lib/campanas/meta";

export type DecisionPedida = "publicar_datos" | "no_publicar_datos";

export default function DecisionDeDatosAbiertos({
  datos,
  aprobados,
  meta,
  participantes,
  puedeDecidir,
  onDecidir,
}: {
  datos: DatosAbiertosDeCampana;
  aprobados: number;
  meta: number;
  participantes: number;
  puedeDecidir: boolean;
  onDecidir: (decision: DecisionPedida, motivo: string) => Promise<string | null>;
}) {
  const idMotivo = useId();
  const [ventana, setVentana] = useState<DecisionPedida | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir(decision: DecisionPedida) {
    setMotivo("");
    setError(null);
    setVentana(decision);
  }

  async function confirmar() {
    if (!ventana) return;
    if (ventana === "no_publicar_datos" && !motivo.trim()) {
      setError("Escribe por qué no se publican los datos.");
      return;
    }
    setOcupado(true);
    const fallo = await onDecidir(ventana, motivo.trim());
    setOcupado(false);
    if (fallo) {
      setError(fallo);
      return;
    }
    setVentana(null);
  }

  return (
    <section className="mb-5 rounded-lg border border-system-200 bg-white p-4 shadow-sm">
      <h2 className="text-[13.5px] font-bold text-system-900">Datos abiertos</h2>
      <p className="mt-0.5 text-[12.5px] text-system-600">
        Aportes aprobados: <span className="font-mono font-semibold text-system-900">{aprobados} de {meta}</span>{" "}
        ({porcentajeDeMeta(aprobados, meta)}% de la meta) · Participantes: <span className="font-mono font-semibold text-system-900">{participantes}</span>
      </p>

      {datos.estado === "pendiente" && !puedeDecidir && (
        <p className="mt-3 text-[12.5px] text-system-600">Pendiente: la decisión es de quien supervisa la campaña.</p>
      )}
      {datos.estado === "pendiente" && puedeDecidir && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => abrir("publicar_datos")}
            disabled={aprobados === 0}
            title={aprobados === 0 ? "No tiene aportes aprobados que publicar" : undefined}
            className="rounded-pill border border-success-700/40 bg-success-50 px-3.5 py-2 text-[12.5px] font-bold text-success-700 disabled:opacity-60"
          >
            Publicar datos
          </button>
          <button
            type="button"
            onClick={() => abrir("no_publicar_datos")}
            className="rounded-pill border border-error-700/40 bg-error-50 px-3.5 py-2 text-[12.5px] font-bold text-error-700"
          >
            No publicar
          </button>
        </div>
      )}
      {datos.estado === "publicada" && <p className="mt-3 text-[12.5px] font-semibold text-success-700">Publicados en Datos abiertos.</p>}
      {datos.estado === "no_publicada" && (
        <p className="mt-3 whitespace-pre-line text-[12.5px] text-system-600">
          <span className="font-semibold text-system-900">No se publicaron.</span> Motivo: {datos.motivo || "sin motivo registrado"}
        </p>
      )}

      <VentanaDeConfirmacion
        abierto={ventana !== null}
        titulo={ventana === "publicar_datos" ? "¿Publicar sus datos abiertos?" : "¿No publicar sus datos?"}
        textoConfirmar={ventana === "publicar_datos" ? "Publicar datos" : "No publicar"}
        textoOcupado="Guardando…"
        ocupado={ocupado}
        peligro={ventana === "no_publicar_datos"}
        onCancelar={() => setVentana(null)}
        onConfirmar={() => void confirmar()}
      >
        {ventana === "publicar_datos" ? (
          <p>Sus {aprobados} aportes aprobados quedarán disponibles para cualquiera en Datos abiertos. Esta decisión no se puede cambiar.</p>
        ) : (
          <>
            <p className="mb-3">Quien organiza la campaña recibirá este motivo. Esta decisión no se puede cambiar.</p>
            <label htmlFor={idMotivo} className="mb-2 block text-[15px] font-semibold text-system-900">
              Motivo <span className="text-error-700">*</span>
            </label>
            <Textarea
              id={idMotivo}
              rows={4}
              maxLength={MAXIMO_MOTIVO_DE_DATOS_ABIERTOS}
              value={motivo}
              onChange={(event) => {
                setMotivo(event.target.value);
                setError(null);
              }}
              placeholder="Explica por qué no se publican los datos de esta campaña"
              disabled={ocupado}
            />
          </>
        )}
        {error && <p role="alert" className="mt-2 text-[15px] text-error-700">{error}</p>}
      </VentanaDeConfirmacion>
    </section>
  );
}
