// Aplicar una sanción a una cuenta, en un solo lugar (2026-10-16). Lo usan aplicarSancion
// (lib/moderacion/acciones.ts: /sanciones y la bandeja de reportes) y el rechazo de una campaña con
// sanción (lib/supervision/decision.ts). Tres tipos:
//   - STRIKE (aviso): sigue la escala de lib/usuarios/escala-de-avisos.ts según cuántos lleve la cuenta
//     (mensaje, suspensión de 2 días, de 7 días y, al cuarto, baneo + lista negra);
//   - SUSPENSION_TEMPORAL: suspensión directa de DIAS_DE_SUSPENSION días;
//   - BANEO_DE_CAMPANA: baneo inmediato para casos graves, con lista negra.
// sancionarEnTransaccion escribe dentro de la transacción de quien llama; avisarSancion notifica
// a la persona después del COMMIT y detalleDeAuditoria arma el detalle de `sancion.aplicar`.

import type { PoolClient } from "pg";

import { notificar } from "@/lib/notificaciones/notificaciones";
import { TIPOS_DE_SANCION } from "@/lib/sanciones";
import type { TipoDeSancion } from "@/lib/usuarios/directorio";
import {
  AVISOS_PARA_BANEO,
  DIAS_DE_SUSPENSION,
  consecuenciaDelAviso,
  describirConsecuencia,
  type ConsecuenciaDeAviso,
} from "@/lib/usuarios/escala-de-avisos";
import { agregarAListaNegra } from "@/lib/usuarios/lista-negra";

/** Lo que pide quien modera. `dias` solo con SUSPENSION_TEMPORAL. */
export type SancionPedida = { tipo: TipoDeSancion; dias?: number };

/** Lo que quedó escrito, para la bitácora y el aviso a la persona. */
export type SancionAplicada = {
  /** La fila principal: el aviso, la suspensión o el baneo. */
  sancionId: number;
  tipo: TipoDeSancion;
  aviso: { id: number; numero: number } | null;
  consecuencia: ConsecuenciaDeAviso | null;
  /** La sanción que bloquea (suspensión o baneo), si la hubo. */
  bloqueo: { id: number; tipo: "SUSPENSION_TEMPORAL" | "BANEO_DE_CAMPANA"; dias: number | null } | null;
};

/** Mínimo del motivo de una sanción: es lo que la persona lee en el aviso y en /cuenta-bloqueada. */
export const MINIMO_DETALLE_DE_SANCION = 20;

/** Valida lo pedido (también si llega de una server action o de la API con cualquier dato). */
export function errorDeSancionPedida(pedida: SancionPedida, detalle: string): string | null {
  if (!TIPOS_DE_SANCION.has(pedida.tipo)) return "Tipo de sanción inválido.";
  if (pedida.tipo === "SUSPENSION_TEMPORAL" && !(DIAS_DE_SUSPENSION as readonly number[]).includes(Number(pedida.dias))) {
    return `La suspensión dura ${DIAS_DE_SUSPENSION.join(" o ")} días.`;
  }
  if (detalle.trim().length < MINIMO_DETALLE_DE_SANCION) {
    return `El motivo debe tener al menos ${MINIMO_DETALLE_DE_SANCION} caracteres.`;
  }
  return null;
}

/**
 * Escribe la sanción con `client` dentro de la transacción de quien llama (que hace BEGIN/COMMIT).
 * Bloquea la fila del usuario (FOR UPDATE) para que dos avisos a la vez cuenten bien su número.
 * Suspensión y baneo no cierran sesiones: getSessionUser deja de aceptarlas y la persona ve
 * /cuenta-bloqueada con el motivo.
 */
export async function sancionarEnTransaccion(
  client: PoolClient,
  entrada: { usuarioId: number; pedida: SancionPedida; detalle: string; firma: string },
): Promise<{ ok: true; sancion: SancionAplicada } | { ok: false; error: string }> {
  const { usuarioId, pedida, firma } = entrada;
  const detalle = entrada.detalle.trim();
  const error = errorDeSancionPedida(pedida, detalle);
  if (error) return { ok: false, error };

  const usuario = await client.query(`SELECT id FROM usuarios WHERE id = $1 FOR UPDATE`, [usuarioId]);
  if (usuario.rowCount === 0) return { ok: false, error: "El usuario no existe." };

  const { rows: previos } = await client.query<{ avisos: number; baneo_id: number | null }>(
    `SELECT COUNT(*) FILTER (WHERE tipo = 'STRIKE')::int AS avisos,
            MAX(id) FILTER (WHERE activa AND tipo = 'BANEO_DE_CAMPANA') AS baneo_id
     FROM sanciones WHERE usuario_id = $1`,
    [usuarioId],
  );
  const baneoVigente = previos[0].baneo_id;

  if (pedida.tipo === "STRIKE") {
    const numero = previos[0].avisos + 1;
    const consecuencia = consecuenciaDelAviso(numero);
    const insertado = await client.query<{ id: number }>(
      `INSERT INTO sanciones (usuario_id, tipo, detalle, aplicada_por) VALUES ($1, 'STRIKE', $2, $3) RETURNING id`,
      [usuarioId, detalle, firma],
    );
    const aviso = { id: insertado.rows[0].id, numero };
    let bloqueo: SancionAplicada["bloqueo"] = null;

    // La consecuencia es su propia sanción (la que bloquea y se puede restaurar); su detalle es lo
    // que la persona ve en /cuenta-bloqueada.
    const motivoDelBloqueo = `Aviso ${numero} de ${AVISOS_PARA_BANEO}. ${detalle}`;
    if (consecuencia.tipo === "suspension") {
      const s = await client.query<{ id: number }>(
        `INSERT INTO sanciones (usuario_id, tipo, detalle, dias, aplicada_por)
         VALUES ($1, 'SUSPENSION_TEMPORAL', $2, $3, 'Automático') RETURNING id`,
        [usuarioId, motivoDelBloqueo, consecuencia.dias],
      );
      bloqueo = { id: s.rows[0].id, tipo: "SUSPENSION_TEMPORAL", dias: consecuencia.dias };
    } else if (consecuencia.tipo === "baneo") {
      if (baneoVigente) {
        bloqueo = { id: baneoVigente, tipo: "BANEO_DE_CAMPANA", dias: null };
      } else {
        const b = await client.query<{ id: number }>(
          `INSERT INTO sanciones (usuario_id, tipo, detalle, aplicada_por)
           VALUES ($1, 'BANEO_DE_CAMPANA', $2, 'Automático') RETURNING id`,
          [usuarioId, motivoDelBloqueo],
        );
        bloqueo = { id: b.rows[0].id, tipo: "BANEO_DE_CAMPANA", dias: null };
      }
      await agregarAListaNegra(client, { usuarioId, sancionId: bloqueo.id, motivo: motivoDelBloqueo });
    }
    return { ok: true, sancion: { sancionId: aviso.id, tipo: "STRIKE", aviso, consecuencia, bloqueo } };
  }

  // Suspensión o baneo directos: con un baneo vigente no tienen sentido.
  if (baneoVigente) return { ok: false, error: "La cuenta ya está baneada." };

  if (pedida.tipo === "SUSPENSION_TEMPORAL") {
    const dias = Number(pedida.dias);
    const s = await client.query<{ id: number }>(
      `INSERT INTO sanciones (usuario_id, tipo, detalle, dias, aplicada_por)
       VALUES ($1, 'SUSPENSION_TEMPORAL', $2, $3, $4) RETURNING id`,
      [usuarioId, detalle, dias, firma],
    );
    const id = s.rows[0].id;
    return {
      ok: true,
      sancion: { sancionId: id, tipo: "SUSPENSION_TEMPORAL", aviso: null, consecuencia: null, bloqueo: { id, tipo: "SUSPENSION_TEMPORAL", dias } },
    };
  }

  const b = await client.query<{ id: number }>(
    `INSERT INTO sanciones (usuario_id, tipo, detalle, aplicada_por) VALUES ($1, 'BANEO_DE_CAMPANA', $2, $3) RETURNING id`,
    [usuarioId, detalle, firma],
  );
  const id = b.rows[0].id;
  await agregarAListaNegra(client, { usuarioId, sancionId: id, motivo: detalle });
  return {
    ok: true,
    sancion: { sancionId: id, tipo: "BANEO_DE_CAMPANA", aviso: null, consecuencia: null, bloqueo: { id, tipo: "BANEO_DE_CAMPANA", dias: null } },
  };
}

/** Detalle de `sancion.aplicar` en audit_log. */
export function detalleDeAuditoria(s: SancionAplicada, motivo: string): Record<string, unknown> {
  return {
    tipo: s.aviso ? "AVISO" : s.tipo === "SUSPENSION_TEMPORAL" ? "SUSPENSION" : "BANEO",
    ...(s.aviso ? { avisoId: s.aviso.id, aviso: s.aviso.numero } : {}),
    ...(s.bloqueo ? { bloqueo: { sancionId: s.bloqueo.id, tipo: s.bloqueo.tipo, dias: s.bloqueo.dias } } : {}),
    listaNegra: s.bloqueo?.tipo === "BANEO_DE_CAMPANA",
    motivo,
  };
}

/**
 * Avisa a la persona (después del COMMIT). Con suspensión o baneo no puede entrar: lo verá al
 * recuperar el acceso; mientras, /cuenta-bloqueada ya le muestra el motivo.
 */
export async function avisarSancion(usuarioId: number, s: SancionAplicada, motivo: string): Promise<void> {
  const { aviso, consecuencia, bloqueo } = s;
  const restantes = aviso ? AVISOS_PARA_BANEO - aviso.numero : 0;
  const titulo = aviso
    ? consecuencia?.tipo === "suspension"
      ? `Tu cuenta se suspendió ${consecuencia.dias} días`
      : consecuencia?.tipo === "baneo"
        ? "Tu cuenta fue baneada"
        : "Tu cuenta lleva un reporte"
    : s.tipo === "SUSPENSION_TEMPORAL"
      ? `Tu cuenta se suspendió ${bloqueo?.dias} días`
      : "Tu cuenta fue baneada";

  await notificar({
    usuarioId,
    tipo: "sancion_aplicada",
    titulo,
    mensaje: `Motivo: ${motivo}${
      aviso
        ? ` Es tu aviso ${aviso.numero} de ${AVISOS_PARA_BANEO}.${
            restantes > 0 ? ` El siguiente: ${describirConsecuencia(consecuenciaDelAviso(aviso.numero + 1))}.` : ""
          }`
        : ""
    }`,
    metadata: {
      sancionId: aviso?.id ?? bloqueo?.id,
      tipo: aviso ? "AVISO" : s.tipo,
      ...(aviso ? { aviso: aviso.numero } : {}),
      ...(bloqueo?.dias ? { dias: bloqueo.dias } : {}),
    },
  });
}
