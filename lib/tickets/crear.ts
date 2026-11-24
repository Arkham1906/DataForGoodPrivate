// Crear tickets de supervisión (2026-11-24, reglas en lib/tickets/reglas.ts). Lo llaman los caminos donde un
// supervisor toma una acción importante, en vez de aplicarla:
//   - aplicarSancion (lib/moderacion/acciones.ts): Sanciones o la bandeja de reportes, en /supervision;
//   - el rechazo de una campaña con sanción (lib/supervision/decision.ts);
//   - publicar o no los datos abiertos (lib/supervision/datos-abiertos.ts).
// No importa a ninguno de ellos (lib/tickets/resolver.ts sí, para aplicar lo aprobado).

import type { PoolClient } from "pg";

import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import type { SancionPedida } from "@/lib/moderacion/sancionar";
import { sqlReporteVisibleParaSupervisor } from "@/lib/reportes/alcance";
import type { ClaveDeReportes } from "@/lib/reportes/motivos";
import { sqlDeClave } from "@/lib/reportes/reportes";
import { sancionVaComoTicket, type PedidoDeDatos, type PedidoDeSancion } from "@/lib/tickets/reglas";

type Db = Pick<PoolClient, "query">;

/** Avisos vigentes de la cuenta (sin los anulados por apelación): deciden qué haría el siguiente. */
export async function avisosVigentes(db: Db, usuarioId: number): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM sanciones WHERE usuario_id = $1 AND tipo = 'STRIKE' AND anulada_en IS NULL`,
    [usuarioId],
  );
  return rows[0]?.n ?? 0;
}

/** ¿La sanción que pide un supervisor va como ticket? (sancionVaComoTicket con los avisos de hoy). */
export async function requiereTicket(db: Db, usuarioId: number, pedida: SancionPedida): Promise<boolean> {
  if (pedida.tipo !== "STRIKE") return sancionVaComoTicket(pedida.tipo, 0);
  return sancionVaComoTicket("STRIKE", await avisosVigentes(db, usuarioId));
}

/**
 * Guarda el ticket de sanción dentro de la transacción de quien llama. Con `reportes`, los pendientes de esa clave
 * contra la persona quedan ligados al ticket ("en revisión por el SuperUsuario"). Una sanción pendiente por persona.
 */
export async function crearTicketDeSancion(
  client: PoolClient,
  entrada: {
    supervisorId: number;
    usuarioId: number;
    pedida: SancionPedida;
    detalle: string;
    reportes?: { clave: ClaveDeReportes; texto: string };
    rechazo?: PedidoDeSancion["rechazo"];
  },
): Promise<{ ok: true; ticketId: number } | { ok: false; error: string }> {
  // Bloquea a la persona: dos supervisores a la vez no dejan dos tickets.
  await client.query(`SELECT id FROM usuarios WHERE id = $1 FOR UPDATE`, [entrada.usuarioId]);
  const yaHay = await client.query(
    `SELECT 1 FROM tickets WHERE usuario_id = $1 AND tipo = 'sancion' AND estado = 'pendiente'`,
    [entrada.usuarioId],
  );
  if ((yaHay.rowCount ?? 0) > 0) {
    return { ok: false, error: "Ya hay una sanción para esta persona esperando al SuperUsuario." };
  }

  const datos: PedidoDeSancion = {
    tipo: entrada.pedida.tipo,
    avisosAlPedir: await avisosVigentes(client, entrada.usuarioId),
    ...(entrada.pedida.tipo === "SUSPENSION_TEMPORAL" ? { dias: Number(entrada.pedida.dias) } : {}),
    detalle: entrada.detalle,
    ...(entrada.reportes ? { reportes: entrada.reportes.texto } : {}),
    ...(entrada.rechazo ? { rechazo: entrada.rechazo } : {}),
  };
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO tickets (tipo, supervisor_id, usuario_id, campana_id, datos)
     VALUES ('sancion', $1, $2, $3, $4) RETURNING id`,
    [entrada.supervisorId, entrada.usuarioId, entrada.rechazo?.campanaId ?? null, JSON.stringify(datos)],
  );
  const ticketId = rows[0].id;

  if (entrada.reportes) {
    // $1 es el id de la clave (sqlDeClave). Si otro ya los resolvió o ya esperan otro ticket, no se pide dos veces.
    const ligados = await client.query(
      `UPDATE reportes SET ticket_id = $3
        WHERE ${sqlDeClave(entrada.reportes.clave)} AND reportado_id = $2 AND estado = 'pendiente' AND ticket_id IS NULL
          AND EXISTS (SELECT 1 FROM campanas c WHERE c.id = reportes.campana_id AND ${sqlReporteVisibleParaSupervisor("reportes", "c", "$4")})`,
      [entrada.reportes.clave.id, entrada.usuarioId, ticketId, entrada.supervisorId],
    );
    if ((ligados.rowCount ?? 0) === 0) {
      return { ok: false, error: "Esos reportes ya se resolvieron o ya esperan al SuperUsuario." };
    }
  }
  return { ok: true, ticketId };
}

/** Bitácora del ticket nuevo (después del COMMIT de quien lo creó). */
export async function registrarTicketCreado(supervisorId: number, ticketId: number, detalle: Record<string, unknown>): Promise<void> {
  await registrarAuditoria({
    actor: { tipo: "usuario", id: supervisorId },
    accion: "ticket.crear",
    objetivo: { tipo: "ticket", id: ticketId },
    detalle,
  });
}

/** Ticket de datos abiertos: uno pendiente por campaña. null si ya había uno esperando. */
export async function crearTicketDeDatos(entrada: {
  supervisorId: number;
  campanaId: number;
  pedido: PedidoDeDatos;
}): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO tickets (tipo, supervisor_id, campana_id, datos) VALUES ('datos_abiertos', $1, $2, $3)
     ON CONFLICT (campana_id) WHERE tipo = 'datos_abiertos' AND estado = 'pendiente' DO NOTHING
     RETURNING id`,
    [entrada.supervisorId, entrada.campanaId, JSON.stringify(entrada.pedido)],
  );
  const id = rows[0]?.id ?? null;
  if (id) await registrarTicketCreado(entrada.supervisorId, id, { tipo: "datos_abiertos", campana: entrada.campanaId, ...entrada.pedido });
  return id;
}

/** El ticket de datos abiertos que espera para esta campaña (para que el supervisor vea que ya lo pidió). */
export async function ticketDeDatosPendiente(campanaId: number | string): Promise<{ pedido: PedidoDeDatos; creadoEn: Date } | null> {
  const { rows } = await pool.query<{ datos: PedidoDeDatos; creado_en: Date }>(
    `SELECT datos, creado_en FROM tickets WHERE campana_id = $1 AND tipo = 'datos_abiertos' AND estado = 'pendiente' LIMIT 1`,
    [campanaId],
  );
  return rows[0] ? { pedido: rows[0].datos, creadoEn: rows[0].creado_en } : null;
}

/** Condición SQL: la campaña `alias` no tiene un ticket de datos abiertos esperando (para no pedirlo dos veces). */
export function sqlSinTicketDeDatos(alias: string): string {
  return `NOT EXISTS (SELECT 1 FROM tickets tk WHERE tk.campana_id = ${alias}.id AND tk.tipo = 'datos_abiertos' AND tk.estado = 'pendiente')`;
}
