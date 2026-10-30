// Tabla de líderes (2026-10-15): de dónde salen los datos. Server-only: aquí van las consultas a
// Postgres. La usan la landing (obtenerTablaDeLideres: las 6 primeras personas de cada categoría) y
// /lideres (obtenerClasificacion: la tabla completa, paginada). El contrato está en tipos.ts.
//
// Reglas (decisiones del usuario, 2026-10-13; ver references/dominio.md § 7):
// - Aportes: aportes con status = 'aceptado' por user_id. Los anónimos (user_id NULL) no cuentan.
//   Desde siempre. Solo salen personas con al menos un aporte aprobado.
// - Nivel: usuarios.level, con xp_total en `detalle`. Solo salen personas con XP (> 0): hoy nada
//   otorga XP (dominio.md § 7), así que esta categoría queda vacía hasta que la gamificación lo haga.
// - Temática: aportes aprobados por persona dentro de las campañas de cada temática. Las campañas
//   viejas pueden traerla solo en campanas.tag, de ahí el COALESCE.
// - No salen: cuentas dadas de baja (eliminada_en) ni suspendidas o baneadas (SQL_SANCION_BLOQUEANTE).
//   El SuperUsuario no tiene fila en `usuarios`.
// - Privacidad: nombre como "Carlos P." (nombreParaMostrar) y avatar solo si es un ícono
//   predefinido; la foto de perfil es privada y sale como iniciales.
//
// Estas consultas corren al prerenderizar la landing (revalidate) y `next build` no tiene base de
// datos (regla 12): ante un error devuelven la tabla vacía y la sección no se pinta.

import { pool } from "@/lib/db";
import { SQL_SANCION_BLOQUEANTE } from "@/lib/sanciones";
import type { IconoPredefinido } from "@/lib/usuarios/avatar-opciones";
import {
  LIDERES_POR_CATEGORIA,
  LIDERES_POR_PAGINA,
  nombreParaMostrar,
  type CategoriaDeClasificacion,
  type Lider,
  type TablaDeLideres,
} from "./tipos";

const nf = new Intl.NumberFormat("es-MX");

/** Quién cuenta para la tabla: sin baja y sin sanción bloqueante. Usa el alias `u` de `usuarios`. */
const SQL_PERSONA_ELEGIBLE = `u.eliminada_en IS NULL AND NOT (${SQL_SANCION_BLOQUEANTE})`;

/** Temática de una campaña (las viejas la traen solo en `tag`). Usa el alias `c` de `campanas`. */
const SQL_TEMATICA = `COALESCE(NULLIF(c.tematica, ''), c.tag)`;

/**
 * Desempate entre personas con el mismo valor: queda arriba quien llegó a ese valor antes (la fecha
 * de su último aporte aprobado, la más antigua) y, si aun así empatan, la cuenta más antigua.
 * TODO(dominio): provisional; el usuario no ha decidido el desempate.
 */
const SQL_ULTIMO_APORTE = `MAX(COALESCE(a.reviewed_at, a.submitted_at))`;

type FilaDeLider = {
  id: number;
  nombre: string;
  apellidos: string;
  avatar: string | null;
  valor: number;
  xp_total?: number;
};

const ICONOS: ReadonlySet<string> = new Set<IconoPredefinido>(["masculino", "femenino", "otro"]);

function aLider(fila: FilaDeLider, categoria: CategoriaDeClasificacion): Lider {
  return {
    usuarioId: fila.id,
    nombre: nombreParaMostrar(fila.nombre, fila.apellidos),
    // La foto de perfil es privada: solo pasan los íconos predefinidos; lo demás, iniciales.
    avatar: fila.avatar && ICONOS.has(fila.avatar) ? (fila.avatar as IconoPredefinido) : null,
    valor: Number(fila.valor),
    ...(categoria === "nivel" && fila.xp_total !== undefined ? { detalle: `${nf.format(fila.xp_total)} XP` } : {}),
  };
}

export type ClasificacionPaginada = {
  lideres: Lider[];
  /** Personas en la clasificación completa (no solo en la página). */
  total: number;
};

/**
 * La clasificación completa de una categoría, de mayor a menor, paginada. `tematica` solo cuenta en
 * la categoría "tematica". `pagina` empieza en 1.
 */
export async function obtenerClasificacion(opciones: {
  categoria: CategoriaDeClasificacion;
  tematica?: string;
  pagina?: number;
  porPagina?: number;
}): Promise<ClasificacionPaginada> {
  const { categoria, tematica } = opciones;
  const porPagina = opciones.porPagina ?? LIDERES_POR_PAGINA;
  const pagina = Math.max(1, Math.floor(opciones.pagina ?? 1));
  const desplazamiento = (pagina - 1) * porPagina;

  try {
    if (categoria === "tematica" && !tematica) return { lideres: [], total: 0 };

    const filas =
      categoria === "nivel"
        ? await pool.query<FilaDeLider & { total: number }>(
            `SELECT u.id, u.nombre, u.apellidos, u.avatar, u.level AS valor, u.xp_total,
                    (COUNT(*) OVER ())::int AS total
             FROM usuarios u
             WHERE u.xp_total > 0 AND ${SQL_PERSONA_ELEGIBLE}
             ORDER BY u.level DESC, u.xp_total DESC, u.id ASC
             LIMIT $1 OFFSET $2`,
            [porPagina, desplazamiento]
          )
        : categoria === "aportes"
          ? await pool.query<FilaDeLider & { total: number }>(
              `SELECT u.id, u.nombre, u.apellidos, u.avatar, COUNT(a.id)::int AS valor,
                      (COUNT(*) OVER ())::int AS total
               FROM aportes a
               JOIN usuarios u ON u.id = a.user_id
               WHERE a.status = 'aceptado' AND ${SQL_PERSONA_ELEGIBLE}
               GROUP BY u.id
               ORDER BY valor DESC, ${SQL_ULTIMO_APORTE} ASC, u.id ASC
               LIMIT $1 OFFSET $2`,
              [porPagina, desplazamiento]
            )
          : await pool.query<FilaDeLider & { total: number }>(
              `SELECT u.id, u.nombre, u.apellidos, u.avatar, COUNT(a.id)::int AS valor,
                      (COUNT(*) OVER ())::int AS total
               FROM aportes a
               JOIN campanas c ON c.id = a.campaign_id
               JOIN usuarios u ON u.id = a.user_id
               WHERE a.status = 'aceptado' AND ${SQL_TEMATICA} = $3 AND ${SQL_PERSONA_ELEGIBLE}
               GROUP BY u.id
               ORDER BY valor DESC, ${SQL_ULTIMO_APORTE} ASC, u.id ASC
               LIMIT $1 OFFSET $2`,
              [porPagina, desplazamiento, tematica ?? ""]
            );

    if (filas.rows.length > 0) {
      return { lideres: filas.rows.map((f) => aLider(f, categoria)), total: filas.rows[0].total };
    }
    // Página fuera de rango (o tabla vacía): el total real sirve para que la pantalla corrija la página.
    return { lideres: [], total: await contarClasificacion(categoria, tematica) };
  } catch (error) {
    console.error("No se pudo leer la clasificación:", error);
    return { lideres: [], total: 0 };
  }
}

/** Personas en la clasificación completa, para cuando se pide una página que no existe. */
async function contarClasificacion(categoria: CategoriaDeClasificacion, tematica?: string): Promise<number> {
  if (categoria === "nivel") {
    const r = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM usuarios u WHERE u.xp_total > 0 AND ${SQL_PERSONA_ELEGIBLE}`
    );
    return r.rows[0]?.n ?? 0;
  }
  const r = await pool.query<{ n: number }>(
    `SELECT COUNT(DISTINCT a.user_id)::int AS n
     FROM aportes a
     JOIN campanas c ON c.id = a.campaign_id
     JOIN usuarios u ON u.id = a.user_id
     WHERE a.status = 'aceptado' AND ${SQL_PERSONA_ELEGIBLE}
       ${categoria === "tematica" ? `AND ${SQL_TEMATICA} = $1` : ""}`,
    categoria === "tematica" ? [tematica ?? ""] : []
  );
  return r.rows[0]?.n ?? 0;
}

/**
 * Temáticas con al menos una persona en la clasificación, de la que tiene más aportes aprobados a la
 * que tiene menos. La primera es la que se muestra al abrir el selector.
 */
export async function obtenerTematicasConLideres(): Promise<string[]> {
  try {
    const r = await pool.query<{ tematica: string }>(
      `SELECT ${SQL_TEMATICA} AS tematica
       FROM aportes a
       JOIN campanas c ON c.id = a.campaign_id
       JOIN usuarios u ON u.id = a.user_id
       WHERE a.status = 'aceptado' AND ${SQL_PERSONA_ELEGIBLE}
         AND COALESCE(NULLIF(c.tematica, ''), c.tag) <> ''
       GROUP BY 1
       ORDER BY COUNT(a.id) DESC, 1 ASC`
    );
    return r.rows.map((f) => f.tematica);
  } catch (error) {
    console.error("No se pudieron leer las temáticas de la clasificación:", error);
    return [];
  }
}

/**
 * Las primeras personas de cada categoría (LIDERES_POR_CATEGORIA), ya ordenadas de mayor a menor,
 * para la landing. Las temáticas salen con una sola consulta (ROW_NUMBER por temática).
 */
export async function obtenerTablaDeLideres(): Promise<TablaDeLideres> {
  const vacia: TablaDeLideres = { aportes: [], nivel: [], tematicas: [] };
  try {
    const [aportes, nivel, porTematica] = await Promise.all([
      obtenerClasificacion({ categoria: "aportes", porPagina: LIDERES_POR_CATEGORIA }),
      obtenerClasificacion({ categoria: "nivel", porPagina: LIDERES_POR_CATEGORIA }),
      pool.query<FilaDeLider & { tematica: string }>(
        `WITH conteo AS (
           SELECT ${SQL_TEMATICA} AS tematica, u.id, u.nombre, u.apellidos, u.avatar,
                  COUNT(a.id)::int AS valor, ${SQL_ULTIMO_APORTE} AS ultimo
           FROM aportes a
           JOIN campanas c ON c.id = a.campaign_id
           JOIN usuarios u ON u.id = a.user_id
           WHERE a.status = 'aceptado' AND ${SQL_PERSONA_ELEGIBLE}
             AND COALESCE(NULLIF(c.tematica, ''), c.tag) <> ''
           GROUP BY 1, u.id
         ), ordenado AS (
           SELECT *,
                  ROW_NUMBER() OVER (PARTITION BY tematica ORDER BY valor DESC, ultimo ASC, id ASC) AS puesto,
                  SUM(valor) OVER (PARTITION BY tematica) AS aportes_de_la_tematica
           FROM conteo
         )
         SELECT tematica, id, nombre, apellidos, avatar, valor
         FROM ordenado
         WHERE puesto <= $1
         ORDER BY aportes_de_la_tematica DESC, tematica ASC, puesto ASC`,
        [LIDERES_POR_CATEGORIA]
      ),
    ]);

    // Las filas llegan agrupadas por temática y ordenadas; basta con ir juntándolas.
    const tematicas: TablaDeLideres["tematicas"] = [];
    for (const fila of porTematica.rows) {
      let grupo = tematicas[tematicas.length - 1];
      if (!grupo || grupo.tematica !== fila.tematica) {
        grupo = { tematica: fila.tematica, lideres: [] };
        tematicas.push(grupo);
      }
      grupo.lideres.push(aLider(fila, "tematica"));
    }

    return { aportes: aportes.lideres, nivel: nivel.lideres, tematicas };
  } catch (error) {
    console.error("No se pudo armar la tabla de líderes:", error);
    return vacia;
  }
}

/** ¿Hay algo que mostrar en la landing? Sin datos, la sección no se pinta. */
export function tablaTieneDatos(tabla: TablaDeLideres): boolean {
  return tabla.aportes.length > 2 || tabla.nivel.length > 2 || tabla.tematicas.length > 2;
}
