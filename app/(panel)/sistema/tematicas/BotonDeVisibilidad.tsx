"use client";

// Botón "Ocultar" / "Mostrar" de una temática en /sistema/tematicas. Llama a la server action
// cambiarVisibilidadDeTematica (lib/tematicas/acciones-tematicas.ts), que revalida la página.
// Desde el 2026-11-22 pide confirmación ("¿Seguro que quieres…?", components/sistema/useConfirmacion).

import Button from "@/components/sistema/Button";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import { cambiarVisibilidadDeTematica } from "@/lib/tematicas/acciones-tematicas";

export default function BotonDeVisibilidad({ id, nombre, oculta }: { id: number; nombre: string; oculta: boolean }) {
  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();

  return (
    <>
      <Button
        size="sm"
        variant={oculta ? "secondary" : "danger"}
        disabled={ocupado}
        onClick={() =>
          pedirConfirmacion(
            oculta
              ? {
                  pregunta: `¿Seguro que quieres volver a mostrar «${nombre}»?`,
                  detalle: <p>Se vuelve a ofrecer al crear campañas y al elegir intereses en el perfil.</p>,
                  textoConfirmar: "Sí, mostrar",
                  // El segundo argumento es `oculta`.
                  accion: () => cambiarVisibilidadDeTematica(id, false),
                }
              : {
                  pregunta: `¿Seguro que quieres ocultar «${nombre}»?`,
                  detalle: (
                    <>
                      <p>Deja de ofrecerse al crear campañas y al elegir intereses, y nadie podrá volver a agregarla.</p>
                      <p>Los perfiles y las campañas que ya la tienen la conservan. Puedes volver a mostrarla cuando quieras.</p>
                    </>
                  ),
                  textoConfirmar: "Sí, ocultar",
                  peligro: true,
                  accion: () => cambiarVisibilidadDeTematica(id, true),
                },
          )
        }
      >
        {oculta ? "Mostrar" : "Ocultar"}
        <span className="sr-only"> {nombre}</span>
      </Button>
      {ventana}
    </>
  );
}
