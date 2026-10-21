// Aviso al creador de cuántos aportes lleva su campaña (2026-10-19, a pedido del usuario): cada
// APORTES_POR_AVISO aportes recibidos (10, 20, 30...) le llega `aportes_recibidos` con el total.
// Para que el número "se vaya sumando" sin llenar la campana, cada aviso nuevo reemplaza al anterior
// de esa campaña: el creador ve uno solo, con el total al día. Cuentan todos los aportes recibidos
// (pendientes, aceptados y rechazados), con cuenta o sin ella.
// Lo llama insertarAporteConCuota (lib/aportes/comun.ts) después del COMMIT, con el total que leyó con
// la campaña bloqueada: dos envíos simultáneos no ven el mismo número. Nunca lanza.

import { pool } from "@/lib/db";
import { notificar } from "./notificaciones";

export const APORTES_POR_AVISO = 10;

export async function avisarAportesRecibidos(campanaId: number | string, total: number): Promise<void> {
  if (total <= 0 || total % APORTES_POR_AVISO !== 0) return;
  try {
    const { rows } = await pool.query<{ creator_id: number; name: string; pendientes: number; ultimo: number | null }>(
      `SELECT c.creator_id, c.name, c.pending_contributions AS pendientes,
              (SELECT MAX((n.metadata->>'total')::int) FROM notificaciones n
               WHERE n.usuario_id = c.creator_id AND n.campana_id = c.id AND n.tipo = 'aportes_recibidos') AS ultimo
       FROM campanas c WHERE c.id = $1`,
      [campanaId],
    );
    const campana = rows[0];
    if (!campana) return;
    // Si se borraron aportes y se vuelve a llegar a un número ya avisado, no se repite.
    if (campana.ultimo !== null && total <= campana.ultimo) return;

    await pool.query(
      `DELETE FROM notificaciones WHERE usuario_id = $1 AND campana_id = $2 AND tipo = 'aportes_recibidos'`,
      [campana.creator_id, campanaId],
    );
    const pendientes = Number(campana.pendientes ?? 0);
    await notificar({
      usuarioId: campana.creator_id,
      tipo: "aportes_recibidos",
      titulo: `Tu campaña ya lleva ${total} aportes`,
      mensaje:
        `"${campana.name}" ya recibió ${total} aportes.` +
        (pendientes > 0 ? ` Tienes ${pendientes} ${pendientes === 1 ? "pendiente" : "pendientes"} por revisar.` : ""),
      campanaId,
      enlace: `/mis-campanas/${campanaId}/aportes`,
      metadata: { total },
    });
  } catch (error) {
    console.error(`Error avisando los aportes recibidos de la campaña ${campanaId}`, error);
  }
}
