// Reportes (2026-10-12). Dos tipos, ambos contra una cuenta:
//   - de campaña: cualquiera con sesión menos el creador; va contra quien la creó;
//   - de aporte: el creador de la campaña o un revisor aceptado; va contra quien lo envió (solo aportes
//     con cuenta: los anónimos tienen su propio bloqueo por dispositivo).
// Los reportes de campañas llegan a todos los supervisores; los de aportes, solo al supervisor asignado
// a la campaña. El SuperUsuario conserva acceso global en /supervisar. Quien modera descarta o confirma
// desde .../sanciones/[usuarioId]?reportes=<clave> (aplicarSancion, lib/moderacion/acciones.ts).
// La persona reportada no se entera del reporte ni de quién lo hizo; solo recibe el aviso si se confirma.
// El de aporte se guarda en lib/aportes/reporte.ts (reportarASupervision, "Reportar aporte"; uno por
// aporte desde el 2026-11-07, cuando se quitó "Reportar a quien aportó" y su reportarParticipante) y
// también rechaza el aporte: a quien aportó le llega el rechazo, no el reporte.
// Lo usan POST /api/campanas/[id]/reportar, los GET de campaña, la bandeja, la pantalla de sanción y el
// layout del panel.

import { pool } from "@/lib/db";
import { sqlReporteVisibleParaSupervisor } from "@/lib/reportes/alcance";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisarReporteASupervisores } from "@/lib/notificaciones/avisos-a-supervisores";
import {
  MAXIMO_DESCRIPCION_DE_REPORTE,
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
 * Los reportes de aportes solo los consulta el supervisor asignado a su campaña, o todos si la campaña no
 * tiene un supervisor activo ni la supervisa el SuperUsuario (lib/reportes/alcance.ts).
 */
export async function supervisorPuedeVerClaveDeReportes(clave: ClaveDeReportes, supervisorId: number | null): Promise<boolean> {
  if (supervisorId === null || clave.tipo === "campana") return true;
  const { rowCount } = await pool.query(
    `SELECT 1 FROM reportes r JOIN campanas c ON c.id = r.campana_id
     WHERE r.tipo = 'aporte' AND r.aporte_id = $1 AND ${sqlReporteVisibleParaSupervisor("r", "c", "$2")}
     LIMIT 1`,
    [clave.id, supervisorId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Reportes agrupados por lo que se reportó (una campaña o un aporte), primero el más reciente.
 * Pendientes: todos los visibles. Resueltos: los últimos 300 (no hay paginación todavía).
 * `sinContraCuenta`: id del supervisor que modera; no ve los reportes contra él mismo.
 * `supervisorId`: restringe los reportes de aportes a sus campañas; null ve todo (SuperUsuario).
 */
export async function listarReportes(
  filtro: FiltroDeReportes,
  sinContraCuenta: number | null = null,
  supervisorId: number | null = null,
): Promise<GrupoDeReportes[]> {
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
         AND ${sqlReporteVisibleParaSupervisor("r", "c", "$2")}
       ORDER BY ${filtro === "pendientes" ? "r.created_at" : "r.resuelto_en"} DESC, r.id DESC
       ${filtro === "resueltos" ? "LIMIT 300" : ""}`,
      [sinContraCuenta, supervisorId],
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

/** Cuántos reportes visibles y casos esperan decisión. `supervisorId` aplica el mismo alcance de listarReportes. */
export async function contarReportesPendientes(
  sinContraCuenta: number | null = null,
  supervisorId: number | null = null,
): Promise<{ reportes: number; casos: number }> {
  try {
    const { rows } = await pool.query<{ reportes: number; casos: number }>(
      `SELECT COUNT(*)::int AS reportes,
              COUNT(DISTINCT CASE WHEN r.tipo = 'campana' THEN 'c' || r.campana_id ELSE 'a' || COALESCE(r.aporte_id, -r.id) END)::int AS casos
       FROM reportes r JOIN campanas c ON c.id = r.campana_id
       WHERE r.estado = 'pendiente'
         AND ($1::int IS NULL OR r.reportado_id IS DISTINCT FROM $1)
         AND ${sqlReporteVisibleParaSupervisor("r", "c", "$2")}`,
      [sinContraCuenta, supervisorId],
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
