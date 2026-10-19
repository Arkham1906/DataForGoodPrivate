// Notificaciones de los usuarios: crearlas (notificar) y leerlas o marcarlas (bandeja).
// Las crean los eventos de aportes, campañas, roles y sanciones; las leen GET /api/notificaciones,
// la campana (components/layout/NotificationsBell) y la página /notificaciones. Cada una se manda
// también como push a los teléfonos o navegadores donde la persona activó los avisos (push.ts)
// y en vivo a sus pestañas abiertas (lib/en-vivo.ts → GET /api/eventos).

import { pool } from "@/lib/db";
import { DIAS_PARA_NOTIFICACION_VIEJA, type Notificacion, type PaginaDeNotificaciones, type TipoDeNotificacion } from "./tipos";
import { enviarPush } from "./push";
import { publicarAviso } from "@/lib/en-vivo";

/** Avisos que se apagan con la preferencia "Aportes" (usuarios.avisos_aportes). */
const TIPOS_DE_APORTES: ReadonlySet<TipoDeNotificacion> = new Set(["aporte_aceptado", "aporte_rechazado"]);

/**
 * Las que llegan aunque la persona apague "Notificaciones" (usuarios.notificaciones_activas, 2026-10-19):
 * cambian lo que puede hacer en su cuenta, y la invitación de revisor solo se acepta desde la notificación.
 */
export const NOTIFICACIONES_ESENCIALES: ReadonlySet<TipoDeNotificacion> = new Set([
  "rol_asignado",
  "rol_revocado",
  "sancion_aplicada",
  "sancion_restaurada",
  "campana_baneo",
  "campana_desbaneo",
  "invitacion_revisor",
]);

export type NuevaNotificacion = {
  usuarioId: number | string;
  tipo: TipoDeNotificacion;
  titulo: string;
  mensaje: string;
  campanaId?: number | string | null;
  /** Ruta de la app (sin basePath) a la que lleva al abrirla. */
  enlace?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Guarda una notificación y la manda como push. Nunca lanza: avisar es secundario y no debe
 * tumbar la acción que la originó (que para entonces ya se completó). Llámala después del
 * COMMIT, no dentro de la transacción. El push no se espera: sale en segundo plano.
 */
export async function notificar(n: NuevaNotificacion): Promise<void> {
  try {
    // Preferencias de /cuenta: "Notificaciones" apagado no deja pasar nada salvo las esenciales;
    // "Aportes" apagado, no se avisa del estado de sus aportes.
    if (!NOTIFICACIONES_ESENCIALES.has(n.tipo)) {
      const { rows } = await pool.query<{ todas: boolean; aportes: boolean }>(
        `SELECT notificaciones_activas AS todas, avisos_aportes AS aportes FROM usuarios WHERE id = $1`,
        [n.usuarioId],
      );
      if (rows[0] && !rows[0].todas) return;
      if (rows[0] && TIPOS_DE_APORTES.has(n.tipo) && !rows[0].aportes) return;
    }
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, campana_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [
        n.usuarioId,
        n.tipo,
        n.titulo.slice(0, 180),
        n.mensaje,
        n.campanaId ?? null,
        JSON.stringify({ ...(n.metadata ?? {}), ...(n.enlace ? { enlace: n.enlace } : {}) }),
      ],
    );
    publicarAviso(n.usuarioId, { tipo: n.tipo });
    void enviarPush(n.usuarioId, { id: String(rows[0].id), titulo: n.titulo, mensaje: n.mensaje, enlace: n.enlace });
  } catch (error) {
    console.error(`Error creando la notificación ${n.tipo} para el usuario ${n.usuarioId}`, error);
  }
}

export type FiltroDeNotificaciones = "todas" | "no-leidas";

/**
 * Las que borra "Limpiar" (alias `n`; `dias` es el parámetro con DIAS_PARA_NOTIFICACION_VIEJA):
 * leídas o más viejas que esos días, salvo una invitación de revisor sin aceptar (es el único
 * lugar desde donde se acepta, como en borrarNotificacion).
 */
function condicionLimpiable(dias: string): string {
  return `(n.leida_en IS NOT NULL OR n.created_at < NOW() - make_interval(days => ${dias}::int))
    AND NOT (n.tipo = 'invitacion_revisor' AND EXISTS (
      SELECT 1 FROM campana_revisores cr
      WHERE cr.campana_id = n.campana_id AND cr.usuario_id = n.usuario_id AND cr.estado = 'invitado'))`;
}

/** Página de notificaciones de un usuario, de la más nueva a la más vieja. */
export async function listarNotificaciones(
  usuarioId: number | string,
  { pagina = 1, porPagina = 20, filtro = "todas" }: { pagina?: number; porPagina?: number; filtro?: FiltroDeNotificaciones } = {},
): Promise<PaginaDeNotificaciones> {
  const soloNoLeidas = filtro === "no-leidas";
  const [filas, conteo] = await Promise.all([
    pool.query(
      `SELECT n.id, n.tipo, n.titulo, n.mensaje, n.campana_id, n.metadata, n.leida_en, n.created_at,
              c.name AS campana_nombre, cr.estado AS invitacion_estado
       FROM notificaciones n
       LEFT JOIN campanas c ON c.id = n.campana_id
       LEFT JOIN campana_revisores cr
         ON n.tipo = 'invitacion_revisor' AND cr.campana_id = n.campana_id AND cr.usuario_id = n.usuario_id
       WHERE n.usuario_id = $1 AND ($2::boolean IS FALSE OR n.leida_en IS NULL)
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT $3 OFFSET $4`,
      [usuarioId, soloNoLeidas, porPagina, (pagina - 1) * porPagina],
    ),
    pool.query<{ total: number; no_leidas: number; limpiables: number }>(
      `SELECT COUNT(*) FILTER (WHERE $2::boolean IS FALSE OR n.leida_en IS NULL)::int AS total,
              COUNT(*) FILTER (WHERE n.leida_en IS NULL)::int AS no_leidas,
              COUNT(*) FILTER (WHERE ${condicionLimpiable("$3")})::int AS limpiables
       FROM notificaciones n WHERE n.usuario_id = $1`,
      [usuarioId, soloNoLeidas, DIAS_PARA_NOTIFICACION_VIEJA],
    ),
  ]);

  return {
    data: filas.rows.map(mapearNotificacion),
    noLeidas: conteo.rows[0].no_leidas,
    limpiables: conteo.rows[0].limpiables,
    total: conteo.rows[0].total,
    pagina,
    porPagina,
  };
}

function mapearNotificacion(row: Record<string, unknown>): Notificacion {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    type: String(row.tipo),
    title: String(row.titulo),
    message: String(row.mensaje),
    campaignId: row.campana_id != null ? String(row.campana_id) : null,
    campaignName: row.campana_nombre ? String(row.campana_nombre) : null,
    href: typeof metadata.enlace === "string" && metadata.enlace.startsWith("/") ? metadata.enlace : null,
    invitationPending: row.tipo === "invitacion_revisor" && row.invitacion_estado === "invitado",
    readAt: row.leida_en ? new Date(String(row.leida_en)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

/** Marca una notificación como leída o no leída. false si no existe o no es de esa persona. */
export async function marcarNotificacion(id: number | string, usuarioId: number | string, leida: boolean): Promise<boolean> {
  const result = await pool.query(
    `UPDATE notificaciones SET leida_en = CASE WHEN $3 THEN COALESCE(leida_en, NOW()) ELSE NULL END
     WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId, leida],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Marca como leídas todas las notificaciones de la persona. Devuelve cuántas cambiaron. */
export async function marcarTodasComoLeidas(usuarioId: number | string): Promise<number> {
  const result = await pool.query(
    `UPDATE notificaciones SET leida_en = NOW() WHERE usuario_id = $1 AND leida_en IS NULL`,
    [usuarioId],
  );
  return result.rowCount ?? 0;
}

/**
 * Borra una notificación de la persona. Una invitación de revisor sin aceptar no se borra:
 * es el único lugar desde donde se acepta.
 */
export async function borrarNotificacion(
  id: number | string,
  usuarioId: number | string,
): Promise<"borrada" | "no-existe" | "invitacion-pendiente"> {
  const result = await pool.query(
    `DELETE FROM notificaciones n
     WHERE n.id = $1 AND n.usuario_id = $2
       AND NOT (n.tipo = 'invitacion_revisor' AND EXISTS (
         SELECT 1 FROM campana_revisores cr
         WHERE cr.campana_id = n.campana_id AND cr.usuario_id = n.usuario_id AND cr.estado = 'invitado'))`,
    [id, usuarioId],
  );
  if ((result.rowCount ?? 0) > 0) return "borrada";
  const existe = await pool.query(`SELECT 1 FROM notificaciones WHERE id = $1 AND usuario_id = $2`, [id, usuarioId]);
  return existe.rowCount ? "invitacion-pendiente" : "no-existe";
}

/** "Limpiar" de /notificaciones: borra las leídas y las viejas de la persona (condicionLimpiable). Devuelve cuántas borró. */
export async function limpiarNotificaciones(usuarioId: number | string): Promise<number> {
  const result = await pool.query(
    `DELETE FROM notificaciones n WHERE n.usuario_id = $1 AND ${condicionLimpiable("$2")}`,
    [usuarioId, DIAS_PARA_NOTIFICACION_VIEJA],
  );
  return result.rowCount ?? 0;
}
