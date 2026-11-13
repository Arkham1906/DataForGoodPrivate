// Reglas de servidor compartidas por los dos caminos para enviar un aporte: con cuenta
// (POST /api/aportes) y sin cuenta desde un enlace público (POST /api/c/[token]/aportes,
// lib/campanas/aportes-anonimos.ts). Una regla, un lugar. Lo que también usa el
// navegador (tipos y tamaño de archivo) está en ./archivo.ts.

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { borrarArchivo, guardarArchivo, type SavedUpload } from "@/lib/minio";
import { limpiarArchivo } from "@/lib/aportes/limpiar-archivo";
import {
  LARGO_MAXIMO_TEXTO_DEL_APORTE,
  LARGO_MAXIMO_TITULO_DEL_TEXTO,
  TAMANO_MAXIMO as TAMANO_MAXIMO_DE_ARCHIVO,
  archivoEsOpcional,
  documentoPermitido,
  textoDeExtensiones,
  tipoPorNombre,
  type FormatoDeDocumento,
  type TipoDeArchivo,
} from "@/lib/aportes/archivo";
import { avisarAportesRecibidos } from "@/lib/notificaciones/hitos-de-aportes";
import { actualizarEnviados } from "@/lib/campanas/tipos-de-campana";
import {
  mensajeDeTipoLleno,
  tiposConLugar,
  type EnviadosPorTipo,
  type LimitePorTipo,
} from "@/lib/campanas/limite-por-tipo";
import {
  mapaPorTipo,
  mensajeDeCuotaDelTipo,
  tiposDentroDeSuCuota,
  type CuotaPorTipo,
  type MiosPorTipo,
} from "@/lib/campanas/cuota-por-tipo";

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

/**
 * Aporte de solo texto (2026-11-11, a pedido del usuario). Sin archivo y en una campaña que acepta
 * texto, la persona escribe un título (va en `description`) y el texto en su propio campo; aquí el
 * texto se vuelve un .txt, que sigue el mismo camino que uno subido (limpieza, MinIO, límites por
 * tipo, vista previa, ZIP de datos abiertos). Con archivo, el texto se ignora. Devuelve el archivo a
 * usar o el error para la persona.
 */
export function archivoDelTexto(
  archivo: FormDataEntryValue | null,
  entrada: { texto: string; titulo: string; tipos: TipoDeArchivo[] },
): { ok: true; archivo: FormDataEntryValue | null } | { ok: false; error: string } {
  if (archivo instanceof File && archivo.size > 0) return { ok: true, archivo };
  if (!archivoEsOpcional(entrada.tipos)) return { ok: true, archivo };
  const texto = entrada.texto.replace(/\r\n?/g, "\n").replace(/^\s*\n|\s+$/g, "");
  if (!texto.trim()) return { ok: false, error: "Escribe el texto de tu aporte." };
  if (texto.length > LARGO_MAXIMO_TEXTO_DEL_APORTE) {
    return { ok: false, error: `El texto no puede superar ${LARGO_MAXIMO_TEXTO_DEL_APORTE.toLocaleString("es-MX")} caracteres.` };
  }
  if (entrada.titulo.length > LARGO_MAXIMO_TITULO_DEL_TEXTO) {
    return { ok: false, error: `El título del texto no puede superar ${LARGO_MAXIMO_TITULO_DEL_TEXTO} caracteres.` };
  }
  return { ok: true, archivo: new File([texto], "texto.txt", { type: "text/plain" }) };
}

/**
 * Aviso rápido del límite por tipo de dato (2026-10-28), antes de subir nada: con el tipo que dice
 * el nombre del archivo (o "texto" sin archivo). Devuelve los tipos que aún reciben aportes, para
 * guardarArchivoDelAporte; la comprobación que cuenta va en insertarAporteConCuota.
 */
export function tiposConLugarParaElAporte(
  archivo: FormDataEntryValue | null,
  tipos: TipoDeArchivo[],
  limite: LimitePorTipo,
  enviados: EnviadosPorTipo,
): { ok: true; tipos: TipoDeArchivo[] } | { ok: false; error: string } {
  const conLugar = tiposConLugar(tipos, limite, enviados);
  if (conLugar.length === 0) return { ok: false, error: "Esta campaña ya recibió todos los aportes que pedía de cada tipo." };
  const tieneArchivo = archivo instanceof File && archivo.size > 0;
  const declarado = tieneArchivo ? tipoPorNombre(archivo) : archivoEsOpcional(tipos) ? "texto" : null;
  if (declarado && tipos.includes(declarado) && !conLugar.includes(declarado)) {
    return { ok: false, error: mensajeDeTipoLleno(declarado, limite) };
  }
  return { ok: true, tipos: conLugar };
}

/**
 * Aviso rápido del tope por persona de cada tipo (2026-10-31), antes de subir nada: como
 * tiposConLugarParaElAporte, pero con lo que ya mandó la persona. Recibe los tipos que ya pasaron el
 * límite total. La comprobación que cuenta va en insertarAporteConCuota.
 */
export function tiposDentroDeLaCuotaParaElAporte(
  archivo: FormDataEntryValue | null,
  tipos: TipoDeArchivo[],
  todosLosTipos: TipoDeArchivo[],
  cuota: CuotaPorTipo,
  mios: MiosPorTipo,
): { ok: true; tipos: TipoDeArchivo[] } | { ok: false; error: string } {
  const dentro = tiposDentroDeSuCuota(tipos, cuota, mios);
  if (dentro.length === 0) return { ok: false, error: "Ya enviaste el máximo de cada tipo que permite esta campaña." };
  const tieneArchivo = archivo instanceof File && archivo.size > 0;
  const declarado = tieneArchivo ? tipoPorNombre(archivo) : archivoEsOpcional(todosLosTipos) ? "texto" : null;
  if (declarado && tipos.includes(declarado) && !dentro.includes(declarado)) {
    return { ok: false, error: mensajeDeCuotaDelTipo(declarado, cuota) };
  }
  return { ok: true, tipos: dentro };
}

/** Cuántos aportes de cada tipo lleva una persona (cuenta o dispositivo anónimo) en la campaña. */
export async function aportesDeLaPersonaPorTipo(
  campaignId: string | number,
  persona: { usuarioId: string | number } | { anonimoId: string },
  client: Pick<PoolClient, "query"> = pool,
): Promise<MiosPorTipo> {
  const [columna, valor] = "usuarioId" in persona ? ["user_id", persona.usuarioId] : ["anonimo_id", persona.anonimoId];
  const { rows } = await client.query<{ porTipo: unknown }>(
    `SELECT COALESCE(jsonb_object_agg(file_type, n), '{}'::jsonb) AS "porTipo"
       FROM (SELECT file_type, COUNT(*)::int AS n FROM aportes
              WHERE campaign_id = $1 AND ${columna} = $2 GROUP BY file_type) t`,
    [campaignId, valor],
  );
  return mapaPorTipo(rows[0]?.porTipo);
}

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
  tipos: TipoDeArchivo[],
  /** Formatos de "Archivo" que acepta la campaña ([] o sin dar = todos; 2026-10-28). */
  formatosDeDocumento: readonly FormatoDeDocumento[] = []
): Promise<{ ok: true; archivo: ArchivoDelAporte } | { ok: false; error: string }> {
  if (!(archivo instanceof File) || archivo.size === 0) {
    return archivoEsOpcional(tipos)
      ? { ok: true, archivo: { tipo: "texto", guardado: null } }
      : { ok: false, error: "El archivo es obligatorio" };
  }
  const limpio = await limpiarArchivo(archivo, tipos);
  if (!limpio.ok) return limpio;
  // Con el formato real (por contenido), no el que dice el nombre.
  if (limpio.archivo.tipo === "documento" && !documentoPermitido(limpio.archivo.extension, formatosDeDocumento)) {
    return { ok: false, error: `Formato no válido. Esta campaña acepta ${textoDeExtensiones(tipos, formatosDeDocumento)}.` };
  }
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
 * La cuota por persona es general (del 2026-10-21 al 2026-10-27 se repartía por tipo; se quitó a
 * pedido del usuario). Desde el 2026-10-28 la campaña puede tener un límite TOTAL por tipo de dato
 * (lib/campanas/limite-por-tipo.ts): se revisa con la fila de la campaña bloqueada, así dos personas
 * que mandan a la vez el último lugar de un tipo no lo pasan. El tope de aportes anónimos, cuando se
 * entrega, también se verifica bajo el mismo bloqueo; las personas con cuenta no están sujetas a él.
 *
 * Si no se inserta, borra de MinIO el archivo que se acababa de subir.
 */
export async function insertarAporteConCuota<T>(entrada: {
  campaignId: string | number;
  /** Tipo real del aporte (el del archivo, o "texto"), para el límite por tipo de la campaña. */
  tipo: TipoDeArchivo;
  /** Identifica a la persona dentro de la campaña: `usuario:<id>` o `dispositivo:<hash>`. */
  persona: string;
  cuota: number;
  /** Calcula el tope de anónimos desde la meta actual y el tope que eligió el creador (2026-11-13), bajo el candado. */
  limiteAnonimos?: (meta: number, elegido: number | null) => number;
  /** Cuenta los lugares ocupados del tope de anónimos; se comprueba bajo el bloqueo de la campaña. */
  contarAnonimos?: (client: PoolClient) => Promise<number>;
  /** Cuántos aportes tiene ya esta persona en la campaña. */
  contar: (client: PoolClient) => Promise<number>;
  /** Cuántos aportes de `tipo` tiene ya esta persona, para el tope por persona del tipo (2026-10-31). */
  contarDelTipo: (client: PoolClient) => Promise<number>;
  insertar: (client: PoolClient) => Promise<T>;
  comprobar?: (client: PoolClient) => Promise<{ error: string; esperaSegundos: number } | null>;
  /** Clave en MinIO del archivo ya subido, para borrarlo si no se inserta (null: aporte sin archivo). */
  archivoSubido: string | null;
}): Promise<
  | { ok: true; fila: T; yaEnviados: number }
  | { ok: false; motivo: "cuota" }
  | { ok: false; motivo: "limite_anonimos" }
  | { ok: false; motivo: "tipo_lleno"; error: string }
  | { ok: false; motivo: "cuota_del_tipo"; error: string }
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
    // Los topes de campaña se verifican bajo el mismo candado que toma recalcularContadores.
    const { rows: filasCampana } = await client.query<{ goal_contributions: number; limite_anonimos: number | null }>(
      `SELECT goal_contributions, limite_anonimos FROM campanas WHERE id = $1 FOR NO KEY UPDATE`,
      [entrada.campaignId],
    );
    if (entrada.limiteAnonimos) {
      if (!entrada.contarAnonimos) throw new Error("Falta contar los aportes anónimos de la campaña");
      const metaActual = Number(filasCampana[0]?.goal_contributions ?? 0);
      const elegido = filasCampana[0]?.limite_anonimos;
      if ((await entrada.contarAnonimos(client)) >= entrada.limiteAnonimos(metaActual, elegido == null ? null : Number(elegido))) {
        await client.query("ROLLBACK");
        return { ok: false, motivo: "limite_anonimos" };
      }
    }
    const campana = await client.query<{ limite: number | null; cuota_por_persona: number | null }>(
      `SELECT limite, cuota_por_persona FROM campana_tipos WHERE campana_id = $1 AND tipo = $2`,
      [entrada.campaignId, entrada.tipo],
    );
    // Tope por persona del tipo (2026-10-31, lib/campanas/cuota-por-tipo.ts), dentro del mismo candado.
    const topeDelTipo = Number(campana.rows[0]?.cuota_por_persona ?? 0);
    if (topeDelTipo && (await entrada.contarDelTipo(client)) >= topeDelTipo) {
      await client.query("ROLLBACK");
      return { ok: false, motivo: "cuota_del_tipo", error: mensajeDeCuotaDelTipo(entrada.tipo, { [entrada.tipo]: topeDelTipo }) };
    }
    const delTipo = Number(campana.rows[0]?.limite ?? 0);
    const limite: LimitePorTipo = delTipo ? { [entrada.tipo]: delTipo } : {};
    if (delTipo) {
      const { rows } = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM aportes WHERE campaign_id = $1 AND file_type = $2 AND status <> 'rechazado'`,
        [entrada.campaignId, entrada.tipo],
      );
      if (Number(rows[0]?.n ?? 0) >= delTipo) {
        await client.query("ROLLBACK");
        return { ok: false, motivo: "tipo_lleno", error: mensajeDeTipoLleno(entrada.tipo, limite) };
      }
    }
    const fila = await entrada.insertar(client);
    await recalcularContadores(entrada.campaignId, client);
    // Total con la campaña bloqueada (recalcularContadores la bloqueó): para el aviso de cada 10 aportes.
    const { rows } = await client.query<{ total: number }>(
      `SELECT current_contributions AS total FROM campana_estadisticas WHERE campana_id = $1`,
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
 * (total, pendientes, aceptados, rechazados, participantes y los no rechazados de cada tipo, que
 * usa el límite por tipo de dato). Se usa después de cualquier
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
  // En campana_estadisticas (2026-10-30): el aporte ya no reescribe la fila de campanas.
  await client.query(
    `INSERT INTO campana_estadisticas (campana_id, current_contributions, pending_contributions,
                                       approved_contributions, rejected_contributions, participants)
     SELECT $1::int, COUNT(*)::int,
            COUNT(*) FILTER (WHERE status IN ('pendiente', 'espera_final'))::int,
            COUNT(*) FILTER (WHERE status = 'aceptado')::int,
            COUNT(*) FILTER (WHERE status = 'rechazado')::int,
            COUNT(DISTINCT COALESCE(user_id::text, participant_email, anonimo_id))::int
     FROM aportes WHERE campaign_id = $1
     ON CONFLICT (campana_id) DO UPDATE SET
       current_contributions = EXCLUDED.current_contributions,
       pending_contributions = EXCLUDED.pending_contributions,
       approved_contributions = EXCLUDED.approved_contributions,
       rejected_contributions = EXCLUDED.rejected_contributions,
       participants = EXCLUDED.participants`,
    [campaignId]
  );
  // No rechazados de cada tipo (campana_tipos.enviados, 2026-10-30; antes campanas.enviados_por_tipo).
  await actualizarEnviados(client, campaignId);
}
