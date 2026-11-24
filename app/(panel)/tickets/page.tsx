// Pantalla /tickets del panel (2026-11-24, a pedido del usuario): las acciones importantes que pidieron los
// supervisores y esperan la decisión final del SuperUsuario: suspensiones, baneos y avisos que suspenden o banean
// (desde Sanciones, desde un reporte o al rechazar una campaña) y publicar o no los datos abiertos de una campaña.
// Pendientes (los más viejos primero) o resueltos (?vista=resueltos); búsqueda (?q=) y tipo (?tipo=).
// Server Component. Datos: listarTickets() de lib/tickets/consultas.ts. Lista y botones: lista.tsx.

import type { Metadata } from "next";
import Link from "next/link";

import FiltrosEnLaUrl from "@/components/sistema/FiltrosEnLaUrl";
import { Aviso, Encabezado, formatearNumero } from "@/components/sistema/ui";
import { busquedaDeLaUrl, coincideConLaBusqueda, cuantosDeCuantos, opcionDeLaUrl } from "@/lib/filtros-en-la-url";
import { exigirSesionRoot } from "@/lib/supervision/root";
import { contarTicketsPendientes, listarTickets } from "@/lib/tickets/consultas";
import { formatearFecha } from "@/lib/usuarios/directorio";
import ListaDeTickets, { type TicketParaPanel } from "./lista";

export const metadata: Metadata = { title: "Tickets de supervisores" };
export const dynamic = "force-dynamic";

const TIPOS = ["sancion", "datos_abiertos"] as const;

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; q?: string; tipo?: string }>;
}) {
  await exigirSesionRoot();
  const params = await searchParams;
  const vista = params.vista === "resueltos" ? "resueltos" : "pendientes";
  const [todos, pendientes] = await Promise.all([listarTickets(vista), contarTicketsPendientes()]);

  const q = busquedaDeLaUrl(params.q);
  const tipo = opcionDeLaUrl(params.tipo, TIPOS);
  const filtrados = todos.filter(
    (t) =>
      (!tipo || t.tipo === tipo) &&
      coincideConLaBusqueda(q, t.supervisor.nombre, t.persona?.nombre, t.campana?.nombre, t.pedido, t.motivo, t.respuesta),
  );
  const paraLista: TicketParaPanel[] = filtrados.map((t) => ({
    ...t,
    fechaTexto: formatearFecha(t.creadoEn),
    resueltoTexto: t.resueltoEn ? formatearFecha(t.resueltoEn) : null,
  }));

  const chip = (activo: boolean) =>
    `inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      activo ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
    }`;

  return (
    <div>
      <Encabezado
        titulo="Tickets de supervisores"
        subtitulo={
          pendientes === 0
            ? "Sin tickets por resolver"
            : `${formatearNumero(pendientes)} ${pendientes === 1 ? "ticket espera" : "tickets esperan"} tu decisión`
        }
      />

      <p className="-mt-3 mb-5 max-w-3xl text-[13px] text-system-600">
        Las suspensiones, los baneos, los avisos que suspenden o banean y las decisiones de datos abiertos que toma un
        supervisor no se aplican hasta que tú los apruebas. Aprobar los aplica tal cual; rechazar no cambia nada y el
        supervisor recibe tu respuesta. Tu decisión es final.
      </p>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Tickets pendientes o resueltos">
        <Link href="/tickets" scroll={false} className={chip(vista === "pendientes")} aria-current={vista === "pendientes" ? "page" : undefined}>
          Pendientes <span className="font-mono text-[11px]">{formatearNumero(pendientes)}</span>
        </Link>
        <Link href="/tickets?vista=resueltos" scroll={false} className={chip(vista === "resueltos")} aria-current={vista === "resueltos" ? "page" : undefined}>
          Resueltos
        </Link>
      </nav>

      {todos.length > 0 && (
        <FiltrosEnLaUrl
          busqueda={{ etiqueta: "Buscar tickets", placeholder: "Buscar por supervisor, persona, campaña o motivo" }}
          listas={[
            {
              clave: "tipo",
              etiqueta: "Filtrar por tipo de ticket",
              todas: "Todos los tipos",
              opciones: [
                { valor: "sancion", etiqueta: "Sanciones" },
                { valor: "datos_abiertos", etiqueta: "Datos abiertos" },
              ],
            },
          ]}
          className="mb-4"
        />
      )}

      {todos.length === 0 ? (
        <Aviso tono="neutro">
          {vista === "pendientes" ? "No hay tickets por resolver." : "Todavía no se ha resuelto ningún ticket."}
        </Aviso>
      ) : paraLista.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">Ningún ticket coincide con los filtros.</p>
      ) : (
        <>
          {paraLista.length < todos.length && (
            <p className="mb-3 text-[12.5px] text-system-500">{cuantosDeCuantos(paraLista.length, todos.length)} tickets</p>
          )}
          <ListaDeTickets tickets={paraLista} />
        </>
      )}
    </div>
  );
}
