// Celebraciones pendientes de quien tiene la sesión (2026-11-16; lienzo aprobado el mismo día; RF-GAM-84). Documento:
// claude/pantallas-v12/celebracion-propuesta.md. Tipos en celebraciones-tipos.ts.
//
// Pendiente = fila de rango_ascensos o medalla_ascensos con celebracion_vista_en sin fecha. Se marcan vistas cuando la
// persona cierra la celebración (POST /api/progreso/celebraciones), así que se ven una vez: en vivo si estaba en la app
// o al volver. Varios rangos pendientes se celebran juntos (el último, con los intermedios nombrados); los niveles de
// una medalla, también (el último, con los intermedios). Nombres, niveles, umbrales e ilustraciones salen del catálogo.

import { pool } from "@/lib/db";
import { imagenDeMedalla } from "./recursos";
import { entregarObjetosDeMisiones } from "./inventario";
import {
  MEDIDAS_CON_FUEGO,
  type CelebracionDeMedalla,
  type CelebracionDeRango,
  type CelebracionesPendientes,
  type CelebracionesVistas,
  type RecompensaDeRango,
} from "./celebraciones-tipos";

/** Las recompensas guardadas que la celebración sabe mostrar; cualquier otra se ignora. */
function recompensasDe(guardadas: unknown): RecompensaDeRango[] {
  if (!Array.isArray(guardadas)) return [];
  const salida: RecompensaDeRango[] = [];
  for (const r of guardadas as Record<string, unknown>[]) {
    if (r?.tipo === "etapa_avatar" && typeof r.etapa === "number") salida.push({ tipo: "etapa_avatar", etapa: r.etapa });
    else if (r?.tipo === "insignia" && typeof r.rango === "number") salida.push({ tipo: "insignia", rango: r.rango });
    else if (r?.tipo === "coleccionable" && typeof r.nombre === "string") salida.push({ tipo: "coleccionable", nombre: r.nombre });
  }
  return salida;
}

async function rangoPendiente(usuarioId: number | string): Promise<CelebracionDeRango | null> {
  const { rows } = await pool.query<{ id: number; rango: number; nombre: string; recompensas: unknown }>(
    `SELECT ra.id, ra.rango, r.nombre, ra.recompensas
        FROM rango_ascensos ra
        JOIN rangos r ON r.numero = ra.rango
      WHERE ra.usuario_id = $1 AND ra.celebracion_vista_en IS NULL
      ORDER BY ra.rango`,
    [usuarioId],
  );
  if (rows.length === 0) return null;
  const ultimo = rows[rows.length - 1];
  const catalogo = await pool.query<{ numero: number; nombre: string; total: number }>(
    `SELECT numero, nombre, COUNT(*) OVER ()::int AS total FROM rangos ORDER BY numero`,
  );
  const siguiente = catalogo.rows.find((r) => r.numero === ultimo.rango + 1);
  const avistado = catalogo.rows.find((r) => r.numero === ultimo.rango + 2);
  return {
    ids: rows.map((r) => r.id),
    anterior: rows[0].rango - 1,
    numero: ultimo.rango,
    nombre: ultimo.nombre,
    total: catalogo.rows[0]?.total ?? ultimo.rango,
    intermedios: rows.slice(0, -1).map((r) => ({ numero: r.rango, nombre: r.nombre })),
    recompensas: recompensasDe(ultimo.recompensas),
    siguiente: siguiente ? { numero: siguiente.numero, nombre: siguiente.nombre } : null,
    avistado: avistado?.numero ?? null,
  };
}

async function medallasPendientes(usuarioId: number | string): Promise<CelebracionDeMedalla[]> {
  const { rows } = await pool.query<{ id: number; medalla_id: number; nivel: number; clave: string; nombre: string; mide: string | null; valor: number }>(
    `SELECT ma.id, ma.medalla_id, ma.nivel, m.clave, m.nombre, m.mide, COALESCE(mu.valor_actual, 0)::int AS valor
        FROM medalla_ascensos ma
        JOIN medallas m ON m.id = ma.medalla_id
        LEFT JOIN medallas_usuario mu ON mu.usuario_id = ma.usuario_id AND mu.medalla_id = ma.medalla_id
      WHERE ma.usuario_id = $1 AND ma.celebracion_vista_en IS NULL AND m.activa AND m.clave IS NOT NULL
      ORDER BY m.orden NULLS LAST, m.id, ma.nivel`,
    [usuarioId],
  );
  if (rows.length === 0) return [];
  const nivelesR = await pool.query<{ medalla_id: number; nivel: number; nombre: string; umbral: number; ilustracion: string | null }>(
    `SELECT medalla_id, nivel, nombre, umbral, ilustracion_path AS ilustracion
        FROM medalla_niveles WHERE medalla_id = ANY($1::int[]) ORDER BY medalla_id, nivel`,
    [[...new Set(rows.map((r) => r.medalla_id))]],
  );

  const porMedalla = new Map<number, typeof rows>();
  for (const r of rows) porMedalla.set(r.medalla_id, [...(porMedalla.get(r.medalla_id) ?? []), r]);

  const salida: CelebracionDeMedalla[] = [];
  for (const [medallaId, filas] of porMedalla) {
    const niveles = nivelesR.rows.filter((n) => n.medalla_id === medallaId);
    const primero = filas[0];
    const ultimo = filas[filas.length - 1];
    const nivel = niveles.find((n) => n.nivel === ultimo.nivel);
    if (!nivel) continue;
    const nivelAntes = primero.nivel - 1;
    // Sin nivel antes: la ilustración del nivel 1, que la celebración dibuja en gris (como la pantalla de Medallas).
    const antes = niveles.find((n) => n.nivel === Math.max(1, nivelAntes)) ?? nivel;
    const siguiente = niveles.find((n) => n.nivel === ultimo.nivel + 1);
    salida.push({
      ids: filas.map((f) => f.id),
      clave: ultimo.clave,
      nombre: ultimo.nombre,
      mide: ultimo.mide,
      conFuego: MEDIDAS_CON_FUEGO.has(ultimo.mide ?? ""),
      nivelAntes,
      nivel: ultimo.nivel,
      totalNiveles: niveles.length,
      nombreDelNivel: nivel.nombre,
      intermedios: filas
        .slice(0, -1)
        .map((f) => niveles.find((n) => n.nivel === f.nivel)?.nombre)
        .filter((nombre): nombre is string => Boolean(nombre)),
      imagenAntes: imagenDeMedalla(ultimo.clave, antes.nivel, antes.nombre, 256, antes.ilustracion),
      imagen: imagenDeMedalla(ultimo.clave, nivel.nivel, nivel.nombre, 256, nivel.ilustracion),
      valor: ultimo.valor,
      siguiente: siguiente ? { nombre: siguiente.nombre, umbral: siguiente.umbral } : null,
    });
  }
  return salida;
}

/**
 * Nunca lanza: si falla, no hay celebración (lo pendiente sigue pendiente y sale en la siguiente carga). La persona está
 * en la app: se activan sus potenciadores guardados y se entregan los objetos que ya caben; los que no, se preguntan.
 */
export async function obtenerCelebracionesPendientes(usuarioId: number | string): Promise<CelebracionesPendientes> {
  try {
    const objetos = await entregarObjetosDeMisiones(usuarioId, { presente: true });
    const [rango, medallas] = await Promise.all([rangoPendiente(usuarioId), medallasPendientes(usuarioId)]);
    return { rango, medallas, objetos };
  } catch (error) {
    console.error(`Error leyendo las celebraciones pendientes del usuario ${usuarioId}`, error);
    return { rango: null, medallas: [], objetos: [] };
  }
}

/** Marca vistas las celebraciones cerradas. Solo las de la persona y solo las que seguían pendientes. */
export async function marcarCelebracionesVistas(usuarioId: number | string, vistas: CelebracionesVistas): Promise<void> {
  if (vistas.rangos.length > 0) {
    await pool.query(
      `UPDATE rango_ascensos SET celebracion_vista_en = NOW()
        WHERE usuario_id = $1 AND id = ANY($2::int[]) AND celebracion_vista_en IS NULL`,
      [usuarioId, vistas.rangos],
    );
  }
  if (vistas.medallas.length > 0) {
    await pool.query(
      `UPDATE medalla_ascensos SET celebracion_vista_en = NOW()
        WHERE usuario_id = $1 AND id = ANY($2::int[]) AND celebracion_vista_en IS NULL`,
      [usuarioId, vistas.medallas],
    );
  }
}
