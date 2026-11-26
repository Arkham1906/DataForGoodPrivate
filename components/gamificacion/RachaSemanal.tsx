// Racha de «Hoy» (2026-11-02; SRS v1.1: RF-GAM-25 a 31, 85): los días de racha y los últimos 7 días con el estado de
// cada uno (con actividad, cubierto con protector, sin actividad, suspendido).
// Cada estado se distingue también por su forma y su texto para lectores de pantalla, no solo por el color.
// Sin estado: sirve en servidor y cliente. El calendario completo y los eventos de la racha (RF-GAM-85, 86) van en
// CalendarioDeRacha, que /inicio pasa como `accion`.
// 2026-11-20 (lienzo de objetos aprobado): el día protegido lleva el escudo en naranja, y abajo la fila de protectores
// con sus escudos (llenos los que tiene, punteados los lugares libres).

import type { ReactNode } from "react";
import { TEXTOS } from "@/lib/gamificacion/textos";
import { GlifoDeObjeto, ImagenDeObjeto } from "./ObjetoDeInventario";
import {
  MAXIMO_DE_PROTECTORES,
  PROTECTORES_ACTIVOS,
  type EstadoDeDiaDeRacha,
  type ResumenDeRacha,
} from "@/lib/gamificacion/progreso-tipos";

const CLASE_DEL_DIA: Record<EstadoDeDiaDeRacha, string> = {
  confirmado: "bg-brand-700",
  protegido: "flex items-center justify-center bg-fuego-100 text-fuego-700",
  sin_actividad: "border border-dashed border-brand-300 bg-white",
  suspendido: "bg-system-300",
};

const TEXTO_DEL_DIA: Record<EstadoDeDiaDeRacha, string> = {
  confirmado: "con actividad",
  protegido: "cubierto con protector",
  sin_actividad: "sin actividad",
  suspendido: "suspendido",
};

export default function RachaSemanal({ racha, accion }: { racha: ResumenDeRacha; accion?: ReactNode }) {
  return (
    <>
      <h2 className="text-lg font-extrabold text-system-900">Días de racha</h2>
      <p className="font-mono text-2xl font-extrabold leading-none text-system-900">
        {racha.actual > 0 ? `${racha.actual} ${racha.actual === 1 ? "día" : "días"}` : "Sin racha"}
      </p>
      <ol aria-label="Últimos 7 días" className="grid grid-cols-7 gap-1.5">
        {racha.dias.map((d) => (
          <li key={d.dia} className="flex flex-col items-center gap-1">
            <span className={`h-6 w-full rounded-md ${CLASE_DEL_DIA[d.estado]}`} aria-hidden="true">
              {d.estado === "protegido" && <GlifoDeObjeto objeto="protector" className="h-4 w-4" />}
            </span>
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
      <p className="text-[12.5px] text-brand-800">Máxima: {racha.maxima}.</p>
      {PROTECTORES_ACTIVOS && (
        <p className="flex items-center gap-2.5 border-t border-brand-100 pt-2.5">
          <span aria-hidden="true" className="flex gap-1">
            {Array.from({ length: MAXIMO_DE_PROTECTORES }, (_, i) =>
              i < racha.protectores ? (
                <ImagenDeObjeto key={i} objeto="protector" tamano={26} lado={96} className="h-[26px] w-[26px]" />
              ) : (
                <span key={i} className="flex h-[26px] w-[26px] items-center justify-center text-system-400">
                  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.5" focusable="false">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
              ),
            )}
          </span>
          <span className="text-[13px] font-semibold text-system-800">{TEXTOS.inventario.protectores(racha.protectores, MAXIMO_DE_PROTECTORES)}</span>
        </p>
      )}
      {accion}
    </>
  );
}
