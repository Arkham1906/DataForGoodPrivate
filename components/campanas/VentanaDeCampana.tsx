"use client";

// Ventana con el detalle de una campaña (2026-10-27, a pedido del usuario): se abre al hacer clic en
// una tarjeta de /campanas ("Explorar campañas") o de /mis-campanas, sin salir de la lista. Muestra lo
// que ya trae la lista (types/index.ts, Campaign): temática y etiquetas, descripción completa, quién
// organiza, lugar, vigencia, tipos de dato, cuota, meta, participantes, checklists y si es especial.
// `extra` agrega lo que solo ve el creador y `acciones` los botones de cada pantalla.
// <dialog> nativo como ui/VentanaDeProblemas: Esc o clic afuera la cierran y el foco vuelve a la tarjeta.

import { useEffect, useId, useRef, type ReactNode } from "react";

import RutaDeTematica from "@/components/ui/RutaDeTematica";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { quienOrganiza } from "@/lib/campanas/organizacion";
import { textoDelProposito } from "@/lib/campanas/proposito";
import { ETIQUETA_DE_CAMPANA, NOMBRE_DE_TIPO, type TipoDeDato } from "@/lib/campanas/sistema-opciones";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { fechaDDMMAAAA } from "@/lib/fecha-de-tepic";
import type { Campaign } from "@/types";

const nf = new Intl.NumberFormat("es-MX");

function fechaYHora(fecha: string | null | undefined, hora: string | null | undefined): string {
  if (!fecha) return "Sin fecha";
  return `${fechaDDMMAAAA(fecha)}${hora ? ` a las ${hora.slice(0, 5)}` : ""}`;
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-system-500">{titulo}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-system-900">{children}</dd>
    </div>
  );
}

export default function VentanaDeCampana({
  campana,
  onCerrar,
  extra,
  acciones,
}: {
  campana: Campaign;
  onCerrar: () => void;
  /** Lo que solo ve el creador (en /mis-campanas). */
  extra?: ReactNode;
  /** Botones al pie. */
  acciones?: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  // Solo se monta abierta: quien la usa la dibuja mientras hay una campaña elegida.
  useEffect(() => {
    const el = dialogo.current;
    if (el && !el.open) el.showModal();
  }, []);

  const pct = porcentajeDeMeta(campana.approvedContributions, campana.goalContributions);
  const estado = ETIQUETA_DE_CAMPANA[campana.status];
  const lugar = textoDeUbicacion(
    { todoElPais: campana.todoElPais, estado: campana.locationState, municipio: campana.locationCity, colonia: campana.locationColonia },
    "Sin definir",
  );
  const tipos = campana.dataTypes.map((t) => NOMBRE_DE_TIPO[t as TipoDeDato] ?? t).join(", ") || "Sin definir";
  const checklists = (campana.checklistSecciones ?? []).filter((s) => s.opciones.length > 0);
  const tematica = campana.tematica || campana.tag;

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === dialogo.current) dialogo.current?.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-lg border border-system-200 bg-white p-0 text-system-900 shadow-lg backdrop:bg-system-900/40"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-system-200 p-5 max-md:p-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {estado && <Tag tone={estado.tono}>{estado.texto}</Tag>}
              {campana.especial && campana.especial.etapa !== "terminada" && <Tag tone="warn">★ Especial ×{campana.especial.multiplicador}</Tag>}
            </div>
            <h2 id={idTitulo} className="break-words text-lg font-extrabold text-system-900">
              {campana.name}
            </h2>
            <RutaDeTematica tematica={tematica} etiquetas={campana.etiquetas} className="mt-2" />
          </div>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-[18px] leading-none text-system-500 transition-colors hover:bg-system-100 hover:text-system-900"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 max-md:p-4">
          {campana.description && (
            <p className="mb-4 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-system-600">{campana.description}</p>
          )}

          <div className="mb-4">
            <ProgressBar pct={pct} tone="ok" />
            <p className="mt-1.5 font-mono text-[11.5px] text-system-600">
              {nf.format(campana.approvedContributions)} de {nf.format(campana.goalContributions)} aportes aprobados · {pct}% de la meta
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
            <Dato titulo="Organiza">{quienOrganiza(campana)}</Dato>
            <Dato titulo="Propósito">{textoDelProposito(campana.proposito, campana.propositoOtro) ?? "Sin definir"}</Dato>
            <Dato titulo="Lugar">{lugar}</Dato>
            <Dato titulo="Inicio">{fechaYHora(campana.startDate, campana.startTime)}</Dato>
            <Dato titulo="Cierre">
              {fechaYHora(campana.endDate, campana.endTime)}
              {campana.daysRemaining != null && campana.status === "activa" && (
                <span className="text-system-500"> · {campana.daysRemaining === 1 ? "queda 1 día" : `quedan ${campana.daysRemaining} días`}</span>
              )}
            </Dato>
            <Dato titulo="Tipos de dato">{tipos}</Dato>
            <Dato titulo="Cuota por persona">
              {campana.quotaPerUser > 0 ? `${nf.format(campana.quotaPerUser)} ${campana.quotaPerUser === 1 ? "aporte" : "aportes"}` : "Sin definir"}
            </Dato>
            <Dato titulo="Participantes">{nf.format(campana.participants)}</Dato>
            {campana.especial && (
              <Dato titulo="Campaña especial">
                ×{campana.especial.multiplicador} de XP
                {campana.especial.bono > 0 ? ` + ${nf.format(campana.especial.bono)} XP de bono` : ""}
                {campana.especial.insignia ? ` · insignia «${campana.especial.insignia}»` : ""}
              </Dato>
            )}
          </dl>

          {checklists.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-system-500">Qué se marca al aportar</p>
              <div className="mt-1.5 flex flex-col gap-2">
                {checklists.map((s, i) => (
                  <div key={`${s.titulo}-${i}`}>
                    <p className="text-[12.5px] font-semibold text-system-900">{s.titulo}</p>
                    <p className="text-[12.5px] text-system-600">{s.opciones.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {extra && <div className="mt-5 border-t border-system-200 pt-4">{extra}</div>}
        </div>

        {acciones && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-system-200 p-4">{acciones}</div>}
      </div>
    </dialog>
  );
}
