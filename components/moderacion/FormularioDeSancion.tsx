"use client";

// Formulario de sanción (2026-10-12) de la moderación (/supervisar o /supervision, desde el 2026-10-13).
// Llama a la server action aplicarSancion (lib/moderacion/acciones.ts) con la zona:
// un aviso, que sigue la escala de lib/usuarios/escala-de-avisos.ts (mensaje, 2 días, 7 días, baneo + lista
// negra), una suspensión directa de 2 o 7 días (2026-10-16) o un baneo inmediato para casos graves (también
// con lista negra). Las opciones son components/moderacion/OpcionesDeSancion.
// Con `reportes` (desde la bandeja de reportes) la sanción confirma los reportes de esa campaña o aporte.
// Desde el 2026-11-22, antes de aplicarla pregunta "¿Seguro que quieres…?" con lo que le pasa a la cuenta
// (components/sistema/useConfirmacion).

import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/sistema/Button";
import { Field, Textarea } from "@/components/sistema/Input";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import { consecuenciaDelAviso, describirConsecuencia } from "@/lib/usuarios/escala-de-avisos";
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
  const { pedirConfirmacion, ventana, ocupado: pendiente } = useConfirmacion();

  const corto = detalle.trim().length < MINIMO;

  function enviar() {
    const efecto =
      sancion.tipo === "STRIKE"
        ? `Es su aviso número ${avisos + 1}: ${describirConsecuencia(consecuenciaDelAviso(avisos + 1))}.`
        : sancion.tipo === "SUSPENSION_TEMPORAL"
          ? `No podrá entrar a su cuenta durante ${sancion.dias} ${sancion.dias === 1 ? "día" : "días"}; después vuelve a entrar sola.`
          : "La cuenta queda baneada de inmediato y su correo pasa a la lista negra: no podrá registrarse otra vez.";
    pedirConfirmacion({
      pregunta: `¿Seguro que quieres ${textoDeAplicar(sancion).toLowerCase()} a ${usuario}?`,
      detalle: (
        <>
          <p>{efecto}</p>
          <p>{usuario} recibe un aviso con el motivo que escribiste.{reportes ? " Los reportes de este caso quedan resueltos." : ""}</p>
          {sancion.tipo === "STRIKE" ? (
            <p>Un aviso no se puede quitar: cuenta para la escala para siempre.</p>
          ) : (
            <p>Se puede levantar después con «Restaurar» en Sanciones.</p>
          )}
        </>
      ),
      textoConfirmar: `Sí, ${textoDeAplicar(sancion).toLowerCase()}`,
      textoOcupado: "Aplicando…",
      peligro: true,
      accion: () => aplicarSancion(zona, usuarioId, { tipo: sancion.tipo, dias: sancion.dias, detalle, reportes }),
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
          {textoDeAplicar(sancion)}
        </Button>
      </div>
      {ventana}
    </div>
  );
}
