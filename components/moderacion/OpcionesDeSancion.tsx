"use client";

// Opciones de sanción (2026-10-16): aviso (sigue la escala), suspensión directa de 2 o 7 días y baneo
// inmediato. Las comparten el formulario de sanción (/supervisar y /supervision → sanciones) y el
// rechazo de una campaña con sanción (components/supervision/FormularioDeRechazo). Con `avisos` conocido
// dice qué trae el siguiente aviso; sin él, explica la escala.

import { useId } from "react";

import type { TipoDeSancion } from "@/lib/usuarios/directorio";
import {
  AVISOS_PARA_BANEO,
  DIAS_DE_SUSPENSION,
  consecuenciaDelAviso,
  describirConsecuencia,
} from "@/lib/usuarios/escala-de-avisos";

export type SancionElegida = { tipo: TipoDeSancion; dias: number };

export const SANCION_POR_DEFECTO: SancionElegida = { tipo: "STRIKE", dias: DIAS_DE_SUSPENSION[0] };

export default function OpcionesDeSancion({
  valor,
  onCambiar,
  avisos = null,
  baneada = false,
  deshabilitado = false,
}: {
  valor: SancionElegida;
  onCambiar: (valor: SancionElegida) => void;
  /** Avisos que ya lleva la cuenta; null si no se sabe. */
  avisos?: number | null;
  /** Ya tiene un baneo vigente: no se ofrecen suspensión ni baneo. */
  baneada?: boolean;
  deshabilitado?: boolean;
}) {
  const nombre = useId();
  const idDias = useId();

  const siguiente = avisos === null ? null : avisos + 1;
  const tipos: { valor: TipoDeSancion; etiqueta: string; hint: string; deshabilitado?: boolean }[] = [
    {
      valor: "STRIKE",
      etiqueta: siguiente === null ? "Aviso" : `Aviso (${Math.min(siguiente, AVISOS_PARA_BANEO)}.º de ${AVISOS_PARA_BANEO})`,
      hint:
        siguiente === null || avisos === null
          ? `Suma un aviso a su cuenta: el 1.º es solo un mensaje, el 2.º suspende 2 días, el 3.º 7 días y el ${AVISOS_PARA_BANEO}.º banea.`
          : `Lleva ${avisos} ${avisos === 1 ? "aviso" : "avisos"}. Este trae: ${describirConsecuencia(consecuenciaDelAviso(siguiente))}.`,
    },
    {
      valor: "SUSPENSION_TEMPORAL",
      etiqueta: "Suspensión",
      hint: baneada ? "La cuenta ya está baneada." : "Bloquea la cuenta los días que elijas; después vuelve a entrar sola.",
      deshabilitado: baneada,
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

  return (
    <div className="flex flex-col gap-2">
      {tipos.map((t) => (
        <label
          key={t.valor}
          className={`flex items-start gap-2.5 rounded border px-3.5 py-2.5 transition-colors ${
            t.deshabilitado || deshabilitado ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          } ${valor.tipo === t.valor ? "border-brand-600 bg-brand-600/5" : "border-system-300 bg-white"}`}
        >
          <input
            type="radio"
            name={nombre}
            checked={valor.tipo === t.valor}
            disabled={t.deshabilitado || deshabilitado}
            onChange={() => onCambiar({ ...valor, tipo: t.valor })}
            className="mt-0.5"
          />
          <span className="flex-1">
            <span className="block text-[13.5px] font-medium text-system-900">{t.etiqueta}</span>
            <span className="block text-[12px] text-system-500">{t.hint}</span>
            {t.valor === "SUSPENSION_TEMPORAL" && valor.tipo === "SUSPENSION_TEMPORAL" && (
              <span className="mt-2 flex items-center gap-2">
                {/* Sin <label>: ya está dentro del <label> de la opción, y no se anidan. */}
                <span id={idDias} className="text-[12.5px] text-system-900">
                  Duración
                </span>
                <select
                  aria-labelledby={idDias}
                  value={valor.dias}
                  disabled={deshabilitado}
                  onChange={(e) => onCambiar({ ...valor, dias: Number(e.target.value) })}
                  className="rounded border border-system-300 bg-white px-2 py-1 text-[12.5px] text-system-900 outline-none focus:border-brand-600"
                >
                  {DIAS_DE_SUSPENSION.map((d) => (
                    <option key={d} value={d}>
                      {d} días
                    </option>
                  ))}
                </select>
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Texto del botón que aplica la sanción. */
export function textoDeAplicar(s: SancionElegida): string {
  return s.tipo === "STRIKE" ? "Dar aviso" : s.tipo === "SUSPENSION_TEMPORAL" ? `Suspender ${s.dias} días` : "Banear";
}
