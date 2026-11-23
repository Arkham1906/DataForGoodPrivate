// Métricas de /aportes/dashboard (SCR-WEB-34): aportes de toda la plataforma en un periodo (lib/periodo.ts: atajos,
// todo el histórico o fechas específicas, desde el 2026-11-22; antes rango de 30 días, 90 días o 12 meses).
// Exige sesión raíz, igual que lib/campanas/sistema.ts. Solo consulta: no lee archivos ni descripciones.

import { pool } from "@/lib/db";
import { NOMBRE_DE_TIPO, esTipo } from "@/lib/campanas/sistema-opciones";
import { hasRootSession } from "@/lib/rootSession";
import type { Periodo } from "@/lib/periodo";
import { condicionDePeriodo, parametrosDelPeriodo, serieDeTiempo, type SerieDeTiempo } from "@/lib/series-de-tiempo";

export type DashboardDeAportes = {
  /** Todos los aportes, sin importar el periodo. */
  total: number;
  enRango: number;
  aprobados: number;
  rechazados: number;
  /** Cola actual (pendiente + espera_final), sin importar el periodo. */
  pendientes: number;
  /** Aprobados entre revisados del periodo; null si no se revisó ninguno. */
  tasaDeAprobacion: number | null;
  /** Aportes recibidos por día, semana, mes o año del periodo (lib/series-de-tiempo.ts). */
  serie: SerieDeTiempo | null;
  porTipo: { etiqueta: string; valor: number }[];
  porTematica: { etiqueta: string; valor: number }[];
  motivosDeRechazo: { etiqueta: string; valor: number }[];
  masAportan: { id: string; nombre: string; aportes: number }[];
  /** Aportes del periodo enviados desde un enlace público sin cuenta. */
  sinCuenta: number;
  cortadoEn: Date;
};

const VACIO: Omit<DashboardDeAportes, "cortadoEn"> = {
  total: 0,
  enRango: 0,
  aprobados: 0,
  rechazados: 0,
  pendientes: 0,
  tasaDeAprobacion: null,
  serie: null,
  porTipo: [],
  porTematica: [],
  motivosDeRechazo: [],
  masAportan: [],
  sinCuenta: 0,
};

/**
 * Lee `aportes` y `campanas`. Aprobados, rechazados, repartos y campañas que
 * más aportan cuentan los aportes **enviados** dentro del periodo (días de Tepic); pendientes es
 * la cola de hoy. Si la tabla aún no existe, devuelve el dashboard en ceros.
 */
export async function obtenerDashboardDeAportes(periodo: Periodo): Promise<DashboardDeAportes> {
  if (!(await hasRootSession())) throw new Error("No autorizado");

  const limites = parametrosDelPeriodo(periodo);
  const enRango = condicionDePeriodo("a.submitted_at", "$1", "$2");

  try {
    const [totales, serie, tipos, tematicas, motivos, campanas] = await Promise.all([
      pool.query<{
        total: string;
        en_rango: string;
        aprobados: string;
        rechazados: string;
        pendientes: string;
        sin_cuenta: string;
      }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE ${enRango}) AS en_rango,
                COUNT(*) FILTER (WHERE ${enRango} AND a.status = 'aceptado') AS aprobados,
                COUNT(*) FILTER (WHERE ${enRango} AND a.status = 'rechazado') AS rechazados,
                COUNT(*) FILTER (WHERE a.status IN ('pendiente', 'espera_final')) AS pendientes,
                COUNT(*) FILTER (WHERE ${enRango} AND a.user_id IS NULL AND a.anonimo_id IS NOT NULL) AS sin_cuenta
         FROM aportes a`,
        limites,
      ),
      serieDeTiempo({ fuente: `SELECT submitted_at AS t, 'aportes' AS s FROM aportes`, series: ["aportes"], periodo }),
      pool.query<{ tipo: string; n: string }>(
        `SELECT a.file_type AS tipo, COUNT(*) AS n FROM aportes a WHERE ${enRango} GROUP BY 1 ORDER BY n DESC`,
        limites,
      ),
      pool.query<{ tematica: string; n: string }>(
        `SELECT COALESCE(NULLIF(c.tematica, ''), NULLIF(c.tag, ''), 'Sin temática') AS tematica, COUNT(*) AS n
         FROM aportes a JOIN campanas c ON c.id = a.campaign_id
         WHERE ${enRango}
         GROUP BY 1 ORDER BY n DESC, 1 LIMIT 5`,
        limites,
      ),
      // El motivo es texto libre (o uno de los motivos rápidos del creador):
      // se agrupan los textos idénticos.
      pool.query<{ motivo: string; n: string }>(
        `SELECT COALESCE(NULLIF(TRIM(a.rejection_reason), ''), 'Sin motivo registrado') AS motivo, COUNT(*) AS n
         FROM aportes a
         WHERE ${enRango} AND a.status = 'rechazado'
         GROUP BY 1 ORDER BY n DESC, 1 LIMIT 5`,
        limites,
      ),
      pool.query<{ id: number; nombre: string; n: string }>(
        `SELECT c.id, c.name AS nombre, COUNT(*) AS n
         FROM aportes a JOIN campanas c ON c.id = a.campaign_id
         WHERE ${enRango}
         GROUP BY c.id, c.name ORDER BY n DESC, c.name LIMIT 5`,
        limites,
      ),
    ]);

    const t = totales.rows[0];
    const aprobados = Number(t?.aprobados ?? 0);
    const rechazados = Number(t?.rechazados ?? 0);
    const revisados = aprobados + rechazados;

    return {
      total: Number(t?.total ?? 0),
      enRango: Number(t?.en_rango ?? 0),
      aprobados,
      rechazados,
      pendientes: Number(t?.pendientes ?? 0),
      tasaDeAprobacion: revisados > 0 ? Math.round((aprobados / revisados) * 100) : null,
      serie,
      porTipo: tipos.rows.map((r) => {
        const tipo = esTipo(r.tipo);
        return { etiqueta: tipo ? NOMBRE_DE_TIPO[tipo] : r.tipo, valor: Number(r.n) };
      }),
      porTematica: tematicas.rows.map((r) => ({ etiqueta: r.tematica, valor: Number(r.n) })),
      motivosDeRechazo: motivos.rows.map((r) => ({ etiqueta: r.motivo, valor: Number(r.n) })),
      masAportan: campanas.rows.map((r) => ({ id: String(r.id), nombre: r.nombre, aportes: Number(r.n) })),
      sinCuenta: Number(t?.sin_cuenta ?? 0),
      cortadoEn: new Date(),
    };
  } catch (error) {
    console.error("Error obteniendo el dashboard de aportes", error);
    return { ...VACIO, cortadoEn: new Date() };
  }
}
