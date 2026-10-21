// Reportes (2026-10-12). Dos tipos, ambos contra una cuenta:
//   - de campaña: cualquiera con sesión menos el creador; va contra quien la creó;
//   - de aporte: el creador de la campaña o un revisor aceptado; va contra quien lo envió (solo aportes
//     con cuenta: los anónimos tienen su propio bloqueo por dispositivo).
// Llegan a la bandeja del SuperUsuario (/reportes), que los descarta o los confirma con un aviso (o un
// baneo) desde .../sanciones/[usuarioId]?reportes=<clave> de /supervisar o /supervision (aplicarSancion,
// lib/moderacion/acciones.ts).
// La persona reportada no se entera del reporte ni de quién lo hizo; solo recibe el aviso si se confirma.
// Desde el 2026-10-19, el reporte de aporte también rechaza el aporte (rechazarPorReporte de lib/aportes/reporte.ts):
// a quien aportó le llega el rechazo, no el reporte.
// Lo usan POST /api/campanas/[id]/reportar, POST /api/aportes/[id]/reportar-participante, los GET de
// campaña y aporte, la bandeja, la pantalla de sanción y el layout del panel.

import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisarReporteASupervisores } from "@/lib/notificaciones/avisos-a-supervisores";
import { avisarRechazoPorReporte, rechazarPorReporte } from "@/lib/aportes/reporte";
import {
  MAXIMO_DESCRIPCION_DE_REPORTE,
  MOTIVOS_DE_REPORTE_DE_APORTE,
  MOTIVOS_DE_REPORTE_DE_CAMPANA,
  escribirClaveDeReportes,
  type ClaveDeReportes,
  type EstadoDeReporte,
  type TipoDeReporte,
} from "@/lib/reportes/motivos";

export type ResultadoDeReporte =
  /** rechazado: solo en el de aporte, si el reporte rechazó el aporte (no en una campaña ya finalizada). */
  | { ok: true; rechazado?: boolean }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

/** Motivo de la lista y/o descripción; null si es válido. */
function errorDeMotivo(motivo: string, descripcion: string, lista: string[]): string | null {
  if (motivo && !lista.includes(motivo)) return "Motivo no válido";
  if (!motivo && !descripcion) return "Elige un motivo o describe por qué haces el reporte";
  if (descripcion.length > MAXIMO_DESCRIPCION_DE_REPORTE) {
    return `La descripción no puede pasar de ${MAXIMO_DESCRIPCION_DE_REPORTE} caracteres`;
  }
  return null;
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Guarda el reporte de una campaña contra su creador. Uno por persona y campaña. */
export async function reportarCampana(entrada: {
  campanaId: number;
  usuarioId: number;
  motivo: unknown;
  descripcion: unknown;
}): Promise<ResultadoDeReporte> {
  const motivo = texto(entrada.motivo);
  const descripcion = texto(entrada.descripcion);
  const error = errorDeMotivo(motivo, descripcion, MOTIVOS_DE_REPORTE_DE_CAMPANA);
  if (error) return { ok: false, status: 400, error };

  const { rows } = await pool.query<{ creator_id: number | null; status: string }>(
    `SELECT creator_id, status FROM campanas WHERE id = $1`,
    [entrada.campanaId],
  );
  const campana = rows[0];
  // Un borrador solo lo ve su creador: para cualquier otro no existe.
  if (!campana || campana.status === "borrador") return { ok: false, status: 404, error: "Campaña no encontrada" };
  if (Number(campana.creator_id) === entrada.usuarioId) {
    return { ok: false, status: 403, error: "No puedes reportar una campaña que creaste" };
  }

  // ON CONFLICT con el índice único parcial: uno por persona, aunque mande dos a la vez.
  const guardado = await pool.query<{ id: number }>(
    `INSERT INTO reportes (tipo, campana_id, reportado_id, reportado_por, motivo, descripcion)
     VALUES ('campana', $1, $2, $3, $4, $5)
     ON CONFLICT (campana_id, reportado_por) WHERE tipo = 'campana' DO NOTHING
     RETURNING id`,
    [entrada.campanaId, campana.creator_id, entrada.usuarioId, motivo || null, descripcion || null],
  );
  if (guardado.rowCount === 0) return { ok: false, status: 409, error: "Ya reportaste esta campaña" };

  await registrarAuditoria({
    actor: { tipo: "usuario", id: entrada.usuarioId },
    accion: "campana.reportar",
    objetivo: { tipo: "campana", id: entrada.campanaId },
    detalle: { reporteId: guardado.rows[0].id, reportadoId: campana.creator_id, motivo: motivo || null },
  });
  avisarReporteASupervisores({
    tipo: "campana",
    campanaId: entrada.campanaId,
    reportadoId: Number(campana.creator_id),
    reportadoPor: entrada.usuarioId,
    motivo: motivo || null,
  });
  return { ok: true };
}

/** Guarda el reporte del creador o de un revisor contra quien envió el aporte y rechaza el aporte. Uno por persona y aporte. */
export async function reportarParticipante(entrada: {
  aporteId: number;
  usuarioId: number;
  /** Nombre de quien reporta: si es revisor, queda como quien rechazó el aporte. */
  nombre: string;
  motivo: unknown;
  descripcion: unknown;
}): Promise<ResultadoDeReporte> {
  const motivo = texto(entrada.motivo);
  const descripcion = texto(entrada.descripcion);
  const error = errorDeMotivo(motivo, descripcion, MOTIVOS_DE_REPORTE_DE_APORTE);
  if (error) return { ok: false, status: 400, error };

  const { rows } = await pool.query<{ campaign_id: number; user_id: number | null; creator_id: number; puede: boolean }>(
    `SELECT a.campaign_id, a.user_id, c.creator_id,
            (c.creator_id = $2 OR EXISTS (
              SELECT 1 FROM campana_revisores r
              WHERE r.campana_id = a.campaign_id AND r.usuario_id = $2 AND r.estado = 'aceptado'
            )) AS puede
     FROM aportes a JOIN campanas c ON c.id = a.campaign_id
     WHERE a.id = $1`,
    [entrada.aporteId, entrada.usuarioId],
  );
  const aporte = rows[0];
  if (!aporte) return { ok: false, status: 404, error: "Aporte no encontrado" };
  if (!aporte.puede) {
    return { ok: false, status: 403, error: "Solo quien creó la campaña o un revisor puede reportar a quien aportó" };
  }
  if (aporte.user_id == null) {
    return { ok: false, status: 400, error: "Un aporte sin cuenta no se reporta: bloquea el dispositivo desde la campaña" };
  }
  if (Number(aporte.user_id) === entrada.usuarioId) {
    return { ok: false, status: 403, error: "No puedes reportarte a ti" };
  }

  // El reporte y el rechazo del aporte van juntos.
  const client = await pool.connect();
  let reporteId: number;
  let rechazo: Awaited<ReturnType<typeof rechazarPorReporte>>;
  try {
    await client.query("BEGIN");
    const guardado = await client.query<{ id: number }>(
      `INSERT INTO reportes (tipo, campana_id, aporte_id, reportado_id, reportado_por, motivo, descripcion)
       VALUES ('aporte', $1, $2, $3, $4, $5, $6)
       ON CONFLICT (aporte_id, reportado_por) WHERE tipo = 'aporte' DO NOTHING
       RETURNING id`,
      [aporte.campaign_id, entrada.aporteId, aporte.user_id, entrada.usuarioId, motivo || null, descripcion || null],
    );
    if (guardado.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, status: 409, error: "Ya reportaste a quien envió este aporte" };
    }
    reporteId = guardado.rows[0].id;
    rechazo = await rechazarPorReporte(client, {
      aporteId: entrada.aporteId,
      motivo: [motivo, descripcion].filter(Boolean).join(" — "),
      actor: { id: entrada.usuarioId, nombre: entrada.nombre, esRevisor: Number(aporte.creator_id) !== entrada.usuarioId },
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  await registrarAuditoria({
    actor: { tipo: "usuario", id: entrada.usuarioId },
    accion: "aporte.reportar_participante",
    objetivo: { tipo: "aporte", id: entrada.aporteId },
    detalle: { reporteId, reportadoId: aporte.user_id, motivo: motivo || null, rechazado: rechazo.rechazado },
  });
  await avisarRechazoPorReporte(rechazo, entrada.aporteId);
  avisarReporteASupervisores({
    tipo: "aporte",
    campanaId: Number(aporte.campaign_id),
    aporteId: entrada.aporteId,
    reportadoId: Number(aporte.user_id),
    reportadoPor: entrada.usuarioId,
    motivo: motivo || null,
    // Si reporta un revisor, el creador de la campaña no se entera (2026-10-15).
    excluir: [Number(aporte.creator_id)],
  });
  return { ok: true, rechazado: rechazo.rechazado };
}

/** Si la persona ya hizo el reporte de esa campaña o aporte (para no ofrecérselo otra vez). */
export async function yaReporto(clave: ClaveDeReportes, usuarioId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    clave.tipo === "campana"
      ? `SELECT 1 FROM reportes WHERE tipo = 'campana' AND campana_id = $1 AND reportado_por = $2`
      : `SELECT 1 FROM reportes WHERE tipo = 'aporte' AND aporte_id = $1 AND reportado_por = $2`,
    [clave.id, usuarioId],
  );
  return (rowCount ?? 0) > 0;
}

/* ── Bandeja de quien modera (SuperUsuario en modo supervisor o supervisor) ── */

export type ReporteParaBandeja = {
  id: string;
  /** Quién reportó ("SuperUsuario" si fue él; "… · al rechazar la campaña" si lo dejó un rechazo con sanción);
   * "Cuenta eliminada" si ya no existe. Solo lo ve quien modera, nunca la persona reportada. */
  quien: string;
  motivo: string | null;
  descripcion: string | null;
  fecha: Date;
  estado: EstadoDeReporte;
  resueltoEn: Date | null;
  nota: string | null;
  /** La sanción con que se resolvió: STRIKE (aviso) o BANEO_DE_CAMPANA (baneo inmediato). */
  sancion: { tipo: string } | null;
};

export type GrupoDeReportes = {
  /** "campana-116" o "aporte-55"; "reporte-9" si el aporte ya se borró (no se puede resolver junto). */
  clave: string;
  tipo: TipoDeReporte;
  campana: { id: string; nombre: string };
  aporteId: string | null;
  /** La cuenta reportada; null si ya no existe. */
  reportado: { id: string; nombre: string } | null;
  reportes: ReporteParaBandeja[];
};

export type FiltroDeReportes = "pendientes" | "resueltos";

/**
 * Reportes agrupados por lo que se reportó (una campaña o un aporte), primero el más reciente.
 * Pendientes: todos. Resueltos: los últimos 300 (no hay paginación todavía).
 * `sinContraCuenta`: id del supervisor que modera; no ve los reportes contra él mismo.
 */
export async function listarReportes(filtro: FiltroDeReportes, sinContraCuenta: number | null = null): Promise<GrupoDeReportes[]> {
  try {
    const { rows } = await pool.query<{
      id: number;
      tipo: TipoDeReporte;
      campana_id: number;
      campana: string;
      aporte_id: number | null;
      reportado_id: number | null;
      reportado: string | null;
      quien: string | null;
      motivo: string | null;
      descripcion: string | null;
      created_at: Date;
      estado: EstadoDeReporte;
      resuelto_en: Date | null;
      nota_de_resolucion: string | null;
      sancion_tipo: string | null;
      origen: string;
    }>(
      `SELECT r.id, r.tipo, c.id AS campana_id, c.name AS campana, r.aporte_id,
              r.reportado_id, NULLIF(TRIM(ru.nombre || ' ' || ru.apellidos), '') AS reportado,
              CASE WHEN r.por_superusuario THEN 'SuperUsuario'
                   ELSE NULLIF(TRIM(q.nombre || ' ' || q.apellidos), '') END AS quien,
              r.origen,
              r.motivo, r.descripcion, r.created_at, r.estado, r.resuelto_en, r.nota_de_resolucion,
              s.tipo AS sancion_tipo
       FROM reportes r
       JOIN campanas c ON c.id = r.campana_id
       LEFT JOIN usuarios ru ON ru.id = r.reportado_id
       LEFT JOIN usuarios q ON q.id = r.reportado_por
       LEFT JOIN sanciones s ON s.id = r.sancion_id
       WHERE ${filtro === "pendientes" ? "r.estado = 'pendiente'" : "r.estado <> 'pendiente'"}
         AND ($1::int IS NULL OR r.reportado_id IS DISTINCT FROM $1)
       ORDER BY ${filtro === "pendientes" ? "r.created_at" : "r.resuelto_en"} DESC, r.id DESC
       ${filtro === "resueltos" ? "LIMIT 300" : ""}`,
      [sinContraCuenta],
    );

    const grupos = new Map<string, GrupoDeReportes>();
    for (const f of rows) {
      const clave =
        f.tipo === "campana"
          ? escribirClaveDeReportes({ tipo: "campana", id: f.campana_id })
          : f.aporte_id
            ? escribirClaveDeReportes({ tipo: "aporte", id: f.aporte_id })
            : `reporte-${f.id}`;
      const grupo = grupos.get(clave) ?? {
        clave,
        tipo: f.tipo,
        campana: { id: String(f.campana_id), nombre: f.campana },
        aporteId: f.aporte_id ? String(f.aporte_id) : null,
        reportado: f.reportado_id ? { id: String(f.reportado_id), nombre: f.reportado ?? "Sin nombre" } : null,
        reportes: [],
      };
      grupo.reportes.push({
        id: String(f.id),
        // El que deja la supervisión al rechazar la campaña con sanción (2026-10-16) lo dice.
        quien: `${f.quien ?? "Cuenta eliminada"}${f.origen === "rechazo" ? " · al rechazar la campaña" : ""}`,
        motivo: f.motivo,
        descripcion: f.descripcion,
        fecha: f.created_at,
        estado: f.estado,
        resueltoEn: f.resuelto_en,
        nota: f.nota_de_resolucion,
        sancion: f.sancion_tipo ? { tipo: f.sancion_tipo } : null,
      });
      grupos.set(clave, grupo);
    }
    return [...grupos.values()];
  } catch (error) {
    console.error("Error listando reportes", error);
    return [];
  }
}

/** Cuántos reportes y casos (campañas o aportes) esperan decisión (bandeja y "Modo supervisor" del panel). Sin los
 * reportes contra `sinContraCuenta` (el supervisor que modera). */
export async function contarReportesPendientes(sinContraCuenta: number | null = null): Promise<{ reportes: number; casos: number }> {
  try {
    const { rows } = await pool.query<{ reportes: number; casos: number }>(
      `SELECT COUNT(*)::int AS reportes,
              COUNT(DISTINCT CASE WHEN tipo = 'campana' THEN 'c' || campana_id ELSE 'a' || COALESCE(aporte_id, -id) END)::int AS casos
       FROM reportes WHERE estado = 'pendiente' AND ($1::int IS NULL OR reportado_id IS DISTINCT FROM $1)`,
      [sinContraCuenta],
    );
    return rows[0] ?? { reportes: 0, casos: 0 };
  } catch {
    return { reportes: 0, casos: 0 };
  }
}

/** Condición SQL de "los reportes de esta clave" (parámetro $1 = id de la campaña o del aporte). `a`: alias con punto ("r."). */
export function sqlDeClave(clave: ClaveDeReportes, a = ""): string {
  return clave.tipo === "campana"
    ? `${a}tipo = 'campana' AND ${a}campana_id = $1`
    : `${a}tipo = 'aporte' AND ${a}aporte_id = $1`;
}

/**
 * Reportes pendientes de una clave contra una persona: lo que se resuelve al sancionarla desde
 * .../sanciones/[usuarioId]?reportes=<clave>. null si no queda ninguno.
 */
export async function reportesPendientesContra(
  clave: ClaveDeReportes,
  usuarioId: number,
): Promise<{ /** "de la campaña «X»" o "del aporte #55 en «X»". */ titulo: string; reportes: number; motivos: string[] } | null> {
  const { rows } = await pool.query<{ campana: string; reportes: number; motivos: string[] }>(
    `SELECT MIN(c.name) AS campana, COUNT(*)::int AS reportes,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.motivo), NULL) AS motivos
     FROM reportes r JOIN campanas c ON c.id = r.campana_id
     WHERE ${sqlDeClave(clave, "r.")}
       AND r.reportado_id = $2 AND r.estado = 'pendiente'
     HAVING COUNT(*) > 0`,
    [clave.id, usuarioId],
  );
  const f = rows[0];
  if (!f) return null;
  return {
    titulo: clave.tipo === "campana" ? `de la campaña «${f.campana}»` : `del aporte #${clave.id} en «${f.campana}»`,
    reportes: f.reportes,
    motivos: f.motivos,
  };
}
