"use client";

// Botón "Quitar bloqueo" de un dispositivo anónimo. Llama a la server action
// quitarBloqueoDeDispositivo (lib/moderacion/acciones.ts) con la zona (/supervisar o /supervision).
// Desde el 2026-11-22 pregunta en una ventana ("¿Seguro que quieres…?", components/sistema/useConfirmacion) en vez del
// "No / Confirmar" en el renglón.

import Button from "@/components/sistema/Button";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import { quitarBloqueoDeDispositivo } from "@/lib/moderacion/acciones";
import type { ZonaDeModeracion } from "@/lib/moderacion/rutas";

export default function BotonQuitarBloqueo({
  zona,
  bloqueoId,
  anchoCompleto = false,
}: {
  zona: ZonaDeModeracion;
  bloqueoId: string;
  anchoCompleto?: boolean;
}) {
  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className={anchoCompleto ? "w-full md:w-auto" : ""}
        disabled={ocupado}
        onClick={() =>
          pedirConfirmacion({
            pregunta: `¿Seguro que quieres quitar el bloqueo del dispositivo anónimo #${bloqueoId}?`,
            detalle: (
              <p>
                Ese dispositivo podrá volver a aportar sin cuenta en cualquier campaña desde ahora, antes de que venza el
                bloqueo. Si vuelve a enviar aportes inapropiados, se bloquea otra vez.
              </p>
            ),
            textoConfirmar: "Sí, quitar bloqueo",
            textoOcupado: "Quitando…",
            accion: () => quitarBloqueoDeDispositivo(zona, bloqueoId),
          })
        }
      >
        Quitar bloqueo
        <span className="sr-only"> del dispositivo {bloqueoId}</span>
      </Button>
      {ventana}
    </>
  );
}
