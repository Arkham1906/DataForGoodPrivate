"use client";

// Lista de /tickets del panel (2026-11-24): cada ticket con quién lo pidió, a quién o qué campaña, lo que pidió y su
// motivo. Si está pendiente, "Aprobar" (se aplica tal cual) y "Rechazar" (con respuesta para el supervisor), que
// preguntan antes (components/sistema/useConfirmacion) y llaman a resolverTicketDelPanel (lib/tickets/acciones.ts).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import Button from "@/components/sistema/Button";
import Tag from "@/components/sistema/Tag";
import { useConfirmacion } from "@/components/sistema/useConfirmacion";
import { resolverTicketDelPanel } from "@/lib/tickets/acciones";
import {
  NOMBRE_DE_ESTADO_DE_TICKET,
  RESPUESTA_MAXIMA_DE_TICKET,
  RESPUESTA_MINIMA_DE_TICKET,
  type EstadoDeTicket,
  type TipoDeTicket,
} from "@/lib/tickets/reglas";

export type TicketParaPanel = {
  id: string;
  tipo: TipoDeTicket;
  estado: EstadoDeTicket;
  supervisor: { id: string | null; nombre: string };
  persona: { id: string; nombre: string } | null;
  campana: { id: string; nombre: string } | null;
  pedido: string;
  motivo: string | null;
  origen: "sanciones" | "reportes" | "rechazo" | null;
  reportes: number;
  fechaTexto: string;
  resueltoTexto: string | null;
  respuesta: string | null;
};

const TONO: Record<EstadoDeTicket, "warn" | "ok" | "danger"> = { pendiente: "warn", aprobado: "ok", rechazado: "danger" };

const ORIGEN: Record<"sanciones" | "reportes" | "rechazo", string> = {
  sanciones: "desde Sanciones",
  reportes: "al resolver reportes",
  rechazo: "al rechazar su campaña",
};

function Resolver({ t }: { t: TicketParaPanel }) {
  const router = useRouter();
  const id = useId();
  const [respuesta, setRespuesta] = useState("");
  const { pedirConfirmacion, ventana, ocupado } = useConfirmacion();
  const largo = respuesta.trim().length;
  const sobre = t.persona ? t.persona.nombre : `«${t.campana?.nombre ?? "la campaña"}»`;

  function aprobar() {
    pedirConfirmacion({
      pregunta: `¿Seguro que quieres aprobar: ${t.pedido.toLowerCase()} para ${sobre}?`,
      detalle: (
        <>
          <p>
            {t.tipo === "sancion"
              ? `Se aplica ahora a ${sobre} con el motivo que escribió el supervisor, y se le avisa.${t.reportes > 0 ? " Los reportes ligados quedan resueltos." : ""} Si es una suspensión o un baneo, deja de poder entrar.`
              : t.pedido.startsWith("Publicar")
                ? "Los aportes aprobados de la campaña quedan disponibles para cualquiera en Datos abiertos; se avisa a quien la organiza y a quienes aportaron."
                : "Los datos no se publican y quien organiza la campaña recibe el motivo."}
          </p>
          <p>{t.supervisor.nombre} recibe el aviso. No se puede deshacer desde aquí.</p>
        </>
      ),
      textoConfirmar: "Sí, aprobar",
      textoOcupado: "Aprobando…",
      accion: () => resolverTicketDelPanel(t.id, true, ""),
      alTerminar: () => router.refresh(),
    });
  }

  function rechazar() {
    pedirConfirmacion({
      pregunta: `¿Seguro que quieres rechazar el ticket de ${t.supervisor.nombre}?`,
      detalle: (
        <p>
          No se aplica nada. {t.supervisor.nombre} recibe tu respuesta
          {t.reportes > 0 ? " y los reportes vuelven a su bandeja" : ""}
          {t.tipo === "datos_abiertos" ? " y puede volver a decidir sobre los datos" : ""}. No se puede deshacer.
        </p>
      ),
      textoConfirmar: "Sí, rechazar",
      textoOcupado: "Guardando…",
      peligro: true,
      accion: () => resolverTicketDelPanel(t.id, false, respuesta),
      alTerminar: () => router.refresh(),
    });
  }

  return (
    <div className="mt-4 border-t border-system-200 pt-4">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-system-900">
        Respuesta para {t.supervisor.nombre} <span className="font-normal text-system-500">(obligatoria si rechazas)</span>
      </label>
      <textarea
        id={id}
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        maxLength={RESPUESTA_MAXIMA_DE_TICKET}
        rows={2}
        placeholder="Por qué no se aprueba. El supervisor la lee tal cual."
        className="w-full rounded border border-system-300 bg-white px-3.5 py-2.5 text-sm text-system-900 outline-none transition-colors focus:border-brand-600"
      />
      <p className={`mt-1 text-[12px] ${largo < RESPUESTA_MINIMA_DE_TICKET ? "text-system-500" : "text-success-700"}`}>
        {largo} / {RESPUESTA_MINIMA_DE_TICKET} caracteres mínimos para rechazar
      </p>
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="danger" disabled={ocupado || largo < RESPUESTA_MINIMA_DE_TICKET} onClick={rechazar}>
          Rechazar
        </Button>
        <Button size="sm" variant="primary" disabled={ocupado} onClick={aprobar}>
          Aprobar
        </Button>
      </div>
      {ventana}
    </div>
  );
}

export default function ListaDeTickets({ tickets }: { tickets: TicketParaPanel[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {tickets.map((t) => (
        <li key={t.id} className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-system-900">{t.pedido}</span>
                <Tag>{t.tipo === "sancion" ? "Sanción" : "Datos abiertos"}</Tag>
              </p>
              <p className="mt-1 text-[13px] text-system-700">
                {t.persona ? (
                  <>
                    Para{" "}
                    <Link href={`/usuarios/${t.persona.id}`} className="font-semibold text-system-900 hover:text-brand-600">
                      {t.persona.nombre}
                    </Link>
                  </>
                ) : null}
                {t.campana ? (
                  <>
                    {t.persona ? " · " : "Campaña "}
                    <Link href={`/supervisar/${t.campana.id}`} className="font-semibold text-system-900 hover:text-brand-600">
                      «{t.campana.nombre}»
                    </Link>
                  </>
                ) : null}
              </p>
              <p className="mt-0.5 text-[12px] text-system-500">
                Lo pidió{" "}
                {t.supervisor.id ? (
                  <Link href={`/usuarios/supervisores/${t.supervisor.id}`} className="hover:text-brand-600 hover:underline">
                    {t.supervisor.nombre}
                  </Link>
                ) : (
                  t.supervisor.nombre
                )}
                {t.origen ? ` ${ORIGEN[t.origen]}` : ""} · el {t.fechaTexto}
                {t.resueltoTexto ? ` · resuelto el ${t.resueltoTexto}` : ""}
                {t.reportes > 0 ? ` · ${t.reportes} ${t.reportes === 1 ? "reporte ligado" : "reportes ligados"}` : ""}
              </p>
            </div>
            <Tag tone={TONO[t.estado]}>{NOMBRE_DE_ESTADO_DE_TICKET[t.estado]}</Tag>
          </div>

          {t.motivo ? (
            <div className="mt-4">
              <h3 className="text-[13px] font-semibold text-system-900">
                {t.tipo === "sancion" ? "Motivo (lo leerá la persona)" : "Motivo para no publicar"}
              </h3>
              <p className="mt-1.5 whitespace-pre-line rounded-lg bg-system-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-system-900">
                {t.motivo}
              </p>
            </div>
          ) : null}

          {t.estado === "pendiente" ? (
            <Resolver t={t} />
          ) : t.respuesta ? (
            <div className="mt-4">
              <h3 className="text-[13px] font-semibold text-system-900">Tu respuesta</h3>
              <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-system-900">{t.respuesta}</p>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
