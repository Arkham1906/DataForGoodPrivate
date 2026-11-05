// Publicar o no los datos abiertos de una campaña terminada (2026-11-04, a pedido del usuario). Decide
// quien la supervisa (PATCH /api/campanas/[id] { action: "publicar_datos" | "no_publicar_datos", motivo })
// o el SuperUsuario sobre cualquiera (lib/supervision/acciones-root.ts), según los aportes que juntó.
// La decisión no se cambia; solo se vuelve a tomar si la campaña se reactiva y termina otra vez.
// Tabla campana_datos_abiertos; lectura y texto en lib/campanas/datos-abiertos.ts.

import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { MAXIMO_MOTIVO_DE_DATOS_ABIERTOS } from "@/lib/campanas/datos-abiertos";
import { ESTADOS_TERMINADOS, estaTerminada } from "@/lib/campanas/terminada";
import { notificar } from "@/lib/notificaciones/notificaciones";
import type { AutorDeDecision } from "@/lib/supervision/decision";

export type DecisionDeDatosAbiertos = "publicar_datos" | "no_publicar_datos";

export const DECISIONES_DE_DATOS_ABIERTOS = new Set<string>(["publicar_datos", "no_publicar_datos"]);

export type ResultadoDeDatosAbiertos =
  | { ok: true; mensaje: string }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

/**
 * Deja pendientes las campañas que terminaron y le avisa a su supervisor. Es la única forma de cubrir
 * todos los caminos para terminar (fecha, creador, supervisión, baja). La corre la tarea de cada minuto:
 * la fila evita repetir el aviso, aunque la persona limpie sus notificaciones.
 */
export async function marcarDatosPorDecidir(): Promise<void> {
  const { rows } = await pool.query<{
    id: number;
    name: string;
    creator_id: number | null;
    supervisor_id: number | null;
    goal_contributions: number;
    aprobados: number;
  }>(
    `WITH nuevas AS (
       INSERT INTO campana_datos_abiertos (campana_id)
       SELECT c.id FROM campanas c
       WHERE c.status = ANY($1::text[])
         AND NOT EXISTS (SELECT 1 FROM campana_datos_abiertos d WHERE d.campana_id = c.id)
       ON CONFLICT (campana_id) DO NOTHING
       RETURNING campana_id
     )
     SELECT c.id, c.name, c.creator_id, c.supervisor_id, c.goal_contributions,
            (SELECT COUNT(*)::int FROM aportes a WHERE a.campaign_id = c.id AND a.status = 'aceptado') AS aprobados
     FROM campanas c JOIN nuevas n ON n.campana_id = c.id`,
    [[...ESTADOS_TERMINADOS]],
  );
  for (const campana of rows) {
    if (!campana.supervisor_id || campana.supervisor_id === campana.creator_id) continue;
    await notificar({
      usuarioId: campana.supervisor_id,
      tipo: "datos_por_decidir",
      titulo: "Decide si se publican sus datos abiertos",
      mensaje: `"${campana.name}" terminó con ${campana.aprobados} de ${campana.goal_contributions} aportes aprobados. Revisa si sus datos se publican.`,
      campanaId: campana.id,
      enlace: `/supervision/${campana.id}`,
    });
  }
}

export async function decidirDatosAbiertos(
  campanaId: string | number,
  decision: DecisionDeDatosAbiertos,
  motivoEntrada: unknown,
  autor: AutorDeDecision,
): Promise<ResultadoDeDatosAbiertos> {
  const existente = await pool.query<{
    status: string;
    name: string;
    creator_id: number | null;
    supervisor_id: number | null;
    aprobados: number;
  }>(
    `SELECT c.status, c.name, c.creator_id, c.supervisor_id,
            (SELECT COUNT(*)::int FROM aportes a WHERE a.campaign_id = c.id AND a.status = 'aceptado') AS aprobados
     FROM campanas c WHERE c.id = $1 LIMIT 1`,
    [campanaId],
  );
  if (existente.rowCount === 0) return { ok: false, status: 404, error: "Campaña no encontrada" };
  const campana = existente.rows[0];

  // El supervisor, solo la que supervisa (y nunca una suya). El SuperUsuario, cualquiera.
  if (autor.tipo === "usuario") {
    if (Number(campana.creator_id) === autor.usuarioId) {
      return { ok: false, status: 403, error: "No puedes supervisar una campaña que creaste" };
    }
    if (campana.supervisor_id == null || Number(campana.supervisor_id) !== autor.usuarioId) {
      return { ok: false, status: 403, error: "Solo quien supervisa esta campaña puede decidir sobre sus datos abiertos" };
    }
  }
  if (!estaTerminada(campana.status)) {
    return { ok: false, status: 400, error: "Solo se decide sobre los datos abiertos de una campaña terminada" };
  }

  const publica = decision === "publicar_datos";
  const motivo = String(motivoEntrada ?? "").trim();
  if (publica && campana.aprobados === 0) {
    return { ok: false, status: 400, error: "La campaña no tiene aportes aprobados que publicar" };
  }
  if (!publica && !motivo) return { ok: false, status: 400, error: "Escribe por qué no se publican los datos" };
  if (motivo.length > MAXIMO_MOTIVO_DE_DATOS_ABIERTOS) {
    return { ok: false, status: 400, error: `El motivo admite hasta ${MAXIMO_MOTIVO_DE_DATOS_ABIERTOS} caracteres` };
  }

  // Solo si sigue pendiente: dos personas a la vez no pueden decidir distinto.
  const guardada = await pool.query(
    `INSERT INTO campana_datos_abiertos (campana_id, estado, motivo, decidido_por, por_superusuario, decidido_en)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (campana_id) DO UPDATE
       SET estado = EXCLUDED.estado, motivo = EXCLUDED.motivo, decidido_por = EXCLUDED.decidido_por,
           por_superusuario = EXCLUDED.por_superusuario, decidido_en = EXCLUDED.decidido_en
       WHERE campana_datos_abiertos.estado = 'pendiente'`,
    [
      campanaId,
      publica ? "publicada" : "no_publicada",
      publica ? null : motivo,
      autor.tipo === "usuario" ? autor.usuarioId : null,
      autor.tipo === "root",
    ],
  );
  if (guardada.rowCount === 0) {
    return { ok: false, status: 409, error: "Ya se decidió sobre los datos abiertos de esta campaña" };
  }

  await registrarAuditoria({
    actor: autor.tipo === "root" ? { tipo: "superusuario" } : { tipo: "usuario", id: autor.usuarioId },
    accion: publica ? "supervision.publicar_datos" : "supervision.no_publicar_datos",
    objetivo: { tipo: "campana", id: campanaId },
    detalle: { motivo: motivo || null, aportesAprobados: campana.aprobados },
  });

  if (campana.creator_id) {
    await notificar({
      usuarioId: campana.creator_id,
      campanaId,
      enlace: "/mis-campanas",
      metadata: motivo ? { motivo } : {},
      ...(publica
        ? {
            tipo: "datos_publicados" as const,
            titulo: "Se publicaron tus datos abiertos",
            mensaje: `La supervisión publicó los datos de "${campana.name}" en Datos abiertos.`,
          }
        : {
            tipo: "datos_no_publicados" as const,
            titulo: "Tus datos no se publicaron",
            mensaje: `La supervisión decidió no publicar los datos de "${campana.name}". Motivo: ${motivo}`,
          }),
    });
  }

  return { ok: true, mensaje: publica ? "Datos publicados" : "Decisión registrada: los datos no se publican" };
}
