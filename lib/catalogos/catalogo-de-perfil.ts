// Catálogo de un campo de texto del perfil (2026-10-26): especialidades (usuarios.specialty) y
// organizaciones (usuarios.organizacion). Mismas reglas para los dos (decisiones del usuario):
//   - Lo que escribe una persona al guardar su perfil entra al catálogo y se sugiere a todos.
//   - El SuperUsuario crea, edita y borra en el panel las que no son base. Renombrar cambia el nombre
//     también en los perfiles (y, si el catálogo lo pide, en una columna de campañas); borrar deja
//     sin ese dato a los perfiles que lo tenían.
// Cada catálogo es una tabla con id, nombre, clave (UNIQUE, sin acentos ni mayúsculas), origen
// ('base' | 'usuario' | 'panel'), creada_por y created_at (lib/db-schema.ts). Los nombres de tabla y
// columna vienen de la configuración (constantes del código), nunca del usuario; los valores siempre
// van parametrizados.

import { pool } from "@/lib/db";

export type OrigenDelCatalogo = "base" | "usuario" | "panel";

export type ElementoDelPanel = {
  id: number;
  nombre: string;
  origen: OrigenDelCatalogo;
  creadaEl: string;
  /** Perfiles activos (sin baja) que lo tienen con ese nombre. */
  personas: number;
  /** Campañas que lo usan (solo si el catálogo tiene `columnaDeCampanas`). */
  campanas: number;
};

export type ResultadoDelCatalogo<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Validacion = { ok: true; nombre: string } | { ok: false; error: string };

export type ConfiguracionDeCatalogo = {
  tabla: "especialidades" | "organizaciones";
  /** Columna de `usuarios` que guarda el nombre. */
  columnaDeUsuarios: "specialty" | "organizacion";
  /** Columna de `campanas` que guarda el mismo nombre y se renombra con él (opcional). */
  columnaDeCampanas?: "organizer";
  validar: (entrada: string) => Validacion;
  clave: (nombre: string) => string;
  /** "La especialidad", "La organización": para los mensajes. */
  articulo: string;
};

export function crearCatalogo(c: ConfiguracionDeCatalogo) {
  const { tabla, columnaDeUsuarios: col } = c;

  /** Todos los nombres, en orden alfabético sin importar acentos: lo que sugieren los formularios. */
  async function visibles(): Promise<string[]> {
    const r = await pool.query<{ nombre: string }>(`SELECT nombre FROM ${tabla} ORDER BY clave`);
    return r.rows.map((f) => f.nombre);
  }

  /**
   * Lo que se va a guardar en un perfil, ya validado. Vacío → null (se borra). Si ya existe (por
   * clave), con el nombre del catálogo; si no, se da de alta y se sugiere a todos. Con
   * `darDeAlta: false` (el registro: la cuenta aún no está verificada) uno nuevo se guarda en el
   * perfil pero no entra al catálogo.
   */
  async function resolver(
    entrada: string,
    usuarioId: number | null,
    { darDeAlta = true }: { darDeAlta?: boolean } = {},
  ): Promise<{ ok: true; valor: string | null } | { ok: false; error: string }> {
    if (entrada.trim() === "") return { ok: true, valor: null };
    const validada = c.validar(entrada);
    if (!validada.ok) return validada;
    const clave = c.clave(validada.nombre);
    if (!darDeAlta) {
      const existente = await pool.query<{ nombre: string }>(`SELECT nombre FROM ${tabla} WHERE clave = $1`, [clave]);
      return { ok: true, valor: existente.rows[0]?.nombre ?? validada.nombre };
    }
    // DO UPDATE sin cambios para que RETURNING traiga el nombre del que ya existía.
    const r = await pool.query<{ nombre: string }>(
      `INSERT INTO ${tabla} (nombre, clave, origen, creada_por) VALUES ($1, $2, 'usuario', $3)
       ON CONFLICT (clave) DO UPDATE SET clave = EXCLUDED.clave
       RETURNING nombre`,
      [validada.nombre, clave, usuarioId],
    );
    return { ok: true, valor: r.rows[0].nombre };
  }

  /**
   * Todo el catálogo para el panel: primero los de usuarios y los del panel (del más nuevo al más
   * viejo), al final los base en orden alfabético. `q` busca sin importar acentos.
   */
  async function listarDelPanel(q?: string): Promise<ElementoDelPanel[]> {
    const busqueda = c.clave(q ?? "");
    const campanas = c.columnaDeCampanas
      ? `(SELECT COUNT(*)::int FROM campanas ca WHERE ca.${c.columnaDeCampanas} = e.nombre)`
      : "0";
    const r = await pool.query<{ id: number; nombre: string; origen: OrigenDelCatalogo; created_at: Date; personas: number; campanas: number }>(
      `SELECT e.id, e.nombre, e.origen, e.created_at,
              (SELECT COUNT(*)::int FROM usuarios u WHERE u.${col} = e.nombre AND u.eliminada_en IS NULL) AS personas,
              ${campanas} AS campanas
       FROM ${tabla} e
       WHERE $1 = '' OR e.clave LIKE '%' || $1 || '%'
       ORDER BY e.origen <> 'base' DESC, CASE WHEN e.origen <> 'base' THEN e.created_at END DESC, e.clave`,
      [busqueda],
    );
    return r.rows.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      origen: f.origen,
      creadaEl: f.created_at.toISOString(),
      personas: f.personas,
      campanas: f.campanas,
    }));
  }

  async function errorDeRepetido(clave: string, sinContarId?: number): Promise<string | null> {
    const r = await pool.query<{ nombre: string }>(
      `SELECT nombre FROM ${tabla} WHERE clave = $1 AND ($2::int IS NULL OR id <> $2)`,
      [clave, sinContarId ?? null],
    );
    return r.rows[0] ? `Ya existe «${r.rows[0].nombre}».` : null;
  }

  /** Alta desde el panel (origen 'panel'): se sugiere a todos desde ya. */
  async function crear(nombre: string): Promise<ResultadoDelCatalogo<{ id: number }>> {
    const clave = c.clave(nombre);
    const repetido = await errorDeRepetido(clave);
    if (repetido) return { ok: false, error: repetido };
    try {
      const r = await pool.query<{ id: number }>(
        `INSERT INTO ${tabla} (nombre, clave, origen) VALUES ($1, $2, 'panel') RETURNING id`,
        [nombre, clave],
      );
      return { ok: true, id: r.rows[0].id };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return { ok: false, error: `Ya existe «${nombre}».` };
      throw error;
    }
  }

  /** Cambia el nombre de uno que no es base y, en la misma transacción, en perfiles (y campañas). */
  async function renombrar(
    id: number,
    nombre: string,
  ): Promise<ResultadoDelCatalogo<{ anterior: string; perfiles: number; campanas: number }>> {
    const clave = c.clave(nombre);
    const repetido = await errorDeRepetido(clave, id);
    if (repetido) return { ok: false, error: repetido };

    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      const fila = await cliente.query<{ nombre: string; origen: OrigenDelCatalogo }>(
        `SELECT nombre, origen FROM ${tabla} WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const actual = fila.rows[0];
      if (!actual || actual.origen === "base") {
        await cliente.query("ROLLBACK");
        return { ok: false, error: actual ? `${c.articulo} base no se edita.` : `${c.articulo} no existe.` };
      }
      if (actual.nombre === nombre) {
        await cliente.query("ROLLBACK");
        return { ok: true, anterior: actual.nombre, perfiles: 0, campanas: 0 };
      }
      await cliente.query(`UPDATE ${tabla} SET nombre = $2, clave = $3 WHERE id = $1`, [id, nombre, clave]);
      const perfiles = await cliente.query(
        `UPDATE usuarios SET ${col} = $2, updated_at = NOW() WHERE ${col} = $1`,
        [actual.nombre, nombre],
      );
      const campanas = c.columnaDeCampanas
        ? await cliente.query(`UPDATE campanas SET ${c.columnaDeCampanas} = $2 WHERE ${c.columnaDeCampanas} = $1`, [actual.nombre, nombre])
        : null;
      await cliente.query("COMMIT");
      return { ok: true, anterior: actual.nombre, perfiles: perfiles.rowCount ?? 0, campanas: campanas?.rowCount ?? 0 };
    } catch (error) {
      await cliente.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505") return { ok: false, error: `Ya existe «${nombre}».` };
      throw error;
    } finally {
      cliente.release();
    }
  }

  /** Borra uno que no es base; los perfiles que lo tenían quedan sin ese dato. Las campañas no cambian. */
  async function borrar(id: number): Promise<ResultadoDelCatalogo<{ nombre: string; perfiles: number }>> {
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      const fila = await cliente.query<{ nombre: string }>(
        `DELETE FROM ${tabla} WHERE id = $1 AND origen <> 'base' RETURNING nombre`,
        [id],
      );
      const nombre = fila.rows[0]?.nombre;
      if (!nombre) {
        await cliente.query("ROLLBACK");
        return { ok: false, error: `${c.articulo} no existe o es base (las base no se borran).` };
      }
      const perfiles = await cliente.query(
        `UPDATE usuarios SET ${col} = NULL, updated_at = NOW() WHERE ${col} = $1`,
        [nombre],
      );
      await cliente.query("COMMIT");
      return { ok: true, nombre, perfiles: perfiles.rowCount ?? 0 };
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
  }

  return { visibles, resolver, listarDelPanel, crear, renombrar, borrar };
}
