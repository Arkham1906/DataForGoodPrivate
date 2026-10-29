// Catálogo de temáticas en la base de datos (tabla `tematicas`, lib/db-schema.ts). Desde el
// 2026-10-07 los intereses de los perfiles y la temática de las campañas salen de aquí, no de una
// lista fija: empieza con las de lib/intereses.ts. Del 2026-10-07 al 2026-10-20 crecía con las
// palabras que salían del texto de cada persona; desde el 2026-10-20 (decisión del usuario) el
// texto solo da temáticas que ya existen y ya no se crean desde un perfil. Las de usuario que
// quedaron se siguen revisando en el panel.
//   - tematicasVisibles(): lo que se ofrece en /bienvenida, /cuenta y el formulario de campaña.
//   - resolverIntereses(): valida los intereses de un perfil; solo acepta temáticas que existen.
//   - listarTematicasDelPanel() / cambiarVisibilidad() / aprobar() / rechazar() /
//     contarTematicasPendientes(): /sistema/tematicas del SuperUsuario y el número del menú.
//   - crearTematica() / renombrarTematica() / borrarTematica() (2026-10-26): el SuperUsuario crea,
//     edita y borra temáticas que no son base (decisiones del usuario: las base quedan fijas;
//     renombrar actualiza perfiles y campañas; no se borra una que usan campañas, se oculta).
//   - revisarPropuestas() / crearPropuestas() / revisarTematicaDeCampana() (2026-10-29, a pedido del
//     usuario): la persona propone una temática nueva desde su perfil o al crear o editar una
//     campaña. Queda pendiente (origen 'usuario', creada_por) hasta que el SuperUsuario la revisa;
//     si la rechaza y alguna campaña la usa, elige a qué temática pasan (rechazar con reemplazo).

import { pool } from "@/lib/db";
import {
  claveDeTematica,
  esTematicaNuevaValida,
  LARGO_DEL_NOMBRE,
  MAXIMO_DE_INTERESES,
  MAXIMO_DE_TEMATICAS_PROPUESTAS,
} from "@/lib/tematicas/analizar";
import { esInapropiada } from "@/lib/tematicas/filtro";
import { TEMAS_DE_INTERES } from "@/lib/intereses";

/** base: las de lib/intereses.ts; usuario: salió del texto de un perfil; panel: la creó el SuperUsuario. */
export type OrigenDeTematica = "base" | "usuario" | "panel";

/**
 * Temáticas que se ofrecen: las base en el orden de lib/intereses.ts (cada tema general junto a su
 * causa, 2026-10-27) y después las de los usuarios,
 * en orden alfabético. Sin las ocultas, sin las pendientes de aprobar, ni las de usuarios que no pasan el filtro de hoy
 * (creadas antes de que atrapara esa palabra; ver bloqueadaPorElFiltro).
 */
export async function tematicasVisibles(): Promise<string[]> {
  const result = await pool.query<{ nombre: string; origen: OrigenDeTematica }>(
    `SELECT nombre, origen FROM tematicas
     WHERE NOT oculta AND aprobada
     ORDER BY origen = 'base' DESC, CASE WHEN origen = 'base' THEN id END, clave`,
  );
  const lugar = (nombre: string) => {
    const i = TEMAS_DE_INTERES.indexOf(nombre);
    return i === -1 ? TEMAS_DE_INTERES.length : i;
  };
  // sort es estable: las de usuarios conservan su orden alfabético después de las base.
  return result.rows
    .filter((r) => !bloqueadaPorElFiltro(r))
    .sort((a, b) => (a.origen === "base" && b.origen === "base" ? lugar(a.nombre) - lugar(b.nombre) : 0))
    .map((r) => r.nombre);
}

/**
 * Una temática de usuario que hoy no se podría crear (2026-10-19: el filtro de palabras
 * inapropiadas creció y "Asesinato" o "Muerte" ya estaban en el catálogo). No se ofrece ni se
 * puede guardar en un perfil, aunque la persona ya la tuviera. Las base nunca se bloquean.
 */
export function bloqueadaPorElFiltro(tematica: { nombre: string; origen: OrigenDeTematica }): boolean {
  return tematica.origen === "usuario" && !esTematicaNuevaValida(tematica.nombre);
}

export type ResultadoDeIntereses = { ok: true; intereses: string[] } | { ok: false; error: string };

/**
 * Intereses que se van a guardar en un perfil, ya validados:
 *   - Sin repetir (por clave: "ciclismo" y "Ciclismo" son la misma) y hasta MAXIMO_DE_INTERESES.
 *   - Si la temática existe, se guarda con su nombre del catálogo. Una oculta o pendiente de
 *     aprobar solo se conserva si la persona ya la tenía (`actuales`); no se puede agregar de
 *     nuevo. Una bloqueada por el filtro (bloqueadaPorElFiltro) se quita siempre.
 *   - Si no existe, error (2026-10-20: ya no se dan de alta temáticas desde un perfil), o se
 *     descarta con `descartarDesconocidas` (el registro, como siempre).
 */
export async function resolverIntereses(
  entrada: unknown[],
  actuales: string[] = [],
  { descartarDesconocidas = false }: { descartarDesconocidas?: boolean } = {},
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
  const existentes = await pool.query<{ nombre: string; clave: string; oculta: boolean; aprobada: boolean; origen: OrigenDeTematica }>(
    `SELECT nombre, clave, oculta, aprobada, origen FROM tematicas WHERE clave = ANY($1::text[])`,
    [claves],
  );
  const porClave = new Map(existentes.rows.map((r) => [r.clave, r]));

  const desconocida = claves.find((clave) => !porClave.has(clave));
  if (desconocida && !descartarDesconocidas) {
    return { ok: false, error: `"${pedidos.get(desconocida)}" no es una temática del catálogo` };
  }

  const yaLasTenia = new Set(actuales.map(claveDeTematica));
  const intereses: string[] = [];
  for (const clave of claves) {
    const fila = porClave.get(clave);
    if (!fila || bloqueadaPorElFiltro(fila)) continue;
    if ((fila.oculta || !fila.aprobada) && !yaLasTenia.has(clave)) continue;
    intereses.push(fila.nombre);
  }
  return { ok: true, intereses };
}

export type TematicaDelPanel = {
  id: number;
  nombre: string;
  origen: OrigenDeTematica;
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
 * Catálogo completo para /sistema/tematicas: primero las pendientes de revisar, luego las de los usuarios y las del panel, de la más nueva a la más
 * vieja, y al final las base. `q` busca en el nombre sin importar acentos. La página verifica la
 * sesión raíz.
 */
export async function listarTematicasDelPanel(q?: string): Promise<TematicaDelPanel[]> {
  const busqueda = claveDeTematica(q ?? "");
  const result = await pool.query<{
    id: number;
    nombre: string;
    origen: OrigenDeTematica;
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
     ORDER BY NOT t.aprobada AND NOT t.oculta DESC, t.origen <> 'base' DESC, CASE WHEN t.origen <> 'base' THEN t.created_at END DESC, t.id`,
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

/** Temáticas que esperan revisión (las rechazadas ya no existen; NOT oculta excluye las de antes del 2026-10-22). Para el menú del panel. */
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

/** Campaña que cambió de temática porque el SuperUsuario rechazó la suya (para avisar a su creador). */
export type CampanaReasignada = { id: number; creadorId: number; nombre: string };

/**
 * Rechaza una temática pendiente: se borra del catálogo (desde el 2026-10-22, a pedido del usuario;
 * antes quedaba oculta con "Aprobar" por si se rechazó por error) y se quita de los perfiles que la
 * tenían (quienes la propusieron). Su nombre queda en audit_log.
 *
 * Desde el 2026-10-29 una campaña también puede usar una temática propuesta. Si alguna la usa, hay
 * que dar `reemplazo` (decisión del usuario): una temática aprobada y visible a la que pasan esas
 * campañas, en la misma transacción; sus etiquetas de la rechazada se borran en cascada. Sin
 * reemplazo, error. Devuelve el nombre, de cuántos perfiles se quitó y las campañas que cambiaron.
 */
export async function rechazar(
  id: number,
  reemplazo?: string,
): Promise<ResultadoDelCatalogo<{ nombre: string; perfiles: number; campanas: CampanaReasignada[]; reemplazo: string | null }>> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const fila = await cliente.query<{ nombre: string }>(
      `SELECT nombre FROM tematicas WHERE id = $1 AND NOT aprobada FOR UPDATE`,
      [id],
    );
    const nombre = fila.rows[0]?.nombre;
    if (!nombre) {
      await cliente.query("ROLLBACK");
      return { ok: false, error: "La temática no existe o ya estaba aprobada." };
    }

    const usadas = await cliente.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM campanas WHERE COALESCE(NULLIF(tematica, ''), tag) = $1`,
      [nombre],
    );
    const enCampanas = usadas.rows[0]?.n ?? 0;
    let destino: string | null = null;
    let campanas: CampanaReasignada[] = [];
    if (enCampanas > 0) {
      const pedido = String(reemplazo ?? "").trim();
      const elegida = pedido
        ? await cliente.query<{ nombre: string }>(
            `SELECT nombre FROM tematicas WHERE clave = $1 AND aprobada AND NOT oculta AND id <> $2`,
            [claveDeTematica(pedido), id],
          )
        : null;
      destino = elegida?.rows[0]?.nombre ?? null;
      if (!destino) {
        await cliente.query("ROLLBACK");
        return {
          ok: false,
          error: `La ${enCampanas === 1 ? "usa 1 campaña" : `usan ${enCampanas} campañas`}: elige a qué temática aprobada pasan.`,
        };
      }
      const cambiadas = await cliente.query<{ id: number; creator_id: number; name: string }>(
        `UPDATE campanas SET
           tematica = CASE WHEN COALESCE(NULLIF(tematica, ''), tag) = $1 THEN $2 ELSE tematica END,
           tag = CASE WHEN tag = $1 THEN $2 ELSE tag END,
           updated_at = NOW()
         WHERE COALESCE(NULLIF(tematica, ''), tag) = $1
         RETURNING id, creator_id, name`,
        [nombre, destino],
      );
      campanas = cambiadas.rows.map((r) => ({ id: Number(r.id), creadorId: Number(r.creator_id), nombre: r.name }));
    }

    // ON DELETE CASCADE: se van sus etiquetas y, con ellas, las de las campañas que cambiaron.
    await cliente.query(`DELETE FROM tematicas WHERE id = $1`, [id]);
    const perfiles = await cliente.query(
      `UPDATE usuarios SET intereses = intereses - $1::text, updated_at = NOW() WHERE intereses ? $1`,
      [nombre],
    );
    await cliente.query("COMMIT");
    return { ok: true, nombre, perfiles: perfiles.rowCount ?? 0, campanas, reemplazo: destino };
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Quién propuso una temática pendiente y si la tiene en su perfil o en alguna campaña suya
 * (2026-10-29), para avisarle cuando el SuperUsuario la revisa. Se lee antes de decidir: rechazar
 * la borra. Null si no existe, ya estaba aprobada o no tiene autor.
 */
export async function propuestaDeTematica(
  id: number,
): Promise<{ usuarioId: number; nombre: string; enPerfil: boolean; enCampana: boolean } | null> {
  const r = await pool.query<{ creada_por: number; nombre: string; en_perfil: boolean; en_campana: boolean }>(
    `SELECT t.creada_por, t.nombre,
            EXISTS (SELECT 1 FROM usuarios u WHERE u.id = t.creada_por AND u.intereses ? t.nombre) AS en_perfil,
            EXISTS (SELECT 1 FROM campanas c WHERE c.creator_id = t.creada_por
                    AND COALESCE(NULLIF(c.tematica, ''), c.tag) = t.nombre) AS en_campana
     FROM tematicas t
     WHERE t.id = $1 AND NOT t.aprobada AND t.creada_por IS NOT NULL`,
    [id],
  );
  const f = r.rows[0];
  return f ? { usuarioId: Number(f.creada_por), nombre: f.nombre, enPerfil: f.en_perfil, enCampana: f.en_campana } : null;
}

/** Temáticas que propuso una persona y siguen sin revisar (se marcan "por aprobar" en su perfil y sus campañas). */
export async function tematicasPropuestasPor(usuarioId: number): Promise<string[]> {
  const r = await pool.query<{ nombre: string }>(
    `SELECT nombre FROM tematicas WHERE creada_por = $1 AND NOT aprobada AND NOT oculta ORDER BY clave`,
    [usuarioId],
  );
  return r.rows.map((f) => f.nombre);
}

export type ResultadoDelCatalogo<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Revisa, sin escribir nada, las temáticas que una persona propone (2026-10-29). Cada nombre se
 * valida como los del panel (validarNombreDeTematica). Si ya existe en el catálogo:
 *   - aprobada: no es propuesta (se elige como cualquier otra; una oculta no se agrega de nuevo);
 *   - pendiente (la propuso alguien más o ella misma): se usa esa, sin crear otra.
 * Las que no existen se crearán con crearPropuestas(). Tope: MAXIMO_DE_TEMATICAS_PROPUESTAS
 * pendientes por persona, contando las que ya tiene.
 * Devuelve `nombres` (cómo quedan: del catálogo o como se escribieron) y `porCrear`.
 */
export async function revisarPropuestas(
  entrada: unknown,
  usuarioId: number,
): Promise<ResultadoDelCatalogo<{ nombres: string[]; porCrear: string[] }>> {
  if (!Array.isArray(entrada)) return { ok: false, error: "Las temáticas propuestas deben ser una lista" };
  const pedidas = new Map<string, string>();
  for (const valor of entrada) {
    const validado = validarNombreDeTematica(valor);
    if (!validado.ok) return { ok: false, error: `Temática «${String(valor ?? "").trim()}»: ${validado.error}` };
    const clave = claveDeTematica(validado.nombre);
    if (!pedidas.has(clave)) pedidas.set(clave, validado.nombre);
  }
  if (pedidas.size === 0) return { ok: true, nombres: [], porCrear: [] };

  const existentes = await pool.query<{ nombre: string; clave: string; aprobada: boolean }>(
    `SELECT nombre, clave, aprobada FROM tematicas WHERE clave = ANY($1::text[])`,
    [[...pedidas.keys()]],
  );
  const porClave = new Map(existentes.rows.map((r) => [r.clave, r]));
  const nombres: string[] = [];
  const porCrear: string[] = [];
  for (const [clave, nombre] of pedidas) {
    const fila = porClave.get(clave);
    if (!fila) {
      nombres.push(nombre);
      porCrear.push(nombre);
    } else if (!fila.aprobada) {
      nombres.push(fila.nombre);
    }
  }

  if (porCrear.length > 0) {
    const suyas = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM tematicas WHERE creada_por = $1 AND NOT aprobada AND NOT oculta`,
      [usuarioId],
    );
    if ((suyas.rows[0]?.n ?? 0) + porCrear.length > MAXIMO_DE_TEMATICAS_PROPUESTAS) {
      return {
        ok: false,
        error: `Puedes tener hasta ${MAXIMO_DE_TEMATICAS_PROPUESTAS} temáticas propuestas esperando revisión`,
      };
    }
  }
  return { ok: true, nombres, porCrear };
}

/**
 * Da de alta, pendientes de aprobar, las temáticas que revisarPropuestas() dejó en `porCrear`.
 * ON CONFLICT: si otra persona la propuso en el mismo instante, se queda la suya.
 */
export async function crearPropuestas(nombres: string[], usuarioId: number): Promise<void> {
  for (const nombre of nombres) {
    await pool.query(
      `INSERT INTO tematicas (nombre, clave, origen, creada_por, aprobada, oculta)
       VALUES ($1, $2, 'usuario', $3, false, false)
       ON CONFLICT (clave) DO NOTHING`,
      [nombre, claveDeTematica(nombre), usuarioId],
    );
  }
}

/**
 * Temática de una campaña al crearla o editarla (2026-10-29). Antes el servidor no la comparaba con
 * el catálogo. Ahora:
 *   - Si existe (en cualquier estado), se guarda con su nombre del catálogo.
 *   - Si es la que la campaña ya tenía (`actual`), se acepta tal cual aunque ya no exista.
 *   - Si no existe y llega `proponer`, se revisa como propuesta (revisarPropuestas) y hay que
 *     crearla con crearPropuestas() antes de guardar la campaña (`porCrear`).
 *   - Si no, error.
 */
export async function revisarTematicaDeCampana(
  tematica: string,
  usuarioId: number,
  { proponer = false, actual = "" }: { proponer?: boolean; actual?: string } = {},
): Promise<ResultadoDelCatalogo<{ tematica: string; porCrear: string[] }>> {
  const limpia = tematica.trim().replace(/\s+/g, " ");
  if (actual && limpia === actual) return { ok: true, tematica: limpia, porCrear: [] };
  const existente = await pool.query<{ nombre: string }>(`SELECT nombre FROM tematicas WHERE clave = $1`, [
    claveDeTematica(limpia),
  ]);
  if (existente.rows[0]) return { ok: true, tematica: existente.rows[0].nombre, porCrear: [] };
  if (!proponer) return { ok: false, error: `«${limpia}» no es una temática del catálogo` };
  const revisadas = await revisarPropuestas([limpia], usuarioId);
  if (!revisadas.ok) return revisadas;
  return { ok: true, tematica: revisadas.nombres[0] ?? limpia, porCrear: revisadas.porCrear };
}

/**
 * Nombre que escribe el SuperUsuario, limpio (espacios simples), o el error que se le muestra:
 * letras, espacios, guiones y comas; entre 3 y 60 caracteres; sin palabras del filtro de
 * inapropiadas. No exige el resto de esTematicaNuevaValida (máximo 3 palabras, 4 letras): eso era
 * para las palabras sueltas del texto de un perfil, y "Salud y bienestar" ya tiene 3.
 */
export function validarNombreDeTematica(entrada: unknown): { ok: true; nombre: string } | { ok: false; error: string } {
  const nombre = String(entrada ?? "").trim().replace(/\s+/g, " ");
  if (nombre.length < LARGO_DEL_NOMBRE.minimo || nombre.length > LARGO_DEL_NOMBRE.maximo) {
    return { ok: false, error: `El nombre debe tener entre ${LARGO_DEL_NOMBRE.minimo} y ${LARGO_DEL_NOMBRE.maximo} caracteres.` };
  }
  if (!/^\p{L}[\p{L} ,-]*$/u.test(nombre)) {
    return { ok: false, error: "Usa solo letras, espacios, guiones y comas, empezando con una letra." };
  }
  if (esInapropiada(nombre)) return { ok: false, error: "El nombre tiene palabras que no se permiten." };
  return { ok: true, nombre };
}

/** Error de "ya existe" con el nombre de la que choca, y si está oculta, cómo recuperarla. */
async function errorDeRepetida(clave: string, sinContarId?: number): Promise<string | null> {
  const r = await pool.query<{ nombre: string; oculta: boolean }>(
    `SELECT nombre, oculta FROM tematicas WHERE clave = $1 AND ($2::int IS NULL OR id <> $2)`,
    [clave, sinContarId ?? null],
  );
  const fila = r.rows[0];
  if (!fila) return null;
  return fila.oculta
    ? `Ya existe «${fila.nombre}», oculta. Usa "Mostrar" para volver a ofrecerla.`
    : `Ya existe «${fila.nombre}».`;
}

/** Crea una temática del panel: aprobada y visible desde ya. Devuelve su id. */
export async function crearTematica(nombre: string): Promise<ResultadoDelCatalogo<{ id: number }>> {
  const clave = claveDeTematica(nombre);
  const repetida = await errorDeRepetida(clave);
  if (repetida) return { ok: false, error: repetida };
  try {
    const r = await pool.query<{ id: number }>(
      `INSERT INTO tematicas (nombre, clave, origen, aprobada, oculta) VALUES ($1, $2, 'panel', true, false) RETURNING id`,
      [nombre, clave],
    );
    return { ok: true, id: r.rows[0].id };
  } catch (error) {
    // Otra pestaña la creó entre la consulta y el INSERT (clave UNIQUE).
    if ((error as { code?: string }).code === "23505") return { ok: false, error: `Ya existe «${nombre}».` };
    throw error;
  }
}

/**
 * Cambia el nombre de una temática que no es base y lo actualiza, en la misma transacción, en los
 * intereses de los perfiles (sin repetir, en el mismo lugar) y en las campañas (`tematica` y `tag`,
 * que guarda lo mismo en las viejas). Devuelve el nombre anterior y cuántos perfiles y campañas cambiaron.
 */
export async function renombrarTematica(
  id: number,
  nombre: string,
): Promise<ResultadoDelCatalogo<{ anterior: string; perfiles: number; campanas: number }>> {
  const clave = claveDeTematica(nombre);
  const repetida = await errorDeRepetida(clave, id);
  if (repetida) return { ok: false, error: repetida };

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const fila = await cliente.query<{ nombre: string; origen: OrigenDeTematica }>(
      `SELECT nombre, origen FROM tematicas WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const actual = fila.rows[0];
    if (!actual) {
      await cliente.query("ROLLBACK");
      return { ok: false, error: "La temática no existe." };
    }
    if (actual.origen === "base") {
      await cliente.query("ROLLBACK");
      return { ok: false, error: "Las temáticas base no se editan; puedes ocultarlas." };
    }
    if (actual.nombre === nombre) {
      await cliente.query("ROLLBACK");
      return { ok: true, anterior: actual.nombre, perfiles: 0, campanas: 0 };
    }

    await cliente.query(`UPDATE tematicas SET nombre = $2, clave = $3 WHERE id = $1`, [id, nombre, clave]);
    const perfiles = await cliente.query(
      `UPDATE usuarios u SET
         intereses = (
           SELECT COALESCE(jsonb_agg(valor ORDER BY lugar), '[]'::jsonb)
           FROM (
             SELECT valor, MIN(lugar) AS lugar
             FROM (
               SELECT CASE WHEN e.valor = $1 THEN $2 ELSE e.valor END AS valor, e.lugar
               FROM jsonb_array_elements_text(u.intereses) WITH ORDINALITY AS e(valor, lugar)
             ) cambiados
             GROUP BY valor
           ) sin_repetir
         ),
         updated_at = NOW()
       WHERE u.intereses ? $1`,
      [actual.nombre, nombre],
    );
    const campanas = await cliente.query(
      `UPDATE campanas SET
         tematica = CASE WHEN tematica = $1 THEN $2 ELSE tematica END,
         tag = CASE WHEN tag = $1 THEN $2 ELSE tag END
       WHERE tematica = $1 OR tag = $1`,
      [actual.nombre, nombre],
    );
    await cliente.query("COMMIT");
    return { ok: true, anterior: actual.nombre, perfiles: perfiles.rowCount ?? 0, campanas: campanas.rowCount ?? 0 };
  } catch (error) {
    await cliente.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") return { ok: false, error: `Ya existe «${nombre}».` };
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Borra una temática que no es base y la quita de los perfiles. Si alguna campaña (de cualquier
 * estado) la usa, no se borra: se pide ocultarla (decisión del usuario, 2026-10-26).
 */
export async function borrarTematica(id: number): Promise<ResultadoDelCatalogo<{ nombre: string; perfiles: number }>> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const fila = await cliente.query<{ nombre: string; origen: OrigenDeTematica }>(
      `SELECT nombre, origen FROM tematicas WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const actual = fila.rows[0];
    if (!actual) {
      await cliente.query("ROLLBACK");
      return { ok: false, error: "La temática no existe." };
    }
    if (actual.origen === "base") {
      await cliente.query("ROLLBACK");
      return { ok: false, error: "Las temáticas base no se borran; puedes ocultarlas." };
    }
    const enCampanas = await cliente.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM campanas c WHERE COALESCE(NULLIF(c.tematica, ''), c.tag) = $1`,
      [actual.nombre],
    );
    const n = enCampanas.rows[0]?.n ?? 0;
    if (n > 0) {
      await cliente.query("ROLLBACK");
      return {
        ok: false,
        error: `No se puede borrar: la ${n === 1 ? "usa 1 campaña" : `usan ${n} campañas`}. Ocúltala para que ya no se ofrezca.`,
      };
    }
    await cliente.query(`DELETE FROM tematicas WHERE id = $1`, [id]);
    const perfiles = await cliente.query(
      `UPDATE usuarios SET intereses = intereses - $1::text, updated_at = NOW() WHERE intereses ? $1`,
      [actual.nombre],
    );
    await cliente.query("COMMIT");
    return { ok: true, nombre: actual.nombre, perfiles: perfiles.rowCount ?? 0 };
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}
