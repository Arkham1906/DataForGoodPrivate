// Lectura de los tickets de supervisión (2026-11-24): la bandeja /tickets del SuperUsuario, "Tus tickets" del
// supervisor en /supervision/sanciones y los pendientes del panel (lib/pendientes/del-panel.ts).

import { pool } from "@/lib/db";
import {
  describirPedidoDeDatos,
  describirSancionPedida,
  type EstadoDeTicket,
  type PedidoDeDatos,
  type PedidoDeSancion,
  type TipoDeTicket,
} from "@/lib/tickets/reglas";

export type TicketParaLista = {
  id: string;
  tipo: TipoDeTicket;
  estado: EstadoDeTicket;
  /** Quién lo pidió ("Cuenta eliminada" si ya no existe). */
  supervisor: { id: string | null; nombre: string };
  /** La persona a sancionar (tickets de sanción). */
  persona: { id: string; nombre: string } | null;
  campana: { id: string; nombre: string } | null;
  /** "Suspensión de 7 días", "Aviso 2: suspensión de 2 días", "Publicar sus datos en Datos abiertos". */
  pedido: string;
  /** El motivo que leerá la persona (sanción) o por qué no se publican (datos). */
  motivo: string | null;
  /** De dónde salió la sanción. */
  origen: "sanciones" | "reportes" | "rechazo" | null;
  /** Reportes ligados que se resolverán al aprobar. */
  reportes: number;
  creadoEn: Date;
  resueltoEn: Date | null;
  respuesta: string | null;
};

type Fila = {
  id: number;
  tipo: TipoDeTicket;
  estado: EstadoDeTicket;
  supervisor_id: number | null;
  supervisor: string | null;
  usuario_id: number | null;
  persona: string | null;
  campana_id: number | null;
  campana: string | null;
  datos: PedidoDeSancion | PedidoDeDatos;
  creado_en: Date;
  resuelto_en: Date | null;
  respuesta: string | null;
  avisos: number;
  reportes: number;
};

const CONSULTA = `
  SELECT t.id, t.tipo, t.estado, t.supervisor_id, NULLIF(TRIM(su.nombre || ' ' || su.apellidos), '') AS supervisor,
         t.usuario_id, NULLIF(TRIM(u.nombre || ' ' || u.apellidos), '') AS persona,
         t.campana_id, c.name AS campana, t.datos, t.creado_en, t.resuelto_en, t.respuesta,
         (SELECT COUNT(*)::int FROM sanciones s WHERE s.usuario_id = t.usuario_id AND s.tipo = 'STRIKE' AND s.anulada_en IS NULL) AS avisos,
         (SELECT COUNT(*)::int FROM reportes r WHERE r.ticket_id = t.id) AS reportes
    FROM tickets t
    LEFT JOIN usuarios su ON su.id = t.supervisor_id
    LEFT JOIN usuarios u ON u.id = t.usuario_id
    LEFT JOIN campanas c ON c.id = t.campana_id`;

function aTicket(f: Fila): TicketParaLista {
  const esSancion = f.tipo === "sancion";
  const sancion = f.datos as PedidoDeSancion;
  const datos = f.datos as PedidoDeDatos;
  return {
    id: String(f.id),
    tipo: f.tipo,
    estado: f.estado,
    supervisor: { id: f.supervisor_id ? String(f.supervisor_id) : null, nombre: f.supervisor ?? "Cuenta eliminada" },
    persona: f.usuario_id ? { id: String(f.usuario_id), nombre: f.persona ?? "Sin nombre" } : null,
    campana: f.campana_id ? { id: String(f.campana_id), nombre: f.campana ?? "Campaña" } : null,
    // Una sanción pendiente se describe con los avisos de hoy; una resuelta, con lo que pidió.
    pedido: esSancion
      ? describirSancionPedida(sancion, f.estado === "pendiente" ? f.avisos : (sancion.avisosAlPedir ?? f.avisos))
      : describirPedidoDeDatos(datos),
    motivo: esSancion ? sancion.detalle : datos.motivo,
    origen: esSancion ? (sancion.rechazo ? "rechazo" : sancion.reportes ? "reportes" : "sanciones") : null,
    reportes: f.reportes,
    creadoEn: f.creado_en,
    resueltoEn: f.resuelto_en,
    respuesta: f.respuesta,
  };
}

/** Pendientes (los más viejos primero: llevan más esperando) o resueltos (los 300 más recientes). */
export async function listarTickets(vista: "pendientes" | "resueltos"): Promise<TicketParaLista[]> {
  const { rows } = await pool.query<Fila>(
    vista === "pendientes"
      ? `${CONSULTA} WHERE t.estado = 'pendiente' ORDER BY t.creado_en ASC, t.id ASC`
      : `${CONSULTA} WHERE t.estado <> 'pendiente' ORDER BY t.resuelto_en DESC, t.id DESC LIMIT 300`,
  );
  return rows.map(aTicket);
}

/** Los de un supervisor: pendientes y los resueltos en los últimos 30 días. */
export async function ticketsDelSupervisor(supervisorId: number): Promise<TicketParaLista[]> {
  const { rows } = await pool.query<Fila>(
    `${CONSULTA} WHERE t.supervisor_id = $1 AND (t.estado = 'pendiente' OR t.resuelto_en > NOW() - INTERVAL '30 days')
      ORDER BY (t.estado = 'pendiente') DESC, COALESCE(t.resuelto_en, t.creado_en) DESC LIMIT 50`,
    [supervisorId],
  );
  return rows.map(aTicket);
}

export async function contarTicketsPendientes(): Promise<number> {
  try {
    const { rows } = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM tickets WHERE estado = 'pendiente'`);
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
