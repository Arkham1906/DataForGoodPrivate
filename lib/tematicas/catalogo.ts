// Catálogo de temáticas en la base de datos (tabla `tematicas`, lib/db-schema.ts). Desde el
// 2026-10-07 los intereses de los perfiles y la temática de las campañas salen de aquí, no de una
// lista fija: empieza con las 23 de lib/intereses.ts y crece con las palabras clave que salen del
// texto de cada persona (lib/tematicas/analizar.ts).
//   - tematicasVisibles(): lo que se ofrece en /bienvenida, /cuenta y el formulario de campaña.
//   - resolverIntereses(): valida los intereses de un perfil y da de alta las temáticas nuevas,
//     como pendientes (2026-10-19): solo las tiene quien las escribió hasta que se aprueban.
//   - listarTematicasDelPanel() / cambiarVisibilidad() / aprobar() / rechazar() /
//     contarTematicasPendientes(): /sistema/tematicas del SuperUsuario y el número del menú.

import { pool } from "@/lib/db";
import { claveDeTematica, conMayuscula, esTematicaNuevaValida, MAXIMO_DE_INTERESES } from "@/lib/tematicas/analizar";

/**
 * Temáticas que se ofrecen: las 23 base en su orden de siempre y después las de los usuarios,
 * en orden alfabético. Sin las ocultas, sin las pendientes de aprobar, ni las de usuarios que no pasan el filtro de hoy
 * (creadas antes de que atrapara esa palabra; ver bloqueadaPorElFiltro).
 */
export async function tematicasVisibles(): Promise<string[]> {
  const result = await pool.query<{ nombre: string; origen: "base" | "usuario" }>(
    `SELECT nombre, origen FROM tematicas
     WHERE NOT oculta AND aprobada
     ORDER BY origen = 'base' DESC, CASE WHEN origen = 'base' THEN id END, clave`,
  );
  return result.rows.filter((r) => !bloqueadaPorElFiltro(r)).map((r) => r.nombre);
}

/**
 * Una temática de usuario que hoy no se podría crear (2026-10-19: el filtro de palabras
 * inapropiadas creció y "Asesinato" o "Muerte" ya estaban en el catálogo). No se ofrece ni se
 * puede guardar en un perfil, aunque la persona ya la tuviera. Las base nunca se bloquean.
 */
export function bloqueadaPorElFiltro(tematica: { nombre: string; origen: "base" | "usuario" }): boolean {
  return tematica.origen === "usuario" && !esTematicaNuevaValida(tematica.nombre);
}

export type ResultadoDeIntereses = { ok: true; intereses: string[] } | { ok: false; error: string };

/**
 * Intereses que se van a guardar en un perfil, ya validados:
 *   - Sin repetir (por clave: "ciclismo" y "Ciclismo" son la misma) y hasta MAXIMO_DE_INTERESES.
 *   - Si la temática existe, se guarda con su nombre del catálogo. Una oculta solo se conserva si
 *     la persona ya la tenía (`actuales`); no se puede agregar de nuevo. Una bloqueada por el
 *     filtro (bloqueadaPorElFiltro) se quita siempre.
 *   - Si no existe y hay `usuarioId`, se da de alta (origen 'usuario') si pasa
 *     esTematicaNuevaValida; si no pasa, error. Sin `usuarioId` (registro) se descarta.
 * El alta no va en la misma transacción que el UPDATE del perfil: si este falla, la temática
 * queda en el catálogo sin nadie que la tenga, lo cual es inofensivo.
 */
export async function resolverIntereses(
  entrada: unknown[],
  usuarioId: number | null,
  actuales: string[] = [],
): Promise<ResultadoDeIntereses> {
  const pedidos = new Map<string, string>();
  for (const valor of entrada) {
    const nombre = String(valor ?? "").trim().replace(/\s+/g, " ");
    const clave = claveDeTematica(nombre);
    if (clave && !pedidos.has(clave)) pedidos.set(clave, nombre);
  }
  if (pedidos.size > MAXIMO_DE_INTERESES) {
    return { ok: false, error: `Puedes tener hasta ${MAXIMO_DE_INTERESES} intereses` };
  }
  if (pedidos.size === 0) return { ok: true, intereses: [] };

  const claves = [...pedidos.keys()];
  const existentes = await pool.query<{ nombre: string; clave: string; oculta: boolean; origen: "base" | "usuario" }>(
    `SELECT nombre, clave, oculta, origen FROM tematicas WHERE clave = ANY($1::text[])`,
    [claves],
  );
  const porClave = new Map(existentes.rows.map((r) => [r.clave, r]));

  const nuevas = claves.filter((clave) => !porClave.has(clave));
  if (nuevas.length > 0 && usuarioId !== null) {
    const invalida = nuevas.find((clave) => !esTematicaNuevaValida(pedidos.get(clave)!));
    if (invalida) return { ok: false, error: `"${pedidos.get(invalida)}" no se puede usar como interés` };

    // Entran pendientes (aprobada = false): quedan en este perfil, pero no se ofrecen a nadie más
    // hasta que el SuperUsuario las apruebe. ON CONFLICT: si otra persona la acaba de crear, se
    // queda la suya (pendiente o no) y aquí se relee.
    await pool.query(
      `INSERT INTO tematicas (nombre, clave, origen, creada_por, aprobada)
       SELECT nombre, clave, 'usuario', $3, false FROM unnest($1::text[], $2::text[]) AS t(nombre, clave)
       ON CONFLICT (clave) DO NOTHING`,
      // Con mayúscula inicial, como las propone el análisis ("fotografía" → "Fotografía").
      [nuevas.map((clave) => conMayuscula(pedidos.get(clave)!)), nuevas, usuarioId],
    );
    const creadas = await pool.query<{ nombre: string; clave: string; oculta: boolean; origen: "base" | "usuario" }>(
      `SELECT nombre, clave, oculta, origen FROM tematicas WHERE clave = ANY($1::text[])`,
      [nuevas],
    );
    for (const fila of creadas.rows) porClave.set(fila.clave, fila);
  }

  const yaLasTenia = new Set(actuales.map(claveDeTematica));
  const intereses: string[] = [];
  for (const clave of claves) {
    const fila = porClave.get(clave);
    if (!fila || bloqueadaPorElFiltro(fila)) continue;
    if (fila.oculta && !yaLasTenia.has(clave)) continue;
    intereses.push(fila.nombre);
  }
  return { ok: true, intereses };
}

export type TematicaDelPanel = {
  id: number;
  nombre: string;
  origen: "base" | "usuario";
  oculta: boolean;
  /** false: la escribió un usuario y espera revisión; solo la tiene quien la escribió. */
  aprobada: boolean;
  /** De usuario y no pasa el filtro de palabras inapropiadas: no se ofrece aunque no esté oculta. */
  bloqueada: boolean;
  creadaEl: string;
  /** Perfiles que la tienen entre sus intereses. */
  personas: number;
  /** Campañas (de cualquier estado) con esa temática. */
  campanas: number;
};

/**
 * Catálogo completo para /sistema/tematicas: primero las pendientes de revisar, luego las de los usuarios, de la más nueva a la más
 * vieja, y al final las base. `q` busca en el nombre sin importar acentos. La página verifica la
 * sesión raíz.
 */
export async function listarTematicasDelPanel(q?: string): Promise<TematicaDelPanel[]> {
  const busqueda = claveDeTematica(q ?? "");
  const result = await pool.query<{
    id: number;
    nombre: string;
    origen: "base" | "usuario";
    oculta: boolean;
    aprobada: boolean;
    created_at: Date;
    personas: string;
    campanas: string;
  }>(
    `SELECT t.id, t.nombre, t.origen, t.oculta, t.aprobada, t.created_at,
            (SELECT COUNT(*) FROM usuarios u WHERE u.intereses ? t.nombre) AS personas,
            (SELECT COUNT(*) FROM campanas c WHERE COALESCE(NULLIF(c.tematica, ''), c.tag) = t.nombre) AS campanas
     FROM tematicas t
     WHERE $1 = '' OR t.clave LIKE '%' || $1 || '%'
     ORDER BY NOT t.aprobada AND NOT t.oculta DESC, t.origen = 'usuario' DESC, CASE WHEN t.origen = 'usuario' THEN t.created_at END DESC, t.id`,
    [busqueda],
  );
  return result.rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    origen: r.origen,
    oculta: r.oculta,
    aprobada: r.aprobada,
    bloqueada: bloqueadaPorElFiltro(r),
    creadaEl: r.created_at.toISOString(),
    personas: Number(r.personas),
    campanas: Number(r.campanas),
  }));
}

/** Oculta o vuelve a mostrar una temática. Devuelve su nombre, o null si no existe. */
export async function cambiarVisibilidad(id: number, oculta: boolean): Promise<string | null> {
  const result = await pool.query<{ nombre: string }>(
    `UPDATE tematicas SET oculta = $2 WHERE id = $1 RETURNING nombre`,
    [id, oculta],
  );
  return result.rows[0]?.nombre ?? null;
}

/** Temáticas que esperan revisión (sin las ya rechazadas, que quedan ocultas). Para el menú del panel. */
export async function contarTematicasPendientes(): Promise<number> {
  const result = await pool.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM tematicas WHERE NOT aprobada AND NOT oculta`,
  );
  return Number(result.rows[0]?.n ?? 0);
}

/** Aprueba una temática pendiente: desde ahora se ofrece a todos. Devuelve su nombre, o null si no existe. */
export async function aprobar(id: number): Promise<string | null> {
  const result = await pool.query<{ nombre: string }>(
    `UPDATE tematicas SET aprobada = true, oculta = false WHERE id = $1 RETURNING nombre`,
    [id],
  );
  return result.rows[0]?.nombre ?? null;
}

/**
 * Rechaza una temática pendiente: queda oculta (nadie la puede volver a agregar) y se quita de los
 * perfiles que la tenían, que solo pueden ser los de quienes la escribieron. Devuelve su nombre y
 * de cuántos perfiles se quitó, o null si no existe o ya estaba aprobada (esas se ocultan).
 */
export async function rechazar(id: number): Promise<{ nombre: string; perfiles: number } | null> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const fila = await cliente.query<{ nombre: string }>(
      `UPDATE tematicas SET oculta = true WHERE id = $1 AND NOT aprobada RETURNING nombre`,
      [id],
    );
    const nombre = fila.rows[0]?.nombre;
    if (!nombre) {
      await cliente.query("ROLLBACK");
      return null;
    }
    const perfiles = await cliente.query(
      `UPDATE usuarios SET intereses = intereses - $1::text, updated_at = NOW() WHERE intereses ? $1`,
      [nombre],
    );
    await cliente.query("COMMIT");
    return { nombre, perfiles: perfiles.rowCount ?? 0 };
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}
