"use client";

// Formulario para rechazar una campaña en revisión (2026-10-16), compartido por /supervision/[campaignId]
// (supervisor) y /supervisar/[campaignId] (SuperUsuario). Motivo de la lista (MOTIVOS_DE_RECHAZO_DE_CAMPANA)
// y/o explicación; con "Otro", la explicación es obligatoria. La casilla "Sancionar al creador" agrega un
// aviso, una suspensión o el baneo (components/moderacion/OpcionesDeSancion); esa sanción queda en
// reportes y sanciones de la supervisión. Las reglas se vuelven a validar en lib/supervision/decision.ts.

import { useId, useState, type FormEvent } from "react";

import { Textarea } from "@/components/ui/Input";
import OpcionesDeSancion, { SANCION_POR_DEFECTO, type SancionElegida } from "@/components/moderacion/OpcionesDeSancion";
import {
  MAXIMO_EXPLICACION_DE_RECHAZO,
  MOTIVOS_DE_RECHAZO_DE_CAMPANA,
  OTRO_MOTIVO,
} from "@/lib/reportes/motivos";

export type RechazoPedido = {
  motivoDeLista: string;
  motivo: string;
  sancion: SancionElegida | null;
};

export default function FormularioDeRechazo({
  ocupado,
  onCancelar,
  onConfirmar,
}: {
  ocupado: boolean;
  onCancelar: () => void;
  onConfirmar: (rechazo: RechazoPedido) => void;
}) {
  const idMotivo = useId();
  const idExplicacion = useId();
  const idSancionar = useId();
  const [motivoDeLista, setMotivoDeLista] = useState("");
  const [explicacion, setExplicacion] = useState("");
  const [sancionar, setSancionar] = useState(false);
  const [sancion, setSancion] = useState<SancionElegida>(SANCION_POR_DEFECTO);

  const conTexto = explicacion.trim().length > 0;
  const completo = (Boolean(motivoDeLista) || conTexto) && (motivoDeLista !== OTRO_MOTIVO || conTexto);

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completo || ocupado) return;
    onConfirmar({ motivoDeLista, motivo: explicacion.trim(), sancion: sancionar ? sancion : null });
  }

  return (
    <form onSubmit={enviar} className="mb-5 rounded-lg border border-error-700/40 bg-error-50 p-4">
      <label htmlFor={idMotivo} className="mb-1.5 block text-[13px] font-semibold text-system-900">
        Motivo del rechazo <span className="text-error-700">*</span>
      </label>
      <select
        id={idMotivo}
        value={motivoDeLista}
        onChange={(e) => setMotivoDeLista(e.target.value)}
        disabled={ocupado}
        className="mb-3 w-full rounded border border-system-300 bg-white px-3 py-2.5 text-[13px] text-system-900 outline-none focus:border-brand-600"
      >
        <option value="">Selecciona un motivo ▾</option>
        {MOTIVOS_DE_RECHAZO_DE_CAMPANA.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <label htmlFor={idExplicacion} className="mb-1.5 block text-[13px] font-semibold text-system-900">
        Explicación {motivoDeLista === OTRO_MOTIVO ? <span className="text-error-700">*</span> : <span className="font-normal text-system-500">(opcional si elegiste un motivo)</span>}
      </label>
      <Textarea
        id={idExplicacion}
        rows={3}
        maxLength={MAXIMO_EXPLICACION_DE_RECHAZO}
        value={explicacion}
        onChange={(event) => setExplicacion(event.target.value)}
        placeholder="Explica al creador por qué se rechaza la campaña"
        disabled={ocupado}
      />

      <label htmlFor={idSancionar} className="mt-1 flex cursor-pointer items-start gap-2.5">
        <input
          id={idSancionar}
          type="checkbox"
          checked={sancionar}
          onChange={(e) => setSancionar(e.target.checked)}
          disabled={ocupado}
          className="mt-0.5"
        />
        <span>
          <span className="block text-[13px] font-semibold text-system-900">Sancionar al creador</span>
          <span className="block text-[12px] text-system-600">
            La sanción queda en Reportes y Sanciones de la supervisión, con este motivo.
          </span>
        </span>
      </label>

      {sancionar && (
        <div className="mt-3">
          <OpcionesDeSancion valor={sancion} onCambiar={setSancion} deshabilitado={ocupado} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancelar}
          disabled={ocupado}
          className="rounded-pill border border-system-300 bg-white px-3.5 py-2 text-[12.5px] font-bold text-system-600 disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={ocupado || !completo}
          className="rounded-pill bg-error-700 px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          {ocupado ? "Rechazando…" : sancionar ? "Rechazar y sancionar" : "Confirmar rechazo"}
        </button>
      </div>
    </form>
  );
}
