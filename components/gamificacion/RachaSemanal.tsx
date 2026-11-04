// Racha de «Hoy» (2026-11-02; SRS v1.1: RF-GAM-25 a 31, 85): los días de racha y los últimos 7 días con el estado de
// cada uno (confirmado, provisional con aportes en revisión, cubierto con protector, sin actividad, suspendido).
// Cada estado se distingue también por su forma y su texto para lectores de pantalla, no solo por el color.
// Sin estado: sirve en servidor y cliente. El calendario completo y los eventos de la racha (RF-GAM-85, 86) van en
// CalendarioDeRacha, que /progreso pasa como `accion`.

import type { ReactNode } from "react";
import {
  MAXIMO_DE_PROTECTORES,
  type EstadoDeDiaDeRacha,
  type ResumenDeRacha,
} from "@/lib/gamificacion/progreso-tipos";

const CLASE_DEL_DIA: Record<EstadoDeDiaDeRacha, string> = {
  confirmado: "bg-brand-700",
  // Rayado: cuenta provisionalmente mientras el aporte espera su revisión (ventana de 72 horas).
  provisional: "bg-[repeating-linear-gradient(135deg,var(--color-brand-700)_0_2px,#fff_2px_6px)]",
  protegido: "border-2 border-success-700 bg-success-100",
  sin_actividad: "border border-dashed border-brand-300 bg-white",
  suspendido: "bg-system-300",
};

const TEXTO_DEL_DIA: Record<EstadoDeDiaDeRacha, string> = {
  confirmado: "con actividad",
  provisional: "con un aporte en revisión",
  protegido: "cubierto con protector",
  sin_actividad: "sin actividad",
  suspendido: "suspendido",
};

export default function RachaSemanal({ racha, accion }: { racha: ResumenDeRacha; accion?: ReactNode }) {
  return (
    <>
      <h2 className="text-lg font-extrabold text-system-900">Racha</h2>
      <p className="font-mono text-2xl font-extrabold leading-none text-system-900">
        {racha.actual > 0 ? `${racha.actual} ${racha.actual === 1 ? "día" : "días"}` : "Sin racha"}
      </p>
      <ol aria-label="Últimos 7 días" className="grid grid-cols-7 gap-1.5">
        {racha.dias.map((d) => (
          <li key={d.dia} className="flex flex-col items-center gap-1">
            <span className={`h-6 w-full rounded-md ${CLASE_DEL_DIA[d.estado]}`} aria-hidden="true" />
            <span className="sr-only">
              {d.nombre}
              {d.hoy ? " (hoy)" : ""}: {TEXTO_DEL_DIA[d.estado]}
            </span>
            <span aria-hidden="true" className="text-[11px] text-brand-800">
              {d.hoy ? "Hoy" : d.letra}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[12.5px] text-brand-800">
        Máxima: {racha.maxima}. Protectores: {racha.protectores} de {MAXIMO_DE_PROTECTORES}.
      </p>
      {accion}
    </>
  );
}
