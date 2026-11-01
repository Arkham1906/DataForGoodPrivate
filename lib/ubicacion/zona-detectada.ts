// Zona detectada por GPS (2026-10-31, a pedido del usuario: "obtener la ubicación real del usuario, mostrarle
// las campañas de donde esté y, si va de un lugar a otro, avisarle y mostrarle las campañas activas de esa
// zona"). Decisiones del usuario: GPS del navegador con permiso y sin terceros (lib/ubicacion/
// zona-por-coordenadas.ts), a nivel municipio, solo con sesión, y un aviso por zona nueva al día.
// - Se guarda solo estado y municipio (usuario_zona_detectada); las coordenadas no.
// - Cambio de zona: distinta de la última detectada o, la primera vez, del estado y municipio de su perfil.
//   Sin ninguno de los dos no hay "de dónde viene" y no se avisa.
// - Aviso `ubicacion_nueva` con cuántas campañas activas hay ahí, enlace a /campanas (que filtra por la zona);
//   la misma zona no se vuelve a avisar en 24 horas (usuario_avisos_de_zona).
// Lo usa /api/ubicacion.

import { pool } from "@/lib/db";
import { notificar } from "@/lib/notificaciones/notificaciones";
import type { Zona } from "@/lib/ubicacion/zona-por-coordenadas";

/** Horas sin volver a avisar de la misma zona (decisión del usuario: una por zona nueva al día). */
export const HORAS_ENTRE_AVISOS_DE_LA_MISMA_ZONA = 24;

const clave = (t: string | null | undefined) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function mismaZona(a: Zona, b: Zona): boolean {
  return clave(a.estado) === clave(b.estado) && clave(a.municipio) === clave(b.municipio);
}

/** "Tepic, Nayarit". */
export function textoDeZona(zona: Zona): string {
  return `${zona.municipio}, ${zona.estado}`;
}

/** La última zona detectada de la persona, o null si no ha compartido su ubicación. */
export async function zonaDetectadaDe(usuarioId: number): Promise<(Zona & { detectadaEn: string }) | null> {
  const { rows } = await pool.query<{ estado: string; municipio: string; detectada_en: Date }>(
    `SELECT estado, municipio, detectada_en FROM usuario_zona_detectada WHERE usuario_id = $1`,
    [usuarioId],
  );
  const fila = rows[0];
  return fila ? { estado: fila.estado, municipio: fila.municipio, detectadaEn: new Date(fila.detectada_en).toISOString() } : null;
}

/** Campañas activas que se ven en la zona: las de todo el país, las de todo su estado y las de su municipio. */
export async function campanasActivasEnZona(zona: Zona): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM campanas
      WHERE status = 'activa'
        AND (todo_el_pais
             OR (lower(location_state) = lower($1)
                 AND (COALESCE(location_city, '') = '' OR lower(location_city) = lower($2))))`,
    [zona.estado, zona.municipio],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Guarda la zona donde está la persona y, si es otra, le avisa (una vez al día por zona).
 * Devuelve si cambió y si se mandó el aviso.
 */
export async function registrarZona(usuarioId: number, zona: Zona): Promise<{ cambio: boolean; avisado: boolean }> {
  const { rows } = await pool.query<{ estado: string | null; municipio: string | null; perfil_estado: string | null; perfil_municipio: string | null }>(
    `SELECT z.estado, z.municipio, u.state AS perfil_estado, u.city AS perfil_municipio
       FROM usuarios u LEFT JOIN usuario_zona_detectada z ON z.usuario_id = u.id
      WHERE u.id = $1`,
    [usuarioId],
  );
  const fila = rows[0];
  const anterior: Zona | null = fila?.estado
    ? { estado: fila.estado, municipio: fila.municipio ?? "" }
    : fila?.perfil_estado
      ? { estado: fila.perfil_estado, municipio: fila.perfil_municipio ?? "" }
      : null;

  await pool.query(
    `INSERT INTO usuario_zona_detectada (usuario_id, estado, municipio, detectada_en)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (usuario_id) DO UPDATE SET estado = EXCLUDED.estado, municipio = EXCLUDED.municipio, detectada_en = NOW()`,
    [usuarioId, zona.estado, zona.municipio],
  );

  const cambio = anterior !== null && !mismaZona(anterior, zona);
  if (!cambio) return { cambio: false, avisado: false };

  // Reserva el aviso de esta zona: solo pasa si no se avisó en las últimas 24 horas (también con dos
  // pestañas que detectan a la vez).
  const reservado = await pool.query(
    `INSERT INTO usuario_avisos_de_zona (usuario_id, estado, municipio, avisado_en)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (usuario_id, estado, municipio) DO UPDATE SET avisado_en = NOW()
       WHERE usuario_avisos_de_zona.avisado_en < NOW() - make_interval(hours => $4)`,
    [usuarioId, zona.estado, zona.municipio, HORAS_ENTRE_AVISOS_DE_LA_MISMA_ZONA],
  );
  if ((reservado.rowCount ?? 0) === 0) return { cambio: true, avisado: false };

  const activas = await campanasActivasEnZona(zona);
  await notificar({
    usuarioId,
    tipo: "ubicacion_nueva",
    titulo: `Estás en ${textoDeZona(zona)}`,
    mensaje:
      activas === 0
        ? `Por ahora no hay campañas activas en ${zona.municipio}. Te mostramos las de todo el país.`
        : `${activas === 1 ? "Hay 1 campaña activa" : `Hay ${activas} campañas activas`} donde estás ahora. Échales un vistazo.`,
    enlace: "/campanas",
    metadata: { estado: zona.estado, municipio: zona.municipio },
  });
  return { cambio: true, avisado: true };
}

/** Deja de usar su ubicación: borra la zona detectada (los avisos ya enviados se quedan en su campana). */
export async function olvidarZona(usuarioId: number): Promise<void> {
  await pool.query(`DELETE FROM usuario_zona_detectada WHERE usuario_id = $1`, [usuarioId]);
  await pool.query(`DELETE FROM usuario_avisos_de_zona WHERE usuario_id = $1`, [usuarioId]);
}
