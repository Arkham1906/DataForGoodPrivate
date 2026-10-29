// Etiquetas: subtemáticas de una temática (2026-10-27, decisiones del usuario). Si la campaña es de
// Protección animal, sus etiquetas pueden ser Perros, Gatos... Tablas `etiquetas`,
// `campana_etiquetas` y `usuario_etiquetas` (lib/db-schema.ts, ensureEtiquetasTables).
//   - Una campaña lleva hasta MAXIMO_DE_ETIQUETAS_POR_CAMPANA, opcionales, de su temática.
//   - Catálogo por temática que administra el SuperUsuario en /sistema/tematicas; el creador elige
//     de él o escribe una nueva, que queda pendiente: ya está en su campaña, pero solo la ven el
//     creador y la supervisión hasta que el SuperUsuario la aprueba. Rechazarla la borra (y la
//     quita de las campañas).
//   - Se muestran en la campaña, se filtra por ellas (/explorar, /campanas, el panel y la
//     supervisión) y la persona las marca en sus intereses para los avisos de campañas nuevas.
//   - Desde el 2026-10-28 la persona también propone una al guardar sus intereses (/bienvenida,
//     /cuenta): queda pendiente y solo ella la ve en su perfil hasta que el SuperUsuario la revisa;
//     rechazarla la borra y la quita de su perfil. Las etiquetas base salen de ./base.ts.
// Los nombres se validan como los de las temáticas (validarNombreDeTematica) y no se repiten dentro
// de la misma temática (por `clave`, sin acentos ni mayúsculas).

import type { Pool, PoolClient } from "pg";

import { pool } from "@/lib/db";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { validarNombreDeTematica, type ResultadoDelCatalogo } from "@/lib/tematicas/catalogo";
import {
  MAXIMO_DE_ETIQUETAS_EN_PERFIL,
  MAXIMO_DE_ETIQUETAS_NUEVAS_EN_PERFIL,
  MAXIMO_DE_ETIQUETAS_POR_CAMPANA,
  type CatalogoDeEtiquetas,
  type EtiquetaDeCampana,
  type EtiquetaNueva,
} from "@/lib/etiquetas/reglas";

type Db = Pool | PoolClient;

/** Id de una temática por su nombre (sin acentos ni mayúsculas), o null si no está en el catálogo. */
async function idDeTematica(db: Db, nombre: string): Promise<number | null> {
  const clave = claveDeTematica(nombre);
  if (!clave) return null;
  const r = await db.query<{ id: number }>(`SELECT id FROM tematicas WHERE clave = $1`, [clave]);
  return r.rows[0] ? Number(r.rows[0].id) : null;
}

/**
 * Etiquetas que se ofrecen (aprobadas y visibles), por nombre de temática, en orden alfabético.
 * Con `usuarioId` (2026-10-28) también las pendientes que esa persona propuso o ya tiene en su
 * perfil, con `pendiente: true`: solo ella las ve hasta que el SuperUsuario las revisa.
 */
export async function etiquetasVisibles(usuarioId?: number | string): Promise<CatalogoDeEtiquetas> {
  const r = await pool.query<{ id: number; nombre: string; tematica: string; aprobada: boolean }>(
    `SELECT e.id, e.nombre, t.nombre AS tematica, e.aprobada
     FROM etiquetas e JOIN tematicas t ON t.id = e.tematica_id
     WHERE (e.aprobada AND NOT e.oculta)
        OR ($1::int IS NOT NULL AND NOT e.aprobada AND (
              e.creada_por = $1
              OR EXISTS (SELECT 1 FROM usuario_etiquetas ue WHERE ue.usuario_id = $1 AND ue.etiqueta_id = e.id)))
     ORDER BY t.nombre, e.clave`,
    [usuarioId ?? null],
  );
  const catalogo: CatalogoDeEtiquetas = {};
  for (const fila of r.rows) {
    (catalogo[fila.tematica] ??= []).push({ id: Number(fila.id), nombre: fila.nombre, ...(fila.aprobada ? {} : { pendiente: true }) });
  }
  return catalogo;
}

/** Temáticas aprobadas y visibles: a ellas se les puede proponer una etiqueta desde el perfil. */
export async function tematicasConEtiquetas(): Promise<string[]> {
  const r = await pool.query<{ nombre: string }>(`SELECT nombre FROM tematicas WHERE aprobada AND NOT oculta ORDER BY nombre`);
  return r.rows.map((f) => f.nombre);
}

/**
 * Guarda las etiquetas de una campaña (reemplaza las que tenía). `nombres` llega del formulario:
 * se limpian, no se repiten y son hasta MAXIMO_DE_ETIQUETAS_POR_CAMPANA, todas de `tematica`.
 *   - Una del catálogo aprobada y visible se usa.
 *   - Una oculta o pendiente solo si la campaña ya la tenía, o si es una pendiente que propuso el
 *     mismo creador.
 *   - Una que no existe se valida y se agrega pendiente (origen 'usuario', creada_por).
 * Devuelve el mensaje de error, o null si se guardó. Va dentro de la transacción del llamador si
 * recibe un cliente.
 */
export async function guardarEtiquetasDeCampana(
  db: Db,
  { campanaId, tematica, nombres, usuarioId }: { campanaId: number; tematica: string; nombres: unknown; usuarioId: number },
): Promise<string | null> {
  if (!Array.isArray(nombres)) return "Las etiquetas deben ser una lista";
  const pedidas = new Map<string, string>();
  for (const valor of nombres) {
    const nombre = String(valor ?? "").trim().replace(/\s+/g, " ");
    const clave = claveDeTematica(nombre);
    if (clave && !pedidas.has(clave)) pedidas.set(clave, nombre);
  }
  if (pedidas.size > MAXIMO_DE_ETIQUETAS_POR_CAMPANA) {
    return `Puedes poner hasta ${MAXIMO_DE_ETIQUETAS_POR_CAMPANA} etiquetas`;
  }

  const tematicaId = await idDeTematica(db, tematica);
  if (!tematicaId) {
    if (pedidas.size > 0) return "Elige primero una temática del catálogo para poner etiquetas";
    await db.query(`DELETE FROM campana_etiquetas WHERE campana_id = $1`, [campanaId]);
    return null;
  }

  const claves = [...pedidas.keys()];
  const existentes = await db.query<{ id: number; clave: string; nombre: string; aprobada: boolean; oculta: boolean; creada_por: number | null }>(
    `SELECT id, clave, nombre, aprobada, oculta, creada_por FROM etiquetas WHERE tematica_id = $1 AND clave = ANY($2::text[])`,
    [tematicaId, claves],
  );
  const porClave = new Map(existentes.rows.map((r) => [r.clave, r]));
  const actuales = await db.query<{ etiqueta_id: number }>(
    `SELECT etiqueta_id FROM campana_etiquetas WHERE campana_id = $1`,
    [campanaId],
  );
  const yaLasTenia = new Set(actuales.rows.map((r) => Number(r.etiqueta_id)));

  const ids: number[] = [];
  for (const [clave, nombre] of pedidas) {
    const fila = porClave.get(clave);
    if (fila) {
      const id = Number(fila.id);
      const disponible =
        (fila.aprobada && !fila.oculta) ||
        yaLasTenia.has(id) ||
        (!fila.aprobada && Number(fila.creada_por) === Number(usuarioId));
      if (!disponible) return `La etiqueta «${fila.nombre}» no está disponible`;
      ids.push(id);
      continue;
    }
    const validado = validarNombreDeTematica(nombre);
    if (!validado.ok) return `Etiqueta «${nombre}»: ${validado.error}`;
    const esTematica = await errorDeNombreDeTematica(db, claveDeTematica(validado.nombre));
    if (esTematica) return esTematica;
    // ON CONFLICT: otra campaña la propuso en el mismo instante; se usa esa.
    const nueva = await db.query<{ id: number }>(
      `INSERT INTO etiquetas (tematica_id, nombre, clave, origen, creada_por, aprobada)
       VALUES ($1, $2, $3, 'usuario', $4, false)
       ON CONFLICT (tematica_id, clave) DO UPDATE SET clave = EXCLUDED.clave
       RETURNING id`,
      [tematicaId, validado.nombre, claveDeTematica(validado.nombre), usuarioId],
    );
    ids.push(Number(nueva.rows[0].id));
  }

  await db.query(`DELETE FROM campana_etiquetas WHERE campana_id = $1 AND NOT (etiqueta_id = ANY($2::int[]))`, [campanaId, ids]);
  if (ids.length > 0) {
    await db.query(
      `INSERT INTO campana_etiquetas (campana_id, etiqueta_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
      [campanaId, ids],
    );
  }
  return null;
}

/** Quita las etiquetas que no son de `tematica` (la campaña cambió de temática y no mandó etiquetas). */
export async function quitarEtiquetasDeOtraTematica(db: Db, campanaId: number, tematica: string): Promise<void> {
  const tematicaId = await idDeTematica(db, tematica);
  await db.query(
    `DELETE FROM campana_etiquetas ce USING etiquetas e
     WHERE ce.etiqueta_id = e.id AND ce.campana_id = $1 AND e.tematica_id IS DISTINCT FROM $2::int`,
    [campanaId, tematicaId],
  );
}

/**
 * Etiquetas de varias campañas, en orden alfabético. Las pendientes solo van si `conPendientes`
 * dice que quien mira es el creador o la supervisión de esa campaña.
 */
export async function etiquetasDeCampanas(
  ids: number[],
  conPendientes: (campanaId: number) => boolean = () => false,
): Promise<Map<number, EtiquetaDeCampana[]>> {
  const porCampana = new Map<number, EtiquetaDeCampana[]>();
  if (ids.length === 0) return porCampana;
  const r = await pool.query<{ campana_id: number; nombre: string; aprobada: boolean }>(
    `SELECT ce.campana_id, e.nombre, e.aprobada
     FROM campana_etiquetas ce JOIN etiquetas e ON e.id = ce.etiqueta_id
     WHERE ce.campana_id = ANY($1::int[])
     ORDER BY e.clave`,
    [ids],
  );
  for (const fila of r.rows) {
    const campanaId = Number(fila.campana_id);
    if (!fila.aprobada && !conPendientes(campanaId)) continue;
    const lista = porCampana.get(campanaId) ?? [];
    lista.push({ nombre: fila.nombre, pendiente: !fila.aprobada });
    porCampana.set(campanaId, lista);
  }
  return porCampana;
}

/** Nombres de todas las etiquetas de una campaña (también las pendientes), para comparar antes y después de editarla. */
export async function nombresDeEtiquetasDeCampana(campanaId: number): Promise<string[]> {
  const r = await pool.query<{ nombre: string }>(
    `SELECT e.nombre FROM campana_etiquetas ce JOIN etiquetas e ON e.id = ce.etiqueta_id WHERE ce.campana_id = $1 ORDER BY e.clave`,
    [campanaId],
  );
  return r.rows.map((f) => f.nombre);
}

/**
 * Agrega `etiquetas` (EtiquetaDeCampana[]) a cada fila de campanas antes de mapearla en la API.
 * `viewer`: con él, las pendientes se ven en las campañas que creó o supervisa; `esRoot`, en todas.
 */
export async function agregarEtiquetas(
  filas: Record<string, unknown>[],
  viewer: { id: string | number } | null,
  esRoot = false,
): Promise<void> {
  const ids = filas.map((f) => Number(f.id)).filter((id) => Number.isInteger(id) && id > 0);
  const propias = new Set(
    filas
      .filter((f) => viewer && (Number(f.creator_id) === Number(viewer.id) || Number(f.supervisor_id) === Number(viewer.id)))
      .map((f) => Number(f.id)),
  );
  const mapa = await etiquetasDeCampanas(ids, (id) => esRoot || propias.has(id));
  for (const fila of filas) fila.etiquetas = mapa.get(Number(fila.id)) ?? [];
}

// ---------------------------------------------------------------------------------------------
// Intereses del perfil

/** Ids de las etiquetas que la persona marcó en sus intereses. */
export async function etiquetasDelUsuario(usuarioId: number | string): Promise<number[]> {
  const r = await pool.query<{ etiqueta_id: number }>(
    `SELECT etiqueta_id FROM usuario_etiquetas WHERE usuario_id = $1 ORDER BY etiqueta_id`,
    [usuarioId],
  );
  return r.rows.map((f) => Number(f.etiqueta_id));
}

/**
 * Revisa las etiquetas nuevas que llegan del perfil (`etiquetasNuevas`, 2026-10-28) antes de tocar la
 * base: lista de { tematica, nombre }, hasta MAXIMO_DE_ETIQUETAS_NUEVAS_EN_PERFIL, con nombres como
 * los de las temáticas (validarNombreDeTematica) y que no sean el de una temática. Repetidas, una vez.
 */
export async function validarEtiquetasNuevas(entrada: unknown): Promise<ResultadoDelCatalogo<{ nuevas: EtiquetaNueva[] }>> {
  if (!Array.isArray(entrada)) return { ok: false, error: "Las etiquetas nuevas deben ser una lista" };
  const nuevas = new Map<string, EtiquetaNueva>();
  for (const item of entrada) {
    const tematica = String((item as EtiquetaNueva | null)?.tematica ?? "").trim();
    const validado = validarNombreDeTematica((item as EtiquetaNueva | null)?.nombre);
    if (!validado.ok) return { ok: false, error: `Etiqueta «${String((item as EtiquetaNueva | null)?.nombre ?? "")}»: ${validado.error}` };
    const esTematica = await errorDeNombreDeTematica(pool, claveDeTematica(validado.nombre));
    if (esTematica) return { ok: false, error: esTematica };
    nuevas.set(`${claveDeTematica(tematica)}|${claveDeTematica(validado.nombre)}`, { tematica, nombre: validado.nombre });
  }
  if (nuevas.size > MAXIMO_DE_ETIQUETAS_NUEVAS_EN_PERFIL) {
    return { ok: false, error: `Puedes proponer hasta ${MAXIMO_DE_ETIQUETAS_NUEVAS_EN_PERFIL} etiquetas nuevas a la vez` };
  }
  return { ok: true, nuevas: [...nuevas.values()] };
}

/**
 * Guarda las etiquetas del perfil: solo de las temáticas que la persona tiene en `intereses`,
 * aprobadas y visibles (una oculta se conserva si ya la tenía), sin repetir y hasta
 * MAXIMO_DE_ETIQUETAS_EN_PERFIL. Las de temáticas que ya no tiene se quitan.
 * Pendientes (2026-10-28): se aceptan las que propuso ella o ya tenía; `nuevas` (ya validadas con
 * validarEtiquetasNuevas) se agregan: si existe una con ese nombre en la temática se usa (aprobada o
 * pendiente) y si no, se crea pendiente (origen 'usuario') para que el SuperUsuario la revise.
 */
export async function guardarEtiquetasDelUsuario(
  usuarioId: number | string,
  entrada: unknown,
  intereses: string[],
  nuevas: EtiquetaNueva[] = [],
): Promise<ResultadoDelCatalogo> {
  if (!Array.isArray(entrada)) return { ok: false, error: "Las etiquetas deben ser una lista" };
  const pedidas = [...new Set(entrada.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (pedidas.length > MAXIMO_DE_ETIQUETAS_EN_PERFIL) {
    return { ok: false, error: `Puedes marcar hasta ${MAXIMO_DE_ETIQUETAS_EN_PERFIL} subtemáticas` };
  }
  const claves = intereses.map(claveDeTematica);
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const validas = await cliente.query<{ id: number }>(
      `SELECT e.id FROM etiquetas e JOIN tematicas t ON t.id = e.tematica_id
       WHERE e.id = ANY($1::int[]) AND t.clave = ANY($2::text[])
         AND (
           (e.aprobada AND (NOT e.oculta OR EXISTS (SELECT 1 FROM usuario_etiquetas ue WHERE ue.usuario_id = $3 AND ue.etiqueta_id = e.id)))
           OR (NOT e.aprobada AND (e.creada_por = $3
                OR EXISTS (SELECT 1 FROM usuario_etiquetas ue WHERE ue.usuario_id = $3 AND ue.etiqueta_id = e.id)))
         )`,
      [pedidas, claves, usuarioId],
    );
    const ids = validas.rows.map((f) => Number(f.id));
    for (const nueva of nuevas) {
      // Solo en temáticas que tiene y que están aprobadas y visibles.
      const tematica = await cliente.query<{ id: number }>(
        `SELECT id FROM tematicas WHERE clave = $1 AND clave = ANY($2::text[]) AND aprobada AND NOT oculta`,
        [claveDeTematica(nueva.tematica), claves],
      );
      if (!tematica.rows[0]) continue;
      const clave = claveDeTematica(nueva.nombre);
      // ON CONFLICT: ya existe en esa temática (aprobada, pendiente u oculta): se toma esa.
      const fila = await cliente.query<{ id: number; aprobada: boolean; oculta: boolean }>(
        `INSERT INTO etiquetas (tematica_id, nombre, clave, origen, creada_por, aprobada)
         VALUES ($1, $2, $3, 'usuario', $4, false)
         ON CONFLICT (tematica_id, clave) DO UPDATE SET clave = EXCLUDED.clave
         RETURNING id, aprobada, oculta`,
        [Number(tematica.rows[0].id), nueva.nombre, clave, usuarioId],
      );
      const existente = fila.rows[0];
      if (existente.aprobada && existente.oculta) {
        await cliente.query("ROLLBACK");
        return { ok: false, error: `La etiqueta «${nueva.nombre}» no está disponible` };
      }
      if (!ids.includes(Number(existente.id))) ids.push(Number(existente.id));
    }
    if (ids.length > MAXIMO_DE_ETIQUETAS_EN_PERFIL) {
      await cliente.query("ROLLBACK");
      return { ok: false, error: `Puedes marcar hasta ${MAXIMO_DE_ETIQUETAS_EN_PERFIL} subtemáticas` };
    }
    await cliente.query(`DELETE FROM usuario_etiquetas WHERE usuario_id = $1 AND NOT (etiqueta_id = ANY($2::int[]))`, [usuarioId, ids]);
    if (ids.length > 0) {
      await cliente.query(
        `INSERT INTO usuario_etiquetas (usuario_id, etiqueta_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
        [usuarioId, ids],
      );
    }
    await cliente.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

/** Quita del perfil las etiquetas de temáticas que la persona ya no tiene en sus intereses. */
export async function recortarEtiquetasDelUsuario(usuarioId: number | string, intereses: string[]): Promise<void> {
  await pool.query(
    `DELETE FROM usuario_etiquetas ue USING etiquetas e, tematicas t
     WHERE ue.etiqueta_id = e.id AND e.tematica_id = t.id AND ue.usuario_id = $1
       AND NOT (t.clave = ANY($2::text[]))`,
    [usuarioId, intereses.map(claveDeTematica)],
  );
}

// ---------------------------------------------------------------------------------------------
// Panel del SuperUsuario (/sistema/tematicas). La página y las server actions verifican la sesión.

export type EtiquetaDelPanel = {
  id: number;
  tematicaId: number;
  nombre: string;
  origen: "panel" | "usuario";
  aprobada: boolean;
  oculta: boolean;
  creadaEl: string;
  campanas: number;
  personas: number;
};

/** Todas las etiquetas, por id de temática: primero las pendientes y luego en orden alfabético. */
export async function listarEtiquetasDelPanel(): Promise<Map<number, EtiquetaDelPanel[]>> {
  const r = await pool.query<{
    id: number;
    tematica_id: number;
    nombre: string;
    origen: "panel" | "usuario";
    aprobada: boolean;
    oculta: boolean;
    created_at: Date;
    campanas: string;
    personas: string;
  }>(
    `SELECT e.id, e.tematica_id, e.nombre, e.origen, e.aprobada, e.oculta, e.created_at,
            (SELECT COUNT(*) FROM campana_etiquetas ce WHERE ce.etiqueta_id = e.id) AS campanas,
            (SELECT COUNT(*) FROM usuario_etiquetas ue WHERE ue.etiqueta_id = e.id) AS personas
     FROM etiquetas e
     ORDER BY e.aprobada, e.clave`,
  );
  const porTematica = new Map<number, EtiquetaDelPanel[]>();
  for (const f of r.rows) {
    const lista = porTematica.get(Number(f.tematica_id)) ?? [];
    lista.push({
      id: Number(f.id),
      tematicaId: Number(f.tematica_id),
      nombre: f.nombre,
      origen: f.origen,
      aprobada: f.aprobada,
      oculta: f.oculta,
      creadaEl: f.created_at.toISOString(),
      campanas: Number(f.campanas),
      personas: Number(f.personas),
    });
    porTematica.set(Number(f.tematica_id), lista);
  }
  return porTematica;
}

/** Etiquetas que esperan revisión. Se suman al número de pendientes de "Temáticas" en el menú. */
export async function contarEtiquetasPendientes(): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM etiquetas WHERE NOT aprobada`);
  return Number(r.rows[0]?.n ?? 0);
}

/**
 * Una etiqueta no puede llamarse igual que una temática (2026-10-27, a pedido del usuario): la
 * etiqueta debe ser más específica que su temática, no otra temática ("Biodiversidad" dentro de
 * Medio ambiente). Devuelve el mensaje, o null si el nombre está libre.
 */
async function errorDeNombreDeTematica(db: Db, clave: string): Promise<string | null> {
  const r = await db.query<{ nombre: string }>(`SELECT nombre FROM tematicas WHERE clave = $1`, [clave]);
  return r.rows[0] ? `«${r.rows[0].nombre}» ya es una temática: usa una etiqueta más específica.` : null;
}

async function errorDeRepetida(tematicaId: number, clave: string, sinContarId?: number): Promise<string | null> {
  const r = await pool.query<{ nombre: string; oculta: boolean }>(
    `SELECT nombre, oculta FROM etiquetas WHERE tematica_id = $1 AND clave = $2 AND ($3::int IS NULL OR id <> $3)`,
    [tematicaId, clave, sinContarId ?? null],
  );
  const fila = r.rows[0];
  if (!fila) return null;
  return fila.oculta ? `Ya existe «${fila.nombre}» en esta temática, oculta. Usa "Mostrar".` : `Ya existe «${fila.nombre}» en esta temática.`;
}

/** Crea una etiqueta del panel en una temática: aprobada y visible desde ya. */
export async function crearEtiqueta(tematicaId: number, nombre: string): Promise<ResultadoDelCatalogo<{ id: number; tematica: string }>> {
  const tematica = await pool.query<{ nombre: string }>(`SELECT nombre FROM tematicas WHERE id = $1`, [tematicaId]);
  if (!tematica.rows[0]) return { ok: false, error: "La temática no existe." };
  const clave = claveDeTematica(nombre);
  const esTematica = await errorDeNombreDeTematica(pool, clave);
  if (esTematica) return { ok: false, error: esTematica };
  const repetida = await errorDeRepetida(tematicaId, clave);
  if (repetida) return { ok: false, error: repetida };
  try {
    const r = await pool.query<{ id: number }>(
      `INSERT INTO etiquetas (tematica_id, nombre, clave, origen, aprobada) VALUES ($1, $2, $3, 'panel', true) RETURNING id`,
      [tematicaId, nombre, clave],
    );
    return { ok: true, id: Number(r.rows[0].id), tematica: tematica.rows[0].nombre };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, error: `Ya existe «${nombre}» en esta temática.` };
    throw error;
  }
}

/** Cambia el nombre de una etiqueta. Campañas y perfiles la tienen por id: ya muestran el nuevo. */
export async function renombrarEtiqueta(id: number, nombre: string): Promise<ResultadoDelCatalogo<{ anterior: string }>> {
  const actual = await pool.query<{ nombre: string; tematica_id: number }>(`SELECT nombre, tematica_id FROM etiquetas WHERE id = $1`, [id]);
  const fila = actual.rows[0];
  if (!fila) return { ok: false, error: "La etiqueta no existe." };
  const clave = claveDeTematica(nombre);
  const esTematica = await errorDeNombreDeTematica(pool, clave);
  if (esTematica) return { ok: false, error: esTematica };
  const repetida = await errorDeRepetida(Number(fila.tematica_id), clave, id);
  if (repetida) return { ok: false, error: repetida };
  try {
    await pool.query(`UPDATE etiquetas SET nombre = $2, clave = $3 WHERE id = $1`, [id, nombre, clave]);
    return { ok: true, anterior: fila.nombre };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { ok: false, error: `Ya existe «${nombre}» en esta temática.` };
    throw error;
  }
}

/** Borra una etiqueta que ninguna campaña usa (si alguna la usa, se oculta); se quita de los perfiles. */
export async function borrarEtiqueta(id: number): Promise<ResultadoDelCatalogo<{ nombre: string; perfiles: number }>> {
  const usada = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM campana_etiquetas WHERE etiqueta_id = $1`, [id]);
  const n = usada.rows[0]?.n ?? 0;
  if (n > 0) {
    return {
      ok: false,
      error: `No se puede borrar: la ${n === 1 ? "usa 1 campaña" : `usan ${n} campañas`}. Ocúltala para que ya no se ofrezca.`,
    };
  }
  const perfiles = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM usuario_etiquetas WHERE etiqueta_id = $1`, [id]);
  // usuario_etiquetas se borra en cascada.
  const r = await pool.query<{ nombre: string }>(
    `DELETE FROM etiquetas WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM campana_etiquetas WHERE etiqueta_id = $1) RETURNING nombre`,
    [id],
  );
  if (!r.rows[0]) return { ok: false, error: "La etiqueta no existe o ya la usa una campaña." };
  return { ok: true, nombre: r.rows[0].nombre, perfiles: perfiles.rows[0]?.n ?? 0 };
}

/** Oculta o vuelve a mostrar una etiqueta. Devuelve su nombre, o null si no existe. */
export async function cambiarVisibilidadDeEtiqueta(id: number, oculta: boolean): Promise<string | null> {
  const r = await pool.query<{ nombre: string }>(`UPDATE etiquetas SET oculta = $2 WHERE id = $1 RETURNING nombre`, [id, oculta]);
  return r.rows[0]?.nombre ?? null;
}

/**
 * Quién propuso una etiqueta pendiente y dónde la tiene (2026-10-28), para avisarle cuando el
 * SuperUsuario la revisa. Se lee antes de aprobar o rechazar (rechazar la borra). Null si no existe,
 * ya estaba aprobada o no tiene autor (la cuenta se borró).
 */
export async function propuestaDeEtiqueta(
  id: number,
): Promise<{ usuarioId: number; nombre: string; tematica: string; enPerfil: boolean; enCampana: boolean } | null> {
  const r = await pool.query<{ creada_por: number; nombre: string; tematica: string; en_perfil: boolean; en_campana: boolean }>(
    `SELECT e.creada_por, e.nombre, t.nombre AS tematica,
            EXISTS (SELECT 1 FROM usuario_etiquetas ue WHERE ue.etiqueta_id = e.id AND ue.usuario_id = e.creada_por) AS en_perfil,
            EXISTS (SELECT 1 FROM campana_etiquetas ce JOIN campanas c ON c.id = ce.campana_id
                    WHERE ce.etiqueta_id = e.id AND c.creator_id = e.creada_por) AS en_campana
     FROM etiquetas e JOIN tematicas t ON t.id = e.tematica_id
     WHERE e.id = $1 AND NOT e.aprobada AND e.creada_por IS NOT NULL`,
    [id],
  );
  const f = r.rows[0];
  return f ? { usuarioId: Number(f.creada_por), nombre: f.nombre, tematica: f.tematica, enPerfil: f.en_perfil, enCampana: f.en_campana } : null;
}

/** Aprueba una etiqueta que propuso un creador: desde ahora se ofrece a todos y se ve en su campaña. */
export async function aprobarEtiqueta(id: number): Promise<string | null> {
  const r = await pool.query<{ nombre: string }>(
    `UPDATE etiquetas SET aprobada = true, oculta = false WHERE id = $1 RETURNING nombre`,
    [id],
  );
  return r.rows[0]?.nombre ?? null;
}

/**
 * Rechaza una etiqueta pendiente: se borra y, en cascada, se quita de las campañas que la tenían
 * (solo pudo ponerla quien la propuso). Devuelve su nombre y de cuántas campañas se quitó, o null
 * si no existe o ya estaba aprobada.
 */
export async function rechazarEtiqueta(id: number): Promise<{ nombre: string; campanas: number } | null> {
  const usada = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM campana_etiquetas WHERE etiqueta_id = $1`, [id]);
  const r = await pool.query<{ nombre: string }>(`DELETE FROM etiquetas WHERE id = $1 AND NOT aprobada RETURNING nombre`, [id]);
  if (!r.rows[0]) return null;
  return { nombre: r.rows[0].nombre, campanas: usada.rows[0]?.n ?? 0 };
}
