"use client";

// Formulario de sanción (2026-10-12) de la moderación (/supervisar o /supervision, desde el 2026-10-13).
// Llama a la server action aplicarSancion (lib/moderacion/acciones.ts) con la zona:
// un aviso, que sigue la escala de lib/usuarios/escala-de-avisos.ts (mensaje, 2 días, 7 días, baneo + lista
// negra), una suspensión directa de 2 o 7 días (2026-10-16) o un baneo inmediato para casos graves (también
// con lista negra). Las opciones son components/moderacion/OpcionesDeSancion.
// Con `reportes` (desde la bandeja de reportes) la sanción confirma los reportes de esa campaña o aporte.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { Field, Textarea } from "@/components/sistema/Input";
import OpcionesDeSancion, { SANCION_POR_DEFECTO, textoDeAplicar } from "@/components/moderacion/OpcionesDeSancion";
import { aplicarSancion } from "@/lib/moderacion/acciones";
import { rutasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";

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
  /** Ya tiene un baneo vigente: no se ofrecen la suspensión ni el baneo inmediato. */
  baneada: boolean;
  /** Clave de los reportes que se confirman ("campana-116" o "aporte-55"). */
  reportes?: string;
}) {
  const router = useRouter();
  const [sancion, setSancion] = useState(SANCION_POR_DEFECTO);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const corto = detalle.trim().length < MINIMO;

  function enviar() {
    setError(null);
    iniciar(async () => {
      const r = await aplicarSancion(zona, usuarioId, { tipo: sancion.tipo, dias: sancion.dias, detalle, reportes });
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <Field label="Tipo de sanción" required>
        <OpcionesDeSancion valor={sancion} onCambiar={setSancion} avisos={avisos} baneada={baneada} />
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
          {pendiente ? "Aplicando…" : textoDeAplicar(sancion)}
        </Button>
      </div>
    </div>
  );
}
