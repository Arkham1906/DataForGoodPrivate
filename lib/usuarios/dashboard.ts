// Métricas de /usuarios/dashboard por rango de fechas y pestañas de la sección Usuarios.
// Ojo: no verifica la sesión raíz; depende del layout del panel.

import type { Pestana } from "@/components/sistema/subtabs";
import { pool } from "@/lib/db";
import { ETIQUETA_DE_ESTADO, RESUMEN_DE_SANCIONES, estadoDesdeSanciones } from "@/lib/usuarios/directorio";

/** Pestañas de la sección Usuarios. Las comparten las cuatro pantallas. */
export const PESTANAS_USUARIOS: Pestana[] = [
  { href: "/usuarios/dashboard", etiqueta: "Dashboard" },
  { href: "/usuarios", etiqueta: "Directorio" },
  { href: "/usuarios/supervisores", etiqueta: "Supervisores" },
  { href: "/usuarios/sanciones", etiqueta: "Sanciones" },
];

export type RangoDeFechas = "30d" | "90d" | "12m";

export type DashboardDeUsuarios = {
  totalRegistrados: number;
  altasDelMes: number;
  conAportesEnRango: number;
  cuentasRestringidas: number;
  altasPorMes: { etiqueta: string; valor: number }[];
  porRol: { etiqueta: string; valor: number }[];
  estadoDeCuenta: {
    activas: number;
    conStrikes: number;
    suspendidas: number;
    baneadas: number;
    correoSinVerificar: number;
  };
  /** Porcentaje del padrón que declaró cada temática. */
  interesesDeclarados: { etiqueta: string; porcentaje: number }[];
  porUbicacion: { etiqueta: string; valor: number }[];
  masActivos: {
    id: string;
    nombre: string;
    correo: string;
    aportesAprobados: number;
    campanas: number;
    /** Mismos tonos que components/ui/Tag. */
    estado: { texto: string; tono: "ok" | "warn" | "danger" };
  }[];
  cortadoEn: Date;
};

const DASHBOARD_VACIO: DashboardDeUsuarios = {
  totalRegistrados: 0,
  altasDelMes: 0,
  conAportesEnRango: 0,
  cuentasRestringidas: 0,
  altasPorMes: [],
  porRol: [],
  estadoDeCuenta: { activas: 0, conStrikes: 0, suspendidas: 0, baneadas: 0, correoSinVerificar: 0 },
  interesesDeclarados: [],
  porUbicacion: [],
  masActivos: [],
  cortadoEn: new Date(),
};

const DIAS_POR_RANGO: Record<RangoDeFechas, number> = { "30d": 30, "90d": 90, "12m": 365 };
/** Meses de historial que muestra la gráfica "Altas por mes" para cada rango. */
const MESES_DE_TENDENCIA: Record<RangoDeFechas, number> = { "30d": 6, "90d": 6, "12m": 12 };

// UTC, no America/Mazatlan: la fecha ancla se construye en UTC (Date.UTC) y
// usuarios.created_at/date_trunc también corren en UTC (TimeZone del server
// de Postgres). Formatear en Mazatlan restaría horas y corría la etiqueta un
// mes hacia atrás.
const NOMBRE_DE_MES = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" });

/** Últimos `meses` meses (más antiguo primero), como clave "YYYY-MM" + etiqueta corta. */
function mesesRecientes(meses: number): { clave: string; etiqueta: string }[] {
  const ahora = new Date();
  const lista: { clave: string; etiqueta: string }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const fecha = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - i, 1));
    lista.push({
      clave: `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`,
      etiqueta: NOMBRE_DE_MES.format(fecha).replace(".", ""),
    });
  }
  return lista;
}

/**
 * `obtenerDashboardDeUsuarios` lee `usuarios`, `sanciones`, `campanas` y
 * `aportes` (ver ensureCoreSchema en lib/db-schema.ts). Igual que el
 * Directorio, se envuelve en try/catch: en una BD recién levantada donde
 * todavía no existe ninguna de esas tablas, la pantalla debe mostrar el
 * dashboard en ceros en vez de un 500.
 *
 * Pendiente, porque no hay tabla/flujo para eso: `rolDesde` no se guarda
 * (igual que en el Directorio), así que "Altas por mes" agrupa por
 * `usuarios.created_at`, que sí es real.
 */
export async function obtenerDashboardDeUsuarios(
  rango: RangoDeFechas = "30d",
): Promise<DashboardDeUsuarios> {
  try {
    const dias = DIAS_POR_RANGO[rango];
    const meses = mesesRecientes(MESES_DE_TENDENCIA[rango]);
    const desdeMes = meses[0]?.clave ?? "1970-01";

    const [
      totalResult,
      altasDelMesResult,
      conAportesResult,
      restringidasResult,
      altasPorMesResult,
      porRolResult,
      creadorasResult,
      estadoResult,
      correoSinVerificarResult,
      interesesResult,
      ubicacionResult,
      masActivosResult,
    ] = await Promise.all([
      pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM usuarios`),
      pool.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM usuarios WHERE created_at >= date_trunc('month', NOW())`,
      ),
      pool.query<{ n: string }>(
        `SELECT COUNT(DISTINCT user_id) AS n FROM aportes
         WHERE user_id IS NOT NULL AND submitted_at >= NOW() - ($1 || ' days')::interval`,
        [dias],
      ),
      pool.query<{ n: string }>(
        `SELECT COUNT(DISTINCT usuario_id) AS n FROM sanciones
         WHERE activa = true
           AND (
             tipo = 'BANEO_DE_CAMPANA'
             OR (tipo = 'SUSPENSION_TEMPORAL' AND aplicada_en + (COALESCE(dias, 0) || ' days')::interval > NOW())
           )`,
      ),
      pool.query<{ mes: string; n: string }>(
        `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes, COUNT(*) AS n
         FROM usuarios
         WHERE created_at >= $1::text::date
         GROUP BY 1`,
        [`${desdeMes}-01`],
      ),
      pool.query<{ supervisores: string; revisores: string; usuario_comun: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE role @> '["supervisor"]'::jsonb) AS supervisores,
           COUNT(*) FILTER (WHERE role @> '["revisor"]'::jsonb) AS revisores,
           COUNT(*) FILTER (
             WHERE NOT role @> '["supervisor"]'::jsonb
               AND NOT role @> '["revisor"]'::jsonb
               AND NOT role @> '["admin"]'::jsonb
           ) AS usuario_comun
         FROM usuarios`,
      ),
      pool.query<{ n: string }>(`SELECT COUNT(DISTINCT creator_id) AS n FROM campanas`),
      pool.query<{ strikes: string; suspendida: boolean; baneada: boolean; n: string }>(
        `SELECT COALESCE(rs.strikes, 0) AS strikes, COALESCE(rs.suspendida, false) AS suspendida,
                COALESCE(rs.baneada, false) AS baneada, COUNT(*) AS n
         FROM usuarios u
         ${RESUMEN_DE_SANCIONES}
         GROUP BY 1, 2, 3`,
      ),
      pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM usuarios WHERE NOT email_verificado`),
      pool.query<{ tema: string; n: string }>(
        `SELECT elem AS tema, COUNT(DISTINCT u.id) AS n
         FROM usuarios u, jsonb_array_elements_text(u.intereses) AS elem
         GROUP BY elem`,
      ),
      pool.query<{ etiqueta: string; n: string }>(
        `SELECT COALESCE(NULLIF(city, ''), 'Sin ubicación declarada') AS etiqueta, COUNT(*) AS n
         FROM usuarios
         GROUP BY 1
         ORDER BY n DESC
         LIMIT 6`,
      ),
      pool.query<{
        id: number;
        nombre: string;
        apellidos: string;
        email: string;
        aportes_aceptados: string;
        campanas: string;
        strikes: string;
        suspendida: boolean;
        baneada: boolean;
      }>(
        `SELECT u.id, u.nombre, u.apellidos, u.email,
                COUNT(a.*) FILTER (WHERE a.status = 'aceptado') AS aportes_aceptados,
                COUNT(DISTINCT a.campaign_id) AS campanas,
                COALESCE(rs.strikes, 0) AS strikes,
                COALESCE(rs.suspendida, false) AS suspendida,
                COALESCE(rs.baneada, false) AS baneada
         FROM usuarios u
         JOIN aportes a ON a.user_id = u.id
         ${RESUMEN_DE_SANCIONES}
         GROUP BY u.id, rs.strikes, rs.suspendida, rs.baneada
         ORDER BY aportes_aceptados DESC
         LIMIT 10`,
      ),
    ]);

    const totalRegistrados = Number(totalResult.rows[0]?.n ?? 0);

    const altasPorMesPorClave = new Map(altasPorMesResult.rows.map((r) => [r.mes, Number(r.n)]));
    const altasPorMes = meses.map((m) => ({ etiqueta: m.etiqueta, valor: altasPorMesPorClave.get(m.clave) ?? 0 }));

    const rolRow = porRolResult.rows[0];
    const porRol = [
      { etiqueta: "Usuario común", valor: Number(rolRow?.usuario_comun ?? 0) },
      { etiqueta: "Revisor de aportes", valor: Number(rolRow?.revisores ?? 0) },
      { etiqueta: "Supervisor", valor: Number(rolRow?.supervisores ?? 0) },
      { etiqueta: "Creador de campañas", valor: Number(creadorasResult.rows[0]?.n ?? 0) },
    ];

    const estadoDeCuenta = { activas: 0, conStrikes: 0, suspendidas: 0, baneadas: 0, correoSinVerificar: Number(correoSinVerificarResult.rows[0]?.n ?? 0) };
    for (const fila of estadoResult.rows) {
      const estado = estadoDesdeSanciones(Number(fila.strikes), fila.suspendida, fila.baneada);
      const n = Number(fila.n);
      if (estado === "ACTIVA") estadoDeCuenta.activas += n;
      else if (estado === "CON_STRIKES") estadoDeCuenta.conStrikes += n;
      else if (estado === "SUSPENDIDA") estadoDeCuenta.suspendidas += n;
      else estadoDeCuenta.baneadas += n;
    }

    const interesesPorTema = new Map(interesesResult.rows.map((r) => [r.tema, Number(r.n)]));
    // Solo temas que declaró al menos un usuario (con 23 temas, el top 5 se llenaba de filas en
    // 0%). Desde 2026-10-07 entran también las temáticas nuevas que salen de los textos.
    const interesesDeclarados = [...interesesPorTema.keys()]
      .filter((tema) => (interesesPorTema.get(tema) ?? 0) > 0)
      .map((tema) => ({
        etiqueta: tema,
        n: interesesPorTema.get(tema) ?? 0,
        porcentaje: totalRegistrados > 0 ? Math.round(((interesesPorTema.get(tema) ?? 0) / totalRegistrados) * 100) : 0,
      }))
      .sort((a, b) => b.n - a.n || a.etiqueta.localeCompare(b.etiqueta, "es"))
      .slice(0, 5)
      .map(({ etiqueta, porcentaje }) => ({ etiqueta, porcentaje }));

    const porUbicacion = ubicacionResult.rows.map((r) => ({ etiqueta: r.etiqueta, valor: Number(r.n) }));

    const masActivos = masActivosResult.rows.map((r) => {
      const estado = estadoDesdeSanciones(Number(r.strikes), r.suspendida, r.baneada);
      // ETIQUETA_DE_ESTADO nunca produce "default": EstadoDeCuenta solo cubre
      // los otros tres tonos.
      const { texto, tono } = ETIQUETA_DE_ESTADO[estado] as { texto: string; tono: "ok" | "warn" | "danger" };
      return {
        id: String(r.id),
        nombre: `${r.nombre} ${r.apellidos}`.trim(),
        correo: r.email,
        aportesAprobados: Number(r.aportes_aceptados),
        campanas: Number(r.campanas),
        estado: { texto, tono },
      };
    });

    return {
      totalRegistrados,
      altasDelMes: Number(altasDelMesResult.rows[0]?.n ?? 0),
      conAportesEnRango: Number(conAportesResult.rows[0]?.n ?? 0),
      cuentasRestringidas: Number(restringidasResult.rows[0]?.n ?? 0),
      altasPorMes,
      porRol,
      estadoDeCuenta,
      interesesDeclarados,
      porUbicacion,
      masActivos,
      cortadoEn: new Date(),
    };
  } catch (error) {
    console.error("Error obteniendo el dashboard de usuarios", error);
    return DASHBOARD_VACIO;
  }
}

export function formatearCorte(fecha: Date): string {
  const f = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Mazatlan",
  }).format(fecha);

  return `Corte al ${f}`;
}
