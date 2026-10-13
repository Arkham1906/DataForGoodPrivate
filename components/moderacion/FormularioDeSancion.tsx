"use client";

// Formulario de sanción (2026-10-12) de la moderación (/supervisar o /supervision, desde el 2026-10-13).
// Llama a la server action aplicarSancion (lib/moderacion/acciones.ts) con la zona:
// un aviso, que sigue la escala de lib/usuarios/escala-de-avisos.ts (mensaje, 2 días, 7 días, baneo + lista
// negra), o un baneo inmediato para casos graves (también con lista negra).
// Con `reportes` (desde la bandeja de reportes) la sanción confirma los reportes de esa campaña o aporte.

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { Field, Textarea } from "@/components/sistema/Input";
import { aplicarSancion } from "@/lib/moderacion/acciones";
import { rutasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";
import type { TipoDeSancion } from "@/lib/usuarios/directorio";
import { AVISOS_PARA_BANEO, consecuenciaDelAviso, describirConsecuencia } from "@/lib/usuarios/escala-de-avisos";

const MINIMO = 20;

export default function FormularioDeSancion({
  zona,
  usuarioId,
  usuario,
  avisos,
  baneada,
  reportes,
}: {
  zona: ZonaDeModeracion;
  usuarioId: string;
  usuario: string;
  /** Avisos que ya lleva la cuenta (los strikes de antes cuentan). */
  avisos: number;
  /** Ya tiene un baneo vigente: no se ofrece el baneo inmediato. */
  baneada: boolean;
  /** Clave de los reportes que se confirman ("campana-116" o "aporte-55"). */
  reportes?: string;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoDeSancion>("STRIKE");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const idTipo = useId();

  const siguiente = avisos + 1;
  const tipos: { valor: TipoDeSancion; etiqueta: string; hint: string; deshabilitado?: boolean }[] = [
    {
      valor: "STRIKE",
      etiqueta: `Aviso (${Math.min(siguiente, AVISOS_PARA_BANEO)}.º de ${AVISOS_PARA_BANEO})`,
      hint: `Lleva ${avisos} ${avisos === 1 ? "aviso" : "avisos"}. Este trae: ${describirConsecuencia(consecuenciaDelAviso(siguiente))}.`,
    },
    {
      valor: "BANEO_DE_CAMPANA",
      etiqueta: "Baneo inmediato",
      hint: baneada
        ? "La cuenta ya está baneada."
        : "Para casos graves. Bloquea la cuenta hasta que se restaure a mano y pone su correo en la lista negra.",
      deshabilitado: baneada,
    },
  ];

  const corto = detalle.trim().length < MINIMO;

  function enviar() {
    setError(null);
    iniciar(async () => {
      const r = await aplicarSancion(zona, usuarioId, { tipo, detalle, reportes });
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <Field label="Tipo de sanción" required>
        <div className="flex flex-col gap-2">
          {tipos.map((t) => (
            <label
              key={t.valor}
              className={`flex items-start gap-2.5 rounded border px-3.5 py-2.5 transition-colors ${
                t.deshabilitado ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              } ${tipo === t.valor ? "border-brand-600 bg-brand-600/5" : "border-system-300 bg-white"}`}
            >
              <input
                type="radio"
                name={idTipo}
                checked={tipo === t.valor}
                disabled={t.deshabilitado}
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

      <Field
        label="Motivo"
        required
        hint={`${detalle.trim().length} / ${MINIMO} caracteres mínimos. ${usuario} lo verá en el aviso.`}
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
          onClick={() => router.push(reportes ? rutasDeModeracion(zona).reportes : rutasDeModeracion(zona).sanciones)}
        >
          Cancelar
        </Button>
        <Button type="button" variant="danger" size="sm" disabled={pendiente || corto} onClick={enviar}>
          {pendiente ? "Aplicando…" : tipo === "STRIKE" ? "Dar aviso" : "Banear"}
        </Button>
      </div>
    </div>
  );
}
