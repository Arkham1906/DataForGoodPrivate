"use client";

// Botón "Restaurar acceso" de la lista de sanciones de la moderación (/supervisar o /supervision).
// Llama a la server action restaurarAcceso (lib/moderacion/acciones.ts) con la zona.
// Desde el 2026-11-22 pregunta en una ventana ("¿Seguro que quieres…?", components/sistema/useConfirmacion) en vez del
// "No / Confirmar" en el renglón; `tipo` dice qué se levanta.

import Button from "@/components/sistema/Button";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import { restaurarAcceso } from "@/lib/moderacion/acciones";
import type { ZonaDeModeracion } from "@/lib/moderacion/rutas";

export default function BotonRestaurar({
  zona,
  sancionId,
  usuario,
  tipo,
  anchoCompleto = false,
}: {
  zona: ZonaDeModeracion;
  sancionId: string;
  usuario: string;
  /** La sanción que se levanta: una suspensión o un baneo de la cuenta. */
  tipo?: "SUSPENSION" | "BANEO" | string;
  anchoCompleto?: boolean;
}) {
  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();
  const baneo = tipo === "BANEO";

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className={anchoCompleto ? "w-full md:w-auto" : ""}
        disabled={ocupado}
        onClick={() =>
          pedirConfirmacion({
            pregunta: `¿Seguro que quieres restaurar el acceso de ${usuario}?`,
            detalle: (
              <>
                <p>
                  {baneo
                    ? "Se levanta el baneo: puede volver a entrar a su cuenta y su correo sale de la lista negra."
                    : "Se levanta la suspensión: puede volver a entrar a su cuenta desde ahora."}
                </p>
                <p>Los avisos que lleva siguen contando para la escala.</p>
              </>
            ),
            textoConfirmar: "Sí, restaurar",
            textoOcupado: "Restaurando…",
            accion: () => restaurarAcceso(zona, sancionId),
          })
        }
      >
        Restaurar
        <span className="sr-only"> el acceso de {usuario}</span>
      </Button>
      {ventana}
    </>
  );
}
