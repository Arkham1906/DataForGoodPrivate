// "Tus tickets" (2026-11-24): lo que el supervisor pidió al SuperUsuario (sanciones que suspenden o banean y decisiones
// de datos abiertos), pendientes y los resueltos de los últimos 30 días, con la respuesta si lo rechazó. Va arriba de
// /supervision/sanciones (components/moderacion/PantallaDeSanciones). Server Component; datos de
// ticketsDelSupervisor() de lib/tickets/consultas.ts.

import Link from "next/link";

import Tag from "@/components/sistema/Tag";
import { NOMBRE_DE_ESTADO_DE_TICKET, type EstadoDeTicket } from "@/lib/tickets/reglas";
import type { TicketParaLista } from "@/lib/tickets/consultas";
import { formatearFecha } from "@/lib/usuarios/directorio";

const TONO: Record<EstadoDeTicket, "warn" | "ok" | "danger"> = { pendiente: "warn", aprobado: "ok", rechazado: "danger" };

export default function TicketsDelSupervisor({ tickets }: { tickets: TicketParaLista[] }) {
  if (tickets.length === 0) return null;
  return (
    <section aria-labelledby="tus-tickets" className="mb-8">
      <h2 id="tus-tickets" className="mb-1 text-[15px] font-bold text-system-900">
        Tus tickets
      </h2>
      <p className="mb-3 text-[12.5px] text-system-600">
        Suspensiones, baneos y decisiones de datos abiertos que enviaste al SuperUsuario. Se aplican solo si los aprueba.
      </p>
      <ul className="divide-y divide-system-200 rounded-lg border border-system-200 bg-white shadow-sm">
        {tickets.map((t) => (
          <li key={t.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-system-900">
                {t.pedido}
                {t.persona ? ` · ${t.persona.nombre}` : ""}
                {t.campana ? (
                  <>
                    {" · "}
                    <Link href={`/supervision/${t.campana.id}`} className="hover:text-brand-600 hover:underline">
                      «{t.campana.nombre}»
                    </Link>
                  </>
                ) : null}
              </p>
              <p className="mt-0.5 text-[12px] text-system-500">
                Enviado el {formatearFecha(t.creadoEn)}
                {t.resueltoEn ? ` · resuelto el ${formatearFecha(t.resueltoEn)}` : ""}
              </p>
              {t.estado === "rechazado" && t.respuesta ? (
                <p className="mt-1 text-[12.5px] text-system-700">
                  <span className="font-semibold">Respuesta:</span> {t.respuesta}
                </p>
              ) : null}
            </div>
            <Tag tone={TONO[t.estado]}>{NOMBRE_DE_ESTADO_DE_TICKET[t.estado]}</Tag>
          </li>
        ))}
      </ul>
    </section>
  );
}
