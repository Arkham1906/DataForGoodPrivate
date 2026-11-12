// Eliminar una campaña (DELETE /api/campanas/[id]). Desde el 2026-10-27 el creador podía borrarla solo sin
// aportes; desde el 2026-10-31 (a pedido del usuario) también con aportes, con estas decisiones del usuario:
// - Con aportes, en cualquier estado menos finalizada.
// Desde el 2026-11-01 (decisiones del usuario) se puede borrar si está en borrador, si no tiene aportes o si
// todos sus aportes siguen en revisión (pendiente o espera_final; ninguno aprobado ni rechazado), y nunca una
// finalizada, aunque no tenga aportes. La regla vive en sqlPuedeEliminar (lista y servidor usan la misma).
// - Hay que escribir el nombre de la campaña para confirmar, tenga aportes o no (la pantalla y el servidor lo revisan).
// - Quienes aportaron con cuenta reciben `campana_eliminada` (sin enlace: la campaña ya no existe).
// Se borran la campaña y, en cascada, sus aportes (con sus filas de `archivos`, por el trigger), respuestas,
// inscripciones, enlaces, revisores...; los reportes y sanciones se quedan con aporte_id NULL. Los archivos de
// MinIO se borran después del COMMIT (si falla uno, solo queda huérfano en el bucket y se registra).

import { pool } from "@/lib/db";
import { borrarArchivo } from "@/lib/minio";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";

export type ResultadoDeEliminar =
  | { ok: true; aportes: number }
  | { ok: false; status: 400 | 404 | 409; error: string };

/** Aportes que ya se revisaron: con uno solo, la campaña no se borra (salvo en borrador). */
const ESTADOS_REVISADOS = "'aceptado', 'rechazado'";

/** Condición SQL de "el creador puede eliminar esta campaña" (alias de la tabla campanas). */
export function sqlPuedeEliminar(alias = "c"): string {
  return `(${alias}.status <> 'finalizada' AND (${alias}.status = 'borrador' OR NOT EXISTS (
            SELECT 1 FROM aportes a_e WHERE a_e.campaign_id = ${alias}.id AND a_e.status IN (${ESTADOS_REVISADOS}))))`;
}

const clave = (t: string) => t.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

export async function eliminarCampana(entrada: {
  campanaId: string;
  usuarioId: number;
  /** El nombre que escribió para confirmar (obligatorio si la campaña tiene aportes). */
  confirmacion: unknown;
}): Promise<ResultadoDeEliminar> {
  const client = await pool.connect();
  let aportes = 0;
  let nombre = "";
  let participantes: number[] = [];
  let rutas: string[] = [];
  let bannerRuta = "";
  let estado = "";
  try {
    await client.query("BEGIN");
    const campana = await client.query<{ status: string; name: string; banner_path: string | null; puede: boolean }>(
      `SELECT c.status, c.name, c.banner_path, ${sqlPuedeEliminar("c")} AS puede FROM campanas c WHERE c.id = $1 AND c.creator_id = $2 FOR UPDATE`,
      [entrada.campanaId, entrada.usuarioId],
    );
    if (campana.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, status: 404, error: "Campaña no encontrada" };
    }
    ({ status: estado, name: nombre } = campana.rows[0]);
    bannerRuta = campana.rows[0].banner_path ?? "";

    const datos = await client.query<{ aportes: number; participantes: number[] | null; rutas: string[] | null }>(
      `SELECT COUNT(*)::int AS aportes,
              array_agg(DISTINCT a.user_id) FILTER (WHERE a.user_id IS NOT NULL AND a.user_id <> $2) AS participantes,
              array_agg(ar.ruta) FILTER (WHERE ar.ruta IS NOT NULL AND ar.ruta <> '' AND ar.borrado_en IS NULL) AS rutas
         FROM aportes a LEFT JOIN archivos ar ON ar.id = a.archivo_id
        WHERE a.campaign_id = $1`,
      [entrada.campanaId, entrada.usuarioId],
    );
    aportes = Number(datos.rows[0]?.aportes ?? 0);
    participantes = (datos.rows[0]?.participantes ?? []).map(Number);
    rutas = datos.rows[0]?.rutas ?? [];

    if (!campana.rows[0].puede) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        status: 409,
        error:
          estado === "finalizada"
            ? "Esta campaña ya finalizó: no se puede eliminar."
            : "Esta campaña ya tiene aportes aprobados o rechazados: no se puede eliminar.",
      };
    }
    // El nombre se pide siempre, tenga aportes o no (2026-10-31, a pedido del usuario).
    if (typeof entrada.confirmacion !== "string" || clave(entrada.confirmacion) !== clave(nombre)) {
      await client.query("ROLLBACK");
      return { ok: false, status: 400, error: "Escribe el nombre de la campaña para confirmar que quieres eliminarla." };
    }

    await client.query(`DELETE FROM campanas WHERE id = $1 AND creator_id = $2`, [entrada.campanaId, entrada.usuarioId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  // Después del COMMIT: archivos, avisos y bitácora. Ninguno deshace el borrado si falla.
  let archivosSinBorrar = 0;
  const rutasParaBorrar = bannerRuta ? [...rutas, bannerRuta] : rutas;
  for (const ruta of rutasParaBorrar) {
    await borrarArchivo(ruta).catch(() => {
      archivosSinBorrar += 1;
    });
  }
  if (archivosSinBorrar > 0) {
    console.error(`Campaña ${entrada.campanaId} eliminada: ${archivosSinBorrar} archivos no se pudieron borrar de MinIO`);
  }
  for (const usuarioId of participantes) {
    await notificar({
      usuarioId,
      tipo: "campana_eliminada",
      titulo: "Se eliminó una campaña en la que aportaste",
      mensaje: `Quien organizaba «${nombre}» la eliminó. Tus aportes en ella se borraron.`,
    });
  }
  await registrarAuditoria({
    actor: { tipo: "usuario", id: entrada.usuarioId },
    accion: "campana.eliminar",
    objetivo: { tipo: "campana", id: entrada.campanaId },
    detalle: { estado, nombre, aportes, archivos: rutasParaBorrar.length, archivosSinBorrar, avisados: participantes.length },
  });
  return { ok: true, aportes };
}
