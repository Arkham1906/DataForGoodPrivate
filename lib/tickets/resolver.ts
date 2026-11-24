// El SuperUsuario aprueba o rechaza un ticket de supervisión (2026-11-24; reglas en lib/tickets/reglas.ts).
//   - Aprobar una sanción: se aplica tal cual con sancionarEnTransaccion (la escala de avisos cuenta al momento de
//     aprobar), se resuelven los reportes ligados o se deja el reporte del rechazo, y se avisa a la persona. En la
//     bitácora, `sancion.aplicar` queda a nombre del supervisor (así la ve en sus sanciones y la puede restaurar),
//     con el ticket; `ticket.aprobar`, a nombre del SuperUsuario.
//   - Aprobar datos abiertos: decidirDatosAbiertos con `desdeTicket` (avisa al creador y a quienes aportaron).
//   - Rechazar: no pasa nada; los reportes ligados vuelven a la bandeja del supervisor y la campaña sigue pendiente.
// Al supervisor le llega `ticket_aprobado` o `ticket_rechazado`.

import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisarSancion, detalleDeAuditoria, sancionarEnTransaccion, type SancionAplicada } from "@/lib/moderacion/sancionar";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { guardarReporteDeRechazo } from "@/lib/supervision/decision";
import { decidirDatosAbiertos } from "@/lib/supervision/datos-abiertos";
import {
  describirPedidoDeDatos,
  errorDeRespuestaDeTicket,
  type PedidoDeDatos,
  type PedidoDeSancion,
  type TipoDeTicket,
} from "@/lib/tickets/reglas";

export type Resultado = { ok: true } | { ok: false; error: string };

type Ticket = {
  id: number;
  tipo: TipoDeTicket;
  supervisor_id: number | null;
  usuario_id: number | null;
  campana_id: number | null;
  datos: PedidoDeSancion | PedidoDeDatos;
};

const YA_RESUELTO: Resultado = { ok: false, error: "Ese ticket ya se resolvió." };

async function nombreDe(usuarioId: number | null): Promise<string> {
  if (!usuarioId) return "Supervisor";
  const { rows } = await pool.query<{ nombre: string }>(
    `SELECT TRIM(nombre || ' ' || apellidos) AS nombre FROM usuarios WHERE id = $1`,
    [usuarioId],
  );
  return rows[0]?.nombre || "Supervisor";
}

async function avisarAlSupervisor(t: Ticket, aprobado: boolean, que: string, respuesta?: string): Promise<void> {
  if (!t.supervisor_id) return;
  await notificar({
    usuarioId: t.supervisor_id,
    tipo: aprobado ? "ticket_aprobado" : "ticket_rechazado",
    titulo: aprobado ? "El SuperUsuario aprobó tu ticket" : "El SuperUsuario no aprobó tu ticket",
    mensaje: aprobado
      ? `Se aplicó: ${que}.`
      : `No se aplicó: ${que}. Respuesta: ${respuesta?.replace(/[.\s]+$/, "")}.`,
    enlace: t.tipo === "datos_abiertos" && t.campana_id ? `/supervision/${t.campana_id}` : "/supervision/sanciones",
    ...(t.campana_id ? { campanaId: t.campana_id } : {}),
    metadata: { ticket: t.id },
  });
}

async function aprobarSancion(t: Ticket): Promise<Resultado> {
  const pedido = t.datos as PedidoDeSancion;
  const usuarioId = Number(t.usuario_id);
  if (!usuarioId) return { ok: false, error: "La cuenta ya no existe: rechaza el ticket." };
  const firma = `Supervisor: ${await nombreDe(t.supervisor_id)} (aprobó el SuperUsuario)`.slice(0, 120);
  let sancion: SancionAplicada;
  let reportes: number[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const vigente = await client.query(`SELECT 1 FROM tickets WHERE id = $1 AND estado = 'pendiente' FOR UPDATE`, [t.id]);
    if (vigente.rowCount === 0) {
      await client.query("ROLLBACK");
      return YA_RESUELTO;
    }
    const r = await sancionarEnTransaccion(client, {
      usuarioId,
      pedida: { tipo: pedido.tipo, dias: pedido.dias },
      detalle: pedido.detalle,
      firma,
    });
    if (!r.ok) {
      await client.query("ROLLBACK");
      return { ok: false, error: `No se pudo aplicar: ${r.error} Puedes rechazar el ticket.` };
    }
    sancion = r.sancion;
    const resueltos = await client.query<{ id: number }>(
      `UPDATE reportes SET estado = 'sancionado', sancion_id = $2, nota_de_resolucion = $3, resuelto_en = NOW()
        WHERE ticket_id = $1 AND estado = 'pendiente' RETURNING id`,
      [t.id, sancion.sancionId, pedido.detalle],
    );
    reportes = resueltos.rows.map((row) => row.id);
    if (pedido.rechazo) {
      await guardarReporteDeRechazo(client, {
        campanaId: pedido.rechazo.campanaId,
        creadorId: usuarioId,
        supervisorId: t.supervisor_id,
        porRoot: false,
        lista: pedido.rechazo.lista,
        explicacion: pedido.rechazo.explicacion,
        motivo: pedido.rechazo.motivo,
        sancionId: sancion.sancionId,
      });
    }
    await client.query(
      `UPDATE tickets SET estado = 'aprobado', resuelto_en = NOW(), resultado = $2 WHERE id = $1`,
      [t.id, JSON.stringify({ sancionId: sancion.sancionId })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error aprobando el ticket de sanción", error);
    return { ok: false, error: "No se pudo aprobar el ticket." };
  } finally {
    client.release();
  }

  // A nombre del supervisor: así la ve en sus sanciones (sqlSancionDelSupervisor) y la puede restaurar.
  await registrarAuditoria({
    actor: t.supervisor_id ? { tipo: "usuario", id: t.supervisor_id } : { tipo: "superusuario" },
    accion: "sancion.aplicar",
    objetivo: { tipo: "usuario", id: usuarioId },
    detalle: {
      ...detalleDeAuditoria(sancion, pedido.detalle),
      ticket: t.id,
      aprobadaPorSuperUsuario: true,
      ...(reportes.length > 0 ? { reportes, clave: pedido.reportes } : {}),
      ...(pedido.rechazo ? { campana: pedido.rechazo.campanaId, origen: "rechazo" } : {}),
    },
  });
  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: "ticket.aprobar",
    objetivo: { tipo: "ticket", id: t.id },
    detalle: { tipo: "sancion", usuario: usuarioId, sancionId: sancion.sancionId },
  });
  await avisarSancion(usuarioId, sancion, pedido.detalle);
  await avisarAlSupervisor(t, true, "la sanción que pediste");
  return { ok: true };
}

async function aprobarDatos(t: Ticket): Promise<Resultado> {
  const pedido = t.datos as PedidoDeDatos;
  // Se toma primero: dos clics a la vez no lo aplican dos veces.
  const tomado = await pool.query(
    `UPDATE tickets SET estado = 'aprobado', resuelto_en = NOW() WHERE id = $1 AND estado = 'pendiente'`,
    [t.id],
  );
  if (tomado.rowCount === 0) return YA_RESUELTO;
  const r = await decidirDatosAbiertos(
    Number(t.campana_id),
    pedido.decision,
    pedido.motivo,
    t.supervisor_id ? { tipo: "usuario", usuarioId: t.supervisor_id } : { tipo: "root" },
    { desdeTicket: true },
  );
  if (!r.ok) {
    await pool.query(`UPDATE tickets SET estado = 'pendiente', resuelto_en = NULL WHERE id = $1`, [t.id]);
    return { ok: false, error: `No se pudo aplicar: ${r.error}. Puedes rechazar el ticket.` };
  }
  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: "ticket.aprobar",
    objetivo: { tipo: "ticket", id: t.id },
    detalle: { tipo: "datos_abiertos", campana: t.campana_id, decision: pedido.decision },
  });
  await avisarAlSupervisor(t, true, describirPedidoDeDatos(pedido).toLowerCase());
  return { ok: true };
}

export async function resolverTicket(ticketId: number, aprobar: boolean, respuestaEntrada: string): Promise<Resultado> {
  if (!Number.isInteger(ticketId) || ticketId <= 0) return { ok: false, error: "Ticket inválido." };
  const { rows } = await pool.query<Ticket>(
    `SELECT id, tipo, supervisor_id, usuario_id, campana_id, datos FROM tickets WHERE id = $1 AND estado = 'pendiente'`,
    [ticketId],
  );
  const t = rows[0];
  if (!t) return YA_RESUELTO;

  if (aprobar) return t.tipo === "sancion" ? aprobarSancion(t) : aprobarDatos(t);

  const respuesta = String(respuestaEntrada ?? "").trim();
  const error = errorDeRespuestaDeTicket(respuesta);
  if (error) return { ok: false, error };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rechazado = await client.query(
      `UPDATE tickets SET estado = 'rechazado', respuesta = $2, resuelto_en = NOW() WHERE id = $1 AND estado = 'pendiente'`,
      [t.id, respuesta],
    );
    if (rechazado.rowCount === 0) {
      await client.query("ROLLBACK");
      return YA_RESUELTO;
    }
    // Los reportes vuelven a la bandeja del supervisor.
    await client.query(`UPDATE reportes SET ticket_id = NULL WHERE ticket_id = $1 AND estado = 'pendiente'`, [t.id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error rechazando el ticket", e);
    return { ok: false, error: "No se pudo rechazar el ticket." };
  } finally {
    client.release();
  }
  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: "ticket.rechazar",
    objetivo: { tipo: "ticket", id: t.id },
    detalle: { tipo: t.tipo, respuesta },
  });
  await avisarAlSupervisor(
    t,
    false,
    t.tipo === "sancion" ? "la sanción que pediste" : describirPedidoDeDatos(t.datos as PedidoDeDatos).toLowerCase(),
    respuesta,
  );
  return { ok: true };
}
