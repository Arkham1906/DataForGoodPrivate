// Dashboard del revisor de aportes (2026-11-13, a pedido del usuario): lo que lleva arriba /revisiones.
// Server-only, solo lectura. Cuenta únicamente las campañas donde la persona es revisora ACEPTADA
// (campana_revisores.estado = 'aceptado'), igual que la lista de /revisiones:
// - Por revisar: aportes 'pendiente' de esas campañas que no han terminado, sin los propios (como GET /api/revisiones),
//   con el más antiguo, y las campañas que más tienen.
// - Tus decisiones: aportes de esas campañas que decidió ella (aportes.first_pass_by_user_id, reviewed_at):
//   aceptados, rechazados, hoy y en 7 días (hora de Tepic), mediana del tiempo de respuesta en 30 días y
//   estrellas que dio (1 a 5; solo los aceptados llevan calificación desde el 2026-11-07).
// - Actividad: sus decisiones por día en los últimos DIAS_DE_ACTIVIDAD días, en hora de Tepic.
// Si una consulta falla devuelve null y la pantalla muestra la lista sin el dashboard.

import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { ESTADOS_TERMINADOS } from "@/lib/campanas/terminada";

export const DIAS_DE_ACTIVIDAD = 14;
/** Campañas con pendientes que se listan (las que más tienen). */
const CAMPANAS_CON_PENDIENTES = 5;

export type CampanaConPendientes = {
  id: string;
  nombre: string;
  pendientes: number;
  /** ISO del pendiente más antiguo. */
  masAntiguo: string;
};

export type DiaDeActividad = {
  /** AAAA-MM-DD en hora de Tepic. */
  dia: string;
  aceptados: number;
  rechazados: number;
};

export type DashboardDelRevisor = {
  campanas: number;
  porRevisar: number;
  /** ISO del pendiente más antiguo de todas sus campañas, o null sin pendientes. */
  pendienteMasAntiguo: string | null;
  conPendientes: CampanaConPendientes[];
  aceptados: number;
  rechazados: number;
  hoy: number;
  semana: number;
  /** Mediana, en segundos, de envío → decisión en los últimos 30 días; null sin decisiones. */
  medianaDeRespuesta: number | null;
  /** Promedio de estrellas que dio a los aceptados; null sin calificaciones. */
  promedioDeEstrellas: number | null;
  /** Cuántos aceptados calificó con 1, 2, 3, 4 y 5 estrellas (índice 0 = 1 estrella). */
  porEstrellas: number[];
  actividad: DiaDeActividad[];
};

export async function obtenerDashboardDelRevisor(usuarioId: number | string): Promise<DashboardDelRevisor | null> {
  const terminados = [...ESTADOS_TERMINADOS];
  try {
    const [campanasR, pendientesR, decisionesR, estrellasR, actividadR] = await Promise.all([
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM campana_revisores WHERE usuario_id = $1 AND estado = 'aceptado'`,
        [usuarioId],
      ),
      pool.query<{ id: number; name: string; pendientes: number; mas_antiguo: Date }>(
        `SELECT c.id, c.name, COUNT(a.id)::int AS pendientes, MIN(a.submitted_at) AS mas_antiguo
           FROM campana_revisores cr
           JOIN campanas c ON c.id = cr.campana_id
           JOIN aportes a ON a.campaign_id = c.id AND a.status = 'pendiente' AND a.user_id IS DISTINCT FROM cr.usuario_id
          WHERE cr.usuario_id = $1 AND cr.estado = 'aceptado' AND NOT (c.status = ANY($2::text[]))
          GROUP BY c.id, c.name
          ORDER BY pendientes DESC, mas_antiguo ASC`,
        [usuarioId, terminados],
      ),
      pool.query<{
        aceptados: number;
        rechazados: number;
        hoy: number;
        semana: number;
        mediana: number | null;
        promedio: number | null;
      }>(
        `SELECT COUNT(*) FILTER (WHERE a.status = 'aceptado')::int AS aceptados,
                COUNT(*) FILTER (WHERE a.status = 'rechazado')::int AS rechazados,
                COUNT(*) FILTER (WHERE (a.reviewed_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date)::int AS hoy,
                COUNT(*) FILTER (WHERE a.reviewed_at >= NOW() - INTERVAL '7 days')::int AS semana,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM a.reviewed_at - a.submitted_at))
                  FILTER (WHERE a.reviewed_at >= NOW() - INTERVAL '30 days') AS mediana,
                AVG(a.calificacion) FILTER (WHERE a.status = 'aceptado' AND a.calificacion IS NOT NULL)::float8 AS promedio
           FROM aportes a
           JOIN campana_revisores cr ON cr.campana_id = a.campaign_id AND cr.usuario_id = $1 AND cr.estado = 'aceptado'
          WHERE a.first_pass_by_user_id = $1 AND a.status IN ('aceptado', 'rechazado') AND a.reviewed_at IS NOT NULL`,
        [usuarioId, ZONA_DE_CAMPANAS],
      ),
      pool.query<{ calificacion: number; total: number }>(
        `SELECT a.calificacion, COUNT(*)::int AS total
           FROM aportes a
           JOIN campana_revisores cr ON cr.campana_id = a.campaign_id AND cr.usuario_id = $1 AND cr.estado = 'aceptado'
          WHERE a.first_pass_by_user_id = $1 AND a.status = 'aceptado' AND a.calificacion BETWEEN 1 AND 5
          GROUP BY a.calificacion`,
        [usuarioId],
      ),
      pool.query<{ dia: string; aceptados: number; rechazados: number }>(
        `WITH dias AS (
           SELECT generate_series((NOW() AT TIME ZONE $2)::date - ($3::int - 1), (NOW() AT TIME ZONE $2)::date, INTERVAL '1 day')::date AS dia
         ),
         decisiones AS (
           SELECT (a.reviewed_at AT TIME ZONE $2)::date AS dia, a.status
             FROM aportes a
             JOIN campana_revisores cr ON cr.campana_id = a.campaign_id AND cr.usuario_id = $1 AND cr.estado = 'aceptado'
            WHERE a.first_pass_by_user_id = $1 AND a.status IN ('aceptado', 'rechazado')
              AND a.reviewed_at >= NOW() - ($3::int + 1) * INTERVAL '1 day'
         )
         SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
                COUNT(x.status) FILTER (WHERE x.status = 'aceptado')::int AS aceptados,
                COUNT(x.status) FILTER (WHERE x.status = 'rechazado')::int AS rechazados
           FROM dias d LEFT JOIN decisiones x ON x.dia = d.dia
          GROUP BY d.dia
          ORDER BY d.dia`,
        [usuarioId, ZONA_DE_CAMPANAS, DIAS_DE_ACTIVIDAD],
      ),
    ]);

    const pendientes = pendientesR.rows;
    const decisiones = decisionesR.rows[0];
    const porEstrellas = [0, 0, 0, 0, 0];
    for (const fila of estrellasR.rows) porEstrellas[Number(fila.calificacion) - 1] = Number(fila.total);
    const antiguos = pendientes.map((p) => new Date(p.mas_antiguo).getTime()).filter((t) => !Number.isNaN(t));

    return {
      campanas: Number(campanasR.rows[0]?.total ?? 0),
      porRevisar: pendientes.reduce((suma, p) => suma + Number(p.pendientes), 0),
      pendienteMasAntiguo: antiguos.length ? new Date(Math.min(...antiguos)).toISOString() : null,
      conPendientes: pendientes.slice(0, CAMPANAS_CON_PENDIENTES).map((p) => ({
        id: String(p.id),
        nombre: String(p.name),
        pendientes: Number(p.pendientes),
        masAntiguo: new Date(p.mas_antiguo).toISOString(),
      })),
      aceptados: Number(decisiones?.aceptados ?? 0),
      rechazados: Number(decisiones?.rechazados ?? 0),
      hoy: Number(decisiones?.hoy ?? 0),
      semana: Number(decisiones?.semana ?? 0),
      medianaDeRespuesta: decisiones?.mediana == null ? null : Number(decisiones.mediana),
      promedioDeEstrellas: decisiones?.promedio == null ? null : Number(decisiones.promedio),
      porEstrellas,
      actividad: actividadR.rows.map((f) => ({
        dia: String(f.dia),
        aceptados: Number(f.aceptados),
        rechazados: Number(f.rechazados),
      })),
    };
  } catch (error) {
    console.error("No se pudo armar el dashboard del revisor", error);
    return null;
  }
}
