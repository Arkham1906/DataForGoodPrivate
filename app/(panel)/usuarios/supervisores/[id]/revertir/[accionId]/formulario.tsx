"use client";

// Formulario de reversión. Llama a revertirAccion (lib/usuarios/acciones-supervisor.ts), que al
// terminar regresa a la actividad del supervisor. Desde el 2026-11-22, "Revertir acción" pregunta antes
// ("¿Seguro que quieres…?" con `efecto`, components/sistema/useConfirmacion).

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import Button from "@/components/sistema/Button";
import { Field, Textarea } from "@/components/sistema/Input";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
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
  efecto,
}: {
  supervisorId: string;
  accionId: string;
  supervisor: string;
  /** Texto de la casilla de notificación, o null si no aplica. */
  notificable: string | null;
  /** Qué pasa al revertir (el mismo texto del aviso de la página). */
  efecto: string;
}) {
  const router = useRouter();
  const [causal, setCausal] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [notificar, setNotificar] = useState(false);
  const [observacion, setObservacion] = useState(false);
  const { pedirConfirmacion, ventana, ocupado: pendiente } = useConfirmacion();
  const idCausal = useId();

  const corta = descripcion.trim().length < MINIMO;

  function enviar() {
    pedirConfirmacion({
      pregunta: `¿Seguro que quieres revertir esta decisión de ${supervisor}?`,
      detalle: (
        <>
          <p>{efecto}</p>
          <p>
            Queda asentado en el historial de {supervisor} y en el tuyo{observacion ? ", con una observación en su expediente" : ""}.{" "}
            {notificar ? "Se avisa a la persona afectada." : ""} Una decisión revertida no se vuelve a revertir.
          </p>
        </>
      ),
      textoConfirmar: "Sí, revertir",
      textoOcupado: "Revirtiendo…",
      peligro: true,
      accion: () =>
        revertirAccion(supervisorId, accionId, {
          causal,
          descripcion,
          notificarAfectado: notificar,
          observacionEnExpediente: observacion,
        }),
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
          Revertir acción
        </Button>
      </div>
      {ventana}
      <p className="mt-2 text-right text-[11.5px] text-system-500">
        Queda asentado en el historial del supervisor y en el tuyo
      </p>
    </div>
  );
}
