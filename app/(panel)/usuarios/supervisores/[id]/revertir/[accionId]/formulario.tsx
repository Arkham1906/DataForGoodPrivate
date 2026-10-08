"use client";

// Formulario de reversión. Llama a revertirAccion (lib/usuarios/acciones-supervisor.ts), que todavía es un TODO.

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { Field, Textarea } from "@/components/sistema/Input";
import { revertirAccion } from "@/lib/usuarios/acciones-supervisor";

const MINIMO = 40;
const CAUSALES = [
  "Medida desproporcionada",
  "Motivo insuficiente",
  "Error de identificación",
  "Apelación procedente",
  "Fuera del alcance del rol",
];

export default function FormularioDeReversion({
  supervisorId,
  accionId,
  supervisor,
  notificable,
}: {
  supervisorId: string;
  accionId: string;
  supervisor: string;
  /** Texto de la casilla de notificación, o null si no aplica. */
  notificable: string | null;
}) {
  const router = useRouter();
  const [causal, setCausal] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [notificar, setNotificar] = useState(false);
  const [observacion, setObservacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const idCausal = useId();

  const corta = descripcion.trim().length < MINIMO;

  function enviar() {
    setError(null);
    iniciar(async () => {
      const r = await revertirAccion(supervisorId, accionId, {
        causal,
        descripcion,
        notificarAfectado: notificar,
        observacionEnExpediente: observacion,
      });
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <Field label="Motivo de la reversión" required>
        <select
          id={idCausal}
          value={causal}
          onChange={(e) => setCausal(e.target.value)}
          className="w-full rounded border border-system-300 bg-white px-3.5 py-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600"
        >
          <option value="">Selecciona una causal</option>
          {CAUSALES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Descripción del caso"
        required
        hint={`${descripcion.trim().length} / ${MINIMO} caracteres mínimos`}
      >
        <Textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={`Explica por qué se revierte y qué se le comunica a ${supervisor}`}
          className="min-h-[110px]"
        />
      </Field>

      {notificable ? (
        <label className="mb-2.5 flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={notificar}
            onChange={(e) => setNotificar(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-[12.5px] text-system-600">{notificable}</span>
        </label>
      ) : null}

      <label className="mb-4 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={observacion}
          onChange={(e) => setObservacion(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-[12.5px] text-system-600">
          Registrar una observación en el expediente de {supervisor}
        </span>
      </label>

      {error ? (
        <p role="alert" className="mb-3 text-[12.5px] text-error-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pendiente}
          onClick={() => router.push(`/usuarios/supervisores/${supervisorId}`)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pendiente || corta || !causal}
          onClick={enviar}
        >
          {pendiente ? "Revirtiendo…" : "Revertir acción"}
        </Button>
      </div>
      <p className="mt-2 text-right text-[11.5px] text-system-500">
        Queda asentado en el historial del supervisor y en el tuyo
      </p>
    </div>
  );
}
