"use client";

// "Descartar reportes" de la bandeja de reportes de la moderación (/supervisar o /supervision): pide una
// nota opcional y llama a la server action descartarReportes (lib/moderacion/acciones.ts). Resuelve todos
// los pendientes del caso (campaña o aporte). Desde el 2026-11-22, "Descartar reportes" pregunta antes
// ("¿Seguro que quieres…?", components/sistema/useConfirmacion).

import { useState } from "react";

import Button from "@/components/sistema/Button";
import { Field, Textarea } from "@/components/sistema/Input";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import { descartarReportes } from "@/lib/moderacion/acciones";
import type { ZonaDeModeracion } from "@/lib/moderacion/rutas";

export default function BotonDescartar({ zona, clave, caso }: { zona: ZonaDeModeracion; clave: string; caso: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const { pedirConfirmacion, ventana, ocupado: pendiente } = useConfirmacion();

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
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={pendiente}
          onClick={() =>
            pedirConfirmacion({
              pregunta: `¿Seguro que quieres descartar los reportes de ${caso}?`,
              detalle: (
                <p>
                  Se resuelven todos los reportes pendientes de este caso sin sancionar a nadie y no cuentan para la escala
                  de avisos. No se puede deshacer.
                </p>
              ),
              textoConfirmar: "Sí, descartar",
              textoOcupado: "Descartando…",
              accion: () => descartarReportes(zona, clave, nota),
            })
          }
        >
          Descartar reportes
        </Button>
      </div>
      {ventana}
    </div>
  );
}
