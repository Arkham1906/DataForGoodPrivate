// Métricas de /aportes/dashboard (SCR-WEB-34): aportes de toda la plataforma por rango de fechas.
// Exige sesión raíz, igual que lib/campanas/sistema.ts. Solo consulta: no lee archivos ni descripciones.

import { pool } from "@/lib/db";
import { NOMBRE_DE_TIPO, esTipo } from "@/lib/campanas/sistema-opciones";
import { hasRootSession } from "@/lib/rootSession";
import type { RangoDeFechas } from "@/lib/usuarios/dashboard";

export type DashboardDeAportes = {
  /** Todos los aportes, sin importar el rango. */
  total: number;
  enRango: number;
  aprobados: number;
  rechazados: number;
  /** Cola actual (pendiente + espera_final), sin importar el rango. */
  pendientes: number;
  /** Aprobados entre revisados del rango; null si no se revisó ninguno. */
  tasaDeAprobacion: number | null;
  serie: { titulo: string; columnas: { etiqueta: string; valor: number }[] };
  porTipo: { etiqueta: string; valor: number }[];
  porTematica: { etiqueta: string; valor: number }[];
  motivosDeRechazo: { etiqueta: string; valor: number }[];
  masAportan: { id: string; nombre: string; aportes: number }[];
  /** Aportes del rango enviados desde un enlace público sin cuenta. */
  sinCuenta: number;
  cortadoEn: Date;
};

const DIAS_POR_RANGO: Record<RangoDeFechas, number> = { "30d": 30, "90d": 90, "12m": 365 };

/** Cubetas de la gráfica de recolección para cada rango. */
const SERIE_POR_RANGO: Record<RangoDeFechas, { unidad: "day" | "week" | "month"; cubetas: number; titulo: string }> = {
  "30d": { unidad: "day", cubetas: 14, titulo: "Recolección diaria · últimos 14 días" },
  "90d": { unidad: "week", cubetas: 13, titulo: "Recolección semanal · últimas 13 semanas" },
  "12m": { unidad: "month", cubetas: 12, titulo: "Recolección mensual · últimos 12 meses" },
};

// submitted_at es TIMESTAMPTZ (desde el 2026-10-30). Para agrupar por día se pasa
// a la hora de Tepic: un aporte de las 8 p. m. no debe caer en el día siguiente.
const ZONA = "America/Mazatlan";
const FECHA_LOCAL = `(a.submitted_at AT TIME ZONE '${ZONA}')`;

// Las etiquetas salen de "YYYY-MM-DD" ya en hora local: se formatean en UTC
// para no correrlas un día.
const DIA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const MES = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" });

function etiquetaDeCubeta(inicio: string, unidad: "day" | "week" | "month"): string {
  const [y, m, d] = inicio.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return (unidad === "month" ? MES : DIA).format(fecha).replace(".", "");
}

const VACIO = (rango: RangoDeFechas): DashboardDeAportes => ({
  total: 0,
  enRango: 0,
  aprobados: 0,
  rechazados: 0,
  pendientes: 0,
  tasaDeAprobacion: null,
  serie: { titulo: SERIE_POR_RANGO[rango].titulo, columnas: [] },
  porTipo: [],
  porTematica: [],
  motivosDeRechazo: [],
  masAportan: [],
  sinCuenta: 0,
  cortadoEn: new Date(),
});

/**
 * Lee `aportes` y `campanas`. Aprobados, rechazados, repartos y campañas que
 * más aportan cuentan los aportes **enviados** dentro del rango; pendientes es
 * la cola de hoy. Si la tabla aún no existe, devuelve el dashboard en ceros.
 */
export async function obtenerDashboardDeAportes(rango: RangoDeFechas = "30d"): Promise<DashboardDeAportes> {
  if (!(await hasRootSession())) throw new Error("No autorizado");

  const dias = DIAS_POR_RANGO[rango];
  const serie = SERIE_POR_RANGO[rango];
  const enRango = `a.submitted_at >= NOW() - ($1 || ' days')::interval`;

  try {
    const [totales, serieResult, tipos, tematicas, motivos, campanas] = await Promise.all([
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
        [dias],
      ),
      pool.query<{ inicio: string; n: string }>(
        `WITH hoy AS (SELECT date_trunc($1, (NOW() AT TIME ZONE '${ZONA}')) AS d),
              cubetas AS (
                SELECT generate_series(hoy.d - ($2 - 1) * ('1 ' || $1)::interval, hoy.d, ('1 ' || $1)::interval) AS inicio
                FROM hoy
              )
         SELECT to_char(c.inicio, 'YYYY-MM-DD') AS inicio, COUNT(a.id) AS n
         FROM cubetas c
         LEFT JOIN aportes a ON date_trunc($1, ${FECHA_LOCAL}) = c.inicio
         GROUP BY c.inicio
         ORDER BY c.inicio`,
        [serie.unidad, serie.cubetas],
      ),
      pool.query<{ tipo: string; n: string }>(
        `SELECT a.file_type AS tipo, COUNT(*) AS n FROM aportes a WHERE ${enRango} GROUP BY 1 ORDER BY n DESC`,
        [dias],
      ),
      pool.query<{ tematica: string; n: string }>(
        `SELECT COALESCE(NULLIF(c.tematica, ''), NULLIF(c.tag, ''), 'Sin temática') AS tematica, COUNT(*) AS n
         FROM aportes a JOIN campanas c ON c.id = a.campaign_id
         WHERE ${enRango}
         GROUP BY 1 ORDER BY n DESC, 1 LIMIT 5`,
        [dias],
      ),
      // El motivo es texto libre (o uno de los motivos rápidos del creador):
      // se agrupan los textos idénticos.
      pool.query<{ motivo: string; n: string }>(
        `SELECT COALESCE(NULLIF(TRIM(a.rejection_reason), ''), 'Sin motivo registrado') AS motivo, COUNT(*) AS n
         FROM aportes a
         WHERE ${enRango} AND a.status = 'rechazado'
         GROUP BY 1 ORDER BY n DESC, 1 LIMIT 5`,
        [dias],
      ),
      pool.query<{ id: number; nombre: string; n: string }>(
        `SELECT c.id, c.name AS nombre, COUNT(*) AS n
         FROM aportes a JOIN campanas c ON c.id = a.campaign_id
         WHERE ${enRango}
         GROUP BY c.id, c.name ORDER BY n DESC, c.name LIMIT 5`,
        [dias],
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
      serie: {
        titulo: serie.titulo,
        columnas: serieResult.rows.map((r) => ({
          etiqueta: etiquetaDeCubeta(r.inicio, serie.unidad),
          valor: Number(r.n),
        })),
      },
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
    return VACIO(rango);
  }
}
