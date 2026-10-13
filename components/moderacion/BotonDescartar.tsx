"use client";

// "Descartar reportes" de la bandeja de reportes de la moderación (/supervisar o /supervision): pide una
// nota opcional y llama a la server action descartarReportes (lib/moderacion/acciones.ts). Resuelve todos
// los pendientes del caso (campaña o aporte).

import { useState, useTransition } from "react";

import Button from "@/components/sistema/Button";
import { Field, Textarea } from "@/components/sistema/Input";
import { descartarReportes } from "@/lib/moderacion/acciones";
import type { ZonaDeModeracion } from "@/lib/moderacion/rutas";

export default function BotonDescartar({ zona, clave, caso }: { zona: ZonaDeModeracion; clave: string; caso: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!abierto) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
        Descartar<span className="sr-only"> los reportes de {caso}</span>
      </Button>
    );
  }

  return (
    <div className="w-full max-w-md">
      <Field label="Nota (opcional)" hint="Por qué no amerita aviso. Solo la ve quien modera.">
        <Textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} className="min-h-[70px]" />
      </Field>
      {error && (
        <p role="alert" className="mb-2 text-[12.5px] text-error-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              setError(null);
              const r = await descartarReportes(zona, clave, nota);
              if (!r.ok) setError(r.error);
            })
          }
        >
          {pendiente ? "Descartando…" : "Confirmar"}
        </Button>
      </div>
    </div>
  );
}
