// Datos de la pantalla /inicio del usuario común (2026-10-24, a pedido del usuario): resumen de sus aportes y
// campañas, campañas para él y actividad reciente. Solo lectura y solo de la persona con sesión.

import { pool } from "@/lib/db";
import { listarNotificaciones } from "@/lib/notificaciones/notificaciones";
import type { Notificacion } from "@/lib/notificaciones/tipos";

/** Cuántas campañas recomendadas y cuántos aportes recientes se muestran. */
export const CAMPANAS_PARA_TI = 3;
export const APORTES_RECIENTES = 5;
export const NOTIFICACIONES_RECIENTES = 3;

export type CampanaParaTi = {
  id: string;
  nombre: string;
  tematica: string;
  aprobados: number;
  meta: number;
  participantes: number;
  /** Por qué se recomienda: su temática está en los intereses, es de su estado, o solo es popular. */
  motivo: "interes" | "estado" | "popular";
};

export type AporteReciente = {
  id: string;
  campanaId: string;
  campana: string;
  descripcion: string;
  /** pendiente, espera_final, aceptado o rechazado. */
  estado: string;
  /** ISO con "Z" (submitted_at es TIMESTAMP en UTC). */
  enviadoEn: string;
};

export type ResumenDeInicio = {
  aportes: { total: number; aceptados: number; enRevision: number; rechazados: number };
  campanas: { total: number; activas: number; enRevision: number; borradores: number };
  paraTi: CampanaParaTi[];
  recientes: AporteReciente[];
  notificaciones: Notificacion[];
  notificacionesSinLeer: number;
};

const VACIO: ResumenDeInicio = {
  aportes: { total: 0, aceptados: 0, enRevision: 0, rechazados: 0 },
  campanas: { total: 0, activas: 0, enRevision: 0, borradores: 0 },
  paraTi: [],
  recientes: [],
  notificaciones: [],
  notificacionesSinLeer: 0,
};

/**
 * "Campañas para ti" (2026-10-24 en /inicio; desde el 2026-10-27 también en /campanas, vía
 * GET /api/campanas?paraTi=true): activas de otros, sin las que lo banearon. Primero las de sus
 * intereses, luego las de su estado (o para todo el país) y, si no hay de esas, las más concurridas.
 */
export async function campanasParaTi(
  usuario: { id: number | string; state: string | null; intereses: string[] },
  limite = CAMPANAS_PARA_TI,
): Promise<CampanaParaTi[]> {
  const intereses = usuario.intereses.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const estado = usuario.state?.trim() ?? "";
  const r = await pool.query(
    `SELECT c.id, c.name, COALESCE(NULLIF(c.tematica, ''), c.tag) AS tematica, c.approved_contributions,
            c.goal_contributions, c.participants,
            CASE WHEN lower(COALESCE(NULLIF(c.tematica, ''), c.tag)) = ANY($2::text[]) THEN 'interes'
                 WHEN $3 <> '' AND (c.todo_el_pais OR c.location_state = $3) THEN 'estado'
                 ELSE 'popular' END AS motivo
     FROM campanas c
     WHERE c.status = 'activa' AND c.creator_id <> $1
       AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = c.id AND b.usuario_id = $1)
     ORDER BY CASE WHEN lower(COALESCE(NULLIF(c.tematica, ''), c.tag)) = ANY($2::text[]) THEN 0
                   WHEN $3 <> '' AND (c.todo_el_pais OR c.location_state = $3) THEN 1
                   ELSE 2 END,
              c.participants DESC, c.created_at DESC
     LIMIT $4`,
    [usuario.id, intereses, estado, limite]
  );
  return r.rows.map((f) => ({
    id: String(f.id),
    nombre: String(f.name ?? ""),
    tematica: String(f.tematica ?? ""),
    aprobados: Number(f.approved_contributions ?? 0),
    meta: Number(f.goal_contributions ?? 0),
    participantes: Number(f.participants ?? 0),
    motivo: f.motivo === "interes" || f.motivo === "estado" ? f.motivo : "popular",
  }));
}

export async function obtenerResumenDeInicio(usuario: {
  id: number | string;
  state: string | null;
  intereses: string[];
}): Promise<ResumenDeInicio> {
  try {
    const [aportes, campanas, paraTi, recientes, notificaciones] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'aceptado')::int AS aceptados,
                COUNT(*) FILTER (WHERE status IN ('pendiente', 'espera_final'))::int AS en_revision,
                COUNT(*) FILTER (WHERE status = 'rechazado')::int AS rechazados
         FROM aportes WHERE user_id = $1`,
        [usuario.id]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'activa')::int AS activas,
                COUNT(*) FILTER (WHERE status = 'en_revision')::int AS en_revision,
                COUNT(*) FILTER (WHERE status = 'borrador')::int AS borradores
         FROM campanas WHERE creator_id = $1`,
        [usuario.id]
      ),
      campanasParaTi(usuario),
      pool.query(
        `SELECT a.id, a.campaign_id, c.name AS campana, a.description, a.status,
                to_char(a.submitted_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS enviado_en
         FROM aportes a JOIN campanas c ON c.id = a.campaign_id
         WHERE a.user_id = $1
         ORDER BY a.submitted_at DESC, a.id DESC
         LIMIT $2`,
        [usuario.id, APORTES_RECIENTES]
      ),
      listarNotificaciones(usuario.id, { porPagina: NOTIFICACIONES_RECIENTES, filtro: "no-leidas" }),
    ]);

    const a = aportes.rows[0] ?? {};
    const c = campanas.rows[0] ?? {};
    return {
      aportes: {
        total: Number(a.total ?? 0),
        aceptados: Number(a.aceptados ?? 0),
        enRevision: Number(a.en_revision ?? 0),
        rechazados: Number(a.rechazados ?? 0),
      },
      campanas: {
        total: Number(c.total ?? 0),
        activas: Number(c.activas ?? 0),
        enRevision: Number(c.en_revision ?? 0),
        borradores: Number(c.borradores ?? 0),
      },
      paraTi,
      recientes: recientes.rows.map((r) => ({
        id: String(r.id),
        campanaId: String(r.campaign_id),
        campana: String(r.campana ?? ""),
        descripcion: String(r.description ?? ""),
        estado: String(r.status ?? ""),
        enviadoEn: String(r.enviado_en ?? ""),
      })),
      notificaciones: notificaciones.data,
      notificacionesSinLeer: notificaciones.noLeidas,
    };
  } catch (error) {
    console.error("Error armando el resumen de /inicio", error);
    return VACIO;
  }
}
