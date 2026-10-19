import { pool } from "@/lib/db";

/*
 * Qué hace cada sanción (según el formulario de sanción de la moderación, .../sanciones/[usuarioId] en /supervisar o /supervision):
 *   - STRIKE: un aviso (en la interfaz, "Aviso"). No bloquea por sí mismo: según cuántos lleve la
 *     cuenta, aplicarSancion agrega la suspensión o el baneo que toca (lib/usuarios/escala-de-avisos.ts).
 *   - SUSPENSION_TEMPORAL: bloquea la cuenta durante `dias` desde aplicada_en.
 *   - BANEO_DE_CAMPANA ("Baneo inmediato" en el formulario, "Baneo" en las listas): bloquea la
 *     cuenta hasta que el SuperUsuario la restaure y pone su correo en la lista negra.
 * Una cuenta bloqueada sí puede iniciar sesión y conserva sus sesiones, pero
 * getSessionUser devuelve null: ninguna ruta ni acción la deja pasar.
 * exigirUsuario() la manda a /cuenta-bloqueada, donde ve el motivo
 * (obtenerBloqueoDeLaSesion en lib/session.ts).
 */

/**
 * Lo que quien modera aplica a mano (lib/moderacion/sancionar.ts): un aviso (STRIKE), que sigue la escala
 * de avisos, una suspensión directa de 2 o 7 días (2026-10-16, a pedido del usuario; DIAS_DE_SUSPENSION)
 * o un baneo inmediato.
 */
export const TIPOS_DE_SANCION: ReadonlySet<string> = new Set(["STRIKE", "SUSPENSION_TEMPORAL", "BANEO_DE_CAMPANA"]);

/**
 * Condición SQL: hay una sanción vigente que bloquea a `usuarios u`. Es la
 * misma regla que usa el directorio para marcar SUSPENDIDA/BANEADA.
 */
export const SQL_SANCION_BLOQUEANTE = `
  EXISTS (
    SELECT 1 FROM sanciones s
    WHERE s.usuario_id = u.id AND s.activa
      AND (
        s.tipo = 'BANEO_DE_CAMPANA'
        OR (s.tipo = 'SUSPENSION_TEMPORAL'
            AND s.aplicada_en + (COALESCE(s.dias, 0) || ' days')::interval > NOW())
      )
  )
`;

/** `motivo` es el detalle que escribió el SuperUsuario al aplicar la sanción. */
export type Bloqueo = { motivo: string } & ({ permanente: true } | { permanente: false; hasta: Date });

/** Sanción que bloquea hoy a la cuenta, o null si puede entrar. */
export async function obtenerBloqueo(usuarioId: number): Promise<Bloqueo | null> {
  const result = await pool.query<{ tipo: string; detalle: string; hasta: Date | null }>(
    `SELECT s.tipo, s.detalle,
            CASE WHEN s.tipo = 'SUSPENSION_TEMPORAL'
                 THEN s.aplicada_en + (COALESCE(s.dias, 0) || ' days')::interval
            END AS hasta
     FROM sanciones s
     WHERE s.usuario_id = $1 AND s.activa
       AND (
         s.tipo = 'BANEO_DE_CAMPANA'
         OR (s.tipo = 'SUSPENSION_TEMPORAL'
             AND s.aplicada_en + (COALESCE(s.dias, 0) || ' days')::interval > NOW())
       )
     -- El baneo manda sobre cualquier suspensión; entre suspensiones, la más larga.
     ORDER BY (s.tipo = 'BANEO_DE_CAMPANA') DESC, hasta DESC NULLS FIRST
     LIMIT 1`,
    [usuarioId]
  );

  if (result.rowCount === 0) return null;
  const fila = result.rows[0];
  const motivo = fila.detalle ?? "";
  return fila.tipo === "BANEO_DE_CAMPANA" || !fila.hasta
    ? { motivo, permanente: true }
    : { motivo, permanente: false, hasta: new Date(fila.hasta) };
}

/** Fin de una suspensión, para la pantalla de cuenta bloqueada: "3 de octubre de 2026, 11:54 a.m.". */
export function formatearFinDeSuspension(hasta: Date): string {
  return hasta.toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    // Misma zona que el resto del panel (Tepic, Nayarit).
    timeZone: "America/Mazatlan",
  });
}

export type HistorialDeSanciones = {
  total: number;
  baneos: number;
  suspensiones: number;
  strikes: number;
};

/**
 * Cuántas sanciones ha recibido la cuenta desde siempre, incluidas las ya
 * restauradas o vencidas y los baneos automáticos por strikes. Lo muestra
 * la pantalla de cuenta bloqueada.
 */
export async function contarSanciones(usuarioId: number): Promise<HistorialDeSanciones> {
  const result = await pool.query<HistorialDeSanciones>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE tipo = 'BANEO_DE_CAMPANA')::int AS baneos,
            COUNT(*) FILTER (WHERE tipo = 'SUSPENSION_TEMPORAL')::int AS suspensiones,
            COUNT(*) FILTER (WHERE tipo = 'STRIKE')::int AS strikes
     FROM sanciones
     WHERE usuario_id = $1`,
    [usuarioId]
  );
  return result.rows[0] ?? { total: 0, baneos: 0, suspensiones: 0, strikes: 0 };
}
