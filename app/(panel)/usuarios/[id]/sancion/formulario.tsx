"use client";

// Formulario de sanción. Llama a la server action aplicarSancion (lib/usuarios/acciones-usuarios.ts):
// STRIKE, SUSPENSION_TEMPORAL o BANEO_DE_CAMPANA. El tercer strike banea solo.

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { Field, Input, Textarea } from "@/components/sistema/Input";
import { aplicarSancion } from "@/lib/usuarios/acciones-usuarios";
import type { TipoDeSancion } from "@/lib/usuarios/directorio";

const MINIMO = 20;

const TIPOS: { valor: TipoDeSancion; etiqueta: string; hint: string }[] = [
  { valor: "STRIKE", etiqueta: "Strike", hint: "Suma al contador. Al tercer strike la cuenta se banea automáticamente." },
  { valor: "SUSPENSION_TEMPORAL", etiqueta: "Suspensión temporal", hint: "Bloquea la cuenta por un número de días." },
  { valor: "BANEO_DE_CAMPANA", etiqueta: "Baneo permanente", hint: "Bloquea la cuenta hasta que se restaure a mano." },
];

export default function FormularioDeSancion({
  usuarioId,
  usuario,
}: {
  usuarioId: string;
  usuario: string;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoDeSancion>("STRIKE");
  const [detalle, setDetalle] = useState("");
  const [dias, setDias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const idTipo = useId();

  const corto = detalle.trim().length < MINIMO;
  const faltanDias = tipo === "SUSPENSION_TEMPORAL" && !Number(dias);

  function enviar() {
    setError(null);
    iniciar(async () => {
      const r = await aplicarSancion(usuarioId, {
        tipo,
        detalle,
        dias: tipo === "SUSPENSION_TEMPORAL" ? Number(dias) : undefined,
      });
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <Field label="Tipo de sanción" required>
        <div className="flex flex-col gap-2">
          {TIPOS.map((t) => (
            <label
              key={t.valor}
              className={`flex cursor-pointer items-start gap-2.5 rounded border px-3.5 py-2.5 transition-colors ${
                tipo === t.valor ? "border-brand-600 bg-brand-600/5" : "border-system-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name={idTipo}
                checked={tipo === t.valor}
                onChange={() => setTipo(t.valor)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[13.5px] font-medium text-system-900">{t.etiqueta}</span>
                <span className="block text-[12px] text-system-500">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>

      {tipo === "SUSPENSION_TEMPORAL" ? (
        <Field label="Días de suspensión" required>
          <Input
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            placeholder="7"
          />
        </Field>
      ) : null}

      <Field
        label="Detalle"
        required
        hint={`${detalle.trim().length} / ${MINIMO} caracteres mínimos`}
      >
        <Textarea
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder={`Explica por qué se sanciona a ${usuario}`}
          className="min-h-[110px]"
        />
      </Field>

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
          onClick={() => router.push(`/usuarios/${usuarioId}`)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pendiente || corto || faltanDias}
          onClick={enviar}
        >
          {pendiente ? "Aplicando…" : "Aplicar sanción"}
        </Button>
      </div>
    </div>
  );
}
