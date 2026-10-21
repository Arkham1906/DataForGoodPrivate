// Reglas de servidor compartidas por los dos caminos para enviar un aporte: con cuenta
// (POST /api/aportes) y sin cuenta desde un enlace público (POST /api/c/[token]/aportes,
// lib/campanas/aportes-anonimos.ts). Una regla, un lugar. Lo que también usa el
// navegador (tipos y tamaño de archivo) está en ./archivo.ts.

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { borrarArchivo, guardarArchivo, type SavedUpload } from "@/lib/minio";
import { limpiarArchivo } from "@/lib/aportes/limpiar-archivo";
import { TAMANO_MAXIMO as TAMANO_MAXIMO_DE_ARCHIVO, archivoEsOpcional, type TipoDeArchivo } from "@/lib/aportes/archivo";
import { avisarAportesRecibidos } from "@/lib/notificaciones/hitos-de-aportes";

export { LARGO_MAXIMO_DESCRIPCION, TAMANO_MAXIMO, errorDeArchivo, tiposAceptados } from "@/lib/aportes/archivo";

/**
 * El cuerpo declarado pasa del archivo más grande permitido más 1 MB de formulario. Se mira
 * antes de leer el formulario: lo que pasa de proxyClientMaxBodySize (next.config.ts) llega
 * cortado y daría un 500 en vez de un 413.
 */
export function cuerpoDemasiadoGrande(request: Request): boolean {
  return Number(request.headers.get("content-length") ?? 0) > TAMANO_MAXIMO_DE_ARCHIVO + 1_000_000;
}

export const MENSAJE_CUERPO_GRANDE = "El archivo es demasiado grande para subirlo.";

/** Lo que se guarda en las columnas file_* de `aportes`. Sin archivo: texto, con file_path ''. */
export type ArchivoDelAporte = { tipo: TipoDeArchivo; guardado: SavedUpload | null };

/**
 * Comprueba por su contenido que el archivo sea de un tipo que acepta la campaña, le quita
 * los metadatos que se pueden quitar (lib/aportes/limpiar-archivo.ts) y lo guarda en MinIO.
 * Sin archivo, solo si la campaña acepta texto: el aporte es la descripción.
 * Devuelve un error para la persona si no sirve.
 */
export async function guardarArchivoDelAporte(
  archivo: FormDataEntryValue | null,
  campaignId: string | number,
  tipos: TipoDeArchivo[]
): Promise<{ ok: true; archivo: ArchivoDelAporte } | { ok: false; error: string }> {
  if (!(archivo instanceof File) || archivo.size === 0) {
    return archivoEsOpcional(tipos)
      ? { ok: true, archivo: { tipo: "texto", guardado: null } }
      : { ok: false, error: "El archivo es obligatorio" };
  }
  const limpio = await limpiarArchivo(archivo, tipos);
  if (!limpio.ok) return limpio;
  const guardado = await guardarArchivo(limpio.archivo.contenido, {
    subdir: `campanas/${campaignId}`,
    extension: limpio.archivo.extension,
    mimeType: limpio.archivo.mimeType,
  });
  return { ok: true, archivo: { tipo: limpio.archivo.tipo, guardado } };
}

/**
 * Inserta un aporte respetando la cuota por persona SIN carrera: dos envíos simultáneos
 * de la misma persona (cuenta o dispositivo) se forman en fila con un candado de
 * Postgres por campaña y persona, y el segundo vuelve a contar ya con el primero dentro.
 * Dentro de la misma transacción suma el aporte a los contadores de la campaña.
 *
 * `comprobar` (opcional) corre dentro del mismo candado, antes de contar: si devuelve un
 * motivo, no se inserta (lo usa la espera entre aportes anónimos).
 *
 * `cuotaDelTipo` (opcional): si la campaña reparte la cuota por tipo de dato
 * (lib/campanas/cuota-por-tipo.ts), el límite del tipo de este aporte; también se cuenta
 * dentro del candado.
 *
 * Si no se inserta, borra de MinIO el archivo que se acababa de subir.
 */
export async function insertarAporteConCuota<T>(entrada: {
  campaignId: string | number;
  /** Identifica a la persona dentro de la campaña: `usuario:<id>` o `dispositivo:<hash>`. */
  persona: string;
  cuota: number;
  /** Cuántos aportes tiene ya esta persona en la campaña. */
  contar: (client: PoolClient) => Promise<number>;
  insertar: (client: PoolClient) => Promise<T>;
  comprobar?: (client: PoolClient) => Promise<{ error: string; esperaSegundos: number } | null>;
  cuotaDelTipo?: { limite: number; contar: (client: PoolClient) => Promise<number> };
  /** Clave en MinIO del archivo ya subido, para borrarlo si no se inserta (null: aporte sin archivo). */
  archivoSubido: string | null;
}): Promise<
  | { ok: true; fila: T; yaEnviados: number }
  | { ok: false; motivo: "cuota" }
  | { ok: false; motivo: "cuota_tipo"; limite: number }
  | { ok: false; motivo: "espera"; error: string; esperaSegundos: number }
> {
  const client = await pool.connect();
  let insertado = false;
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
      `aporte:${entrada.campaignId}:${entrada.persona}`,
    ]);
    const rechazo = entrada.comprobar ? await entrada.comprobar(client) : null;
    if (rechazo) {
      await client.query("ROLLBACK");
      return { ok: false, motivo: "espera", ...rechazo };
    }
    const yaEnviados = await entrada.contar(client);
    if (yaEnviados >= entrada.cuota) {
      await client.query("ROLLBACK");
      return { ok: false, motivo: "cuota" };
    }
    if (entrada.cuotaDelTipo && (await entrada.cuotaDelTipo.contar(client)) >= entrada.cuotaDelTipo.limite) {
      await client.query("ROLLBACK");
      return { ok: false, motivo: "cuota_tipo", limite: entrada.cuotaDelTipo.limite };
    }
    const fila = await entrada.insertar(client);
    await recalcularContadores(entrada.campaignId, client);
    // Total con la campaña bloqueada (recalcularContadores la bloqueó): para el aviso de cada 10 aportes.
    const { rows } = await client.query<{ total: number }>(
      `SELECT current_contributions AS total FROM campanas WHERE id = $1`,
      [entrada.campaignId],
    );
    await client.query("COMMIT");
    insertado = true;
    void avisarAportesRecibidos(entrada.campaignId, Number(rows[0]?.total ?? 0));
    return { ok: true, fila, yaEnviados };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    if (!insertado && entrada.archivoSubido) {
      await borrarArchivo(entrada.archivoSubido).catch((error) => {
        console.error("No se pudo borrar el archivo de un aporte que no se guardó", error);
      });
    }
  }
}

/**
 * Recalcula desde la tabla `aportes` los contadores desnormalizados de la campaña
 * (total, pendientes, aceptados, rechazados y participantes). Se usa después de cualquier
 * cambio: enviar, revisar o borrar un aporte. Antes se sumaba y restaba según el estado
 * anterior, y un cambio de decisión (aceptado → rechazado) dejaba los números mal.
 *
 * Participante = una cuenta, un correo o un dispositivo anónimo distinto.
 * Bloquea la fila de la campaña primero: dos transacciones simultáneas se forman y la
 * segunda cuenta ya con lo que guardó la primera.
 */
export async function recalcularContadores(
  campaignId: string | number,
  client: Pick<PoolClient, "query"> = pool
): Promise<void> {
  await client.query(`SELECT 1 FROM campanas WHERE id = $1 FOR NO KEY UPDATE`, [campaignId]);
  await client.query(
    `UPDATE campanas c SET
      current_contributions = a.total,
      pending_contributions = a.pendientes,
      approved_contributions = a.aceptados,
      rejected_contributions = a.rechazados,
      participants = a.participantes,
      updated_at = NOW()
    FROM (
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status IN ('pendiente', 'espera_final'))::int AS pendientes,
             COUNT(*) FILTER (WHERE status = 'aceptado')::int AS aceptados,
             COUNT(*) FILTER (WHERE status = 'rechazado')::int AS rechazados,
             COUNT(DISTINCT COALESCE(user_id::text, participant_email, anonimo_id))::int AS participantes
      FROM aportes WHERE campaign_id = $1
    ) a
    WHERE c.id = $1`,
    [campaignId]
  );
}
