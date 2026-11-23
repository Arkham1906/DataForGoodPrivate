// Métricas de /usuarios/dashboard por periodo (lib/periodo.ts; desde el 2026-11-22 también todo el histórico y
// fechas específicas) y pestañas de la sección Usuarios.
// Ojo: no verifica la sesión raíz; depende del layout del panel.

import type { Pestana } from "@/components/sistema/subtabs";
import { pool } from "@/lib/db";
import { condicionDeRol } from "@/lib/usuarios/tabla-roles";
import { ETIQUETA_DE_ESTADO, RESUMEN_DE_SANCIONES, estadoDesdeSanciones } from "@/lib/usuarios/directorio";
import type { Periodo } from "@/lib/periodo";
import { condicionDePeriodo, parametrosDelPeriodo, serieDeTiempo, type SerieDeTiempo } from "@/lib/series-de-tiempo";

/** Pestañas de la sección Usuarios. Las comparten las cuatro pantallas. Sanciones aquí es solo consulta
 * (2026-10-13): aplicar y restaurar se hace en modo supervisor (/supervisar/sanciones). */
export const PESTANAS_USUARIOS: Pestana[] = [
  { href: "/usuarios/dashboard", etiqueta: "Dashboard" },
  { href: "/usuarios", etiqueta: "Directorio" },
  { href: "/usuarios/supervisores", etiqueta: "Supervisores" },
  { href: "/usuarios/sanciones", etiqueta: "Sanciones" },
];

export type DashboardDeUsuarios = {
  totalRegistrados: number;
  altasDelMes: number;
  conAportesEnRango: number;
  cuentasRestringidas: number;
  /** Altas por día, semana, mes o año del periodo (lib/series-de-tiempo.ts); null si falló. */
  altas: SerieDeTiempo | null;
  /**
   * Usuarios agrupados por cuántos aportes enviaron y cuántos les aprobaron en el periodo (2026-11-22, a pedido del
   * usuario), en los grupos de GRUPOS_POR_APORTES; cuentan todas las cuentas, también las que no aportaron.
   */
  porAportes: { enviados: GrupoPorAportes[]; aprobados: GrupoPorAportes[] };
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
  /**
   * Usuarios por estado y, dentro de cada uno, por municipio (2026-11-22, a pedido del usuario; antes, los 6
   * municipios con más cuentas). Todos los estados, del que más tiene al que menos; quien no declaró estado va en
   * `sinUbicacion` y quien declaró estado sin municipio, en el municipio `null`.
   */
  porUbicacion: {
    estados: { estado: string; valor: number; municipios: { municipio: string | null; valor: number }[] }[];
    sinUbicacion: number;
  };
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

export type GrupoPorAportes = { etiqueta: string; valor: number };

/** Grupos de "Usuarios por aportes": hasta `hasta` aportes (el último, sin tope). */
export const GRUPOS_POR_APORTES: { hasta: number; etiqueta: string }[] = [
  { hasta: 0, etiqueta: "Sin aportes" },
  { hasta: 1, etiqueta: "1 aporte" },
  { hasta: 5, etiqueta: "2 a 5" },
  { hasta: 10, etiqueta: "6 a 10" },
  { hasta: 25, etiqueta: "11 a 25" },
  { hasta: Number.POSITIVE_INFINITY, etiqueta: "Más de 25" },
];

/** CASE de SQL con el índice del grupo de GRUPOS_POR_APORTES para la cuenta `columna`. */
function grupoEnSql(columna: string): string {
  const casos = GRUPOS_POR_APORTES.slice(0, -1).map((g, i) => `WHEN ${columna} <= ${g.hasta} THEN ${i}`);
  return `CASE ${casos.join(" ")} ELSE ${GRUPOS_POR_APORTES.length - 1} END`;
}

const DASHBOARD_VACIO: DashboardDeUsuarios = {
  totalRegistrados: 0,
  altasDelMes: 0,
  conAportesEnRango: 0,
  cuentasRestringidas: 0,
  altas: null,
  porAportes: { enviados: [], aprobados: [] },
  porRol: [],
  estadoDeCuenta: { activas: 0, conStrikes: 0, suspendidas: 0, baneadas: 0, correoSinVerificar: 0 },
  interesesDeclarados: [],
  porUbicacion: { estados: [], sinUbicacion: 0 },
  masActivos: [],
  cortadoEn: new Date(),
};

/**
 * `obtenerDashboardDeUsuarios` lee `usuarios`, `sanciones`, `campanas` y
 * `aportes` (ver ensureCoreSchema en lib/db-schema.ts). Igual que el
 * Directorio, se envuelve en try/catch: en una BD recién levantada donde
 * todavía no existe ninguna de esas tablas, la pantalla debe mostrar el
 * dashboard en ceros en vez de un 500.
 *
 * Pendiente, porque no hay tabla/flujo para eso: `rolDesde` no se guarda
 * (igual que en el Directorio), así que "Altas" agrupa por
 * `usuarios.created_at`, que sí es real.
 */
export async function obtenerDashboardDeUsuarios(periodo: Periodo): Promise<DashboardDeUsuarios> {
  try {
    const limites = parametrosDelPeriodo(periodo);

    const [
      totalResult,
      altasDelMesResult,
      conAportesResult,
      restringidasResult,
      altasResult,
      porRolResult,
      creadorasResult,
      estadoResult,
      correoSinVerificarResult,
      interesesResult,
      ubicacionResult,
      masActivosResult,
      porAportesResult,
    ] = await Promise.all([
      pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM usuarios`),
      pool.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM usuarios WHERE created_at >= date_trunc('month', NOW())`,
      ),
      pool.query<{ n: string }>(
        `SELECT COUNT(DISTINCT user_id) AS n FROM aportes
         WHERE user_id IS NOT NULL AND ${condicionDePeriodo("submitted_at", "$1", "$2")}`,
        limites,
      ),
      pool.query<{ n: string }>(
        `SELECT COUNT(DISTINCT usuario_id) AS n FROM sanciones
         WHERE activa = true
           AND (
             tipo = 'BANEO_DE_CAMPANA'
             OR (tipo = 'SUSPENSION_TEMPORAL' AND aplicada_en + (COALESCE(dias, 0) || ' days')::interval > NOW())
           )`,
      ),
      // Altas del periodo por día, semana, mes o año (2026-11-22; antes, los últimos 6 o 12 meses).
      serieDeTiempo({ fuente: `SELECT created_at AS t, 'altas' AS s FROM usuarios`, series: ["altas"], periodo }),
      pool.query<{ supervisores: string; revisores: string; usuario_comun: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE ${condicionDeRol("u", "'supervisor'")}) AS supervisores,
           COUNT(*) FILTER (WHERE ${condicionDeRol("u", "'revisor'")}) AS revisores,
           -- Sin rol delegado. Creador y aportador (2026-11-22) son permisos que toda cuenta tiene: no cuentan como rol aquí.
           COUNT(*) FILTER (
             WHERE NOT EXISTS (SELECT 1 FROM usuario_roles ur WHERE ur.usuario_id = u.id
                                 AND ur.rol NOT IN ('usuario', 'creador', 'aportador'))
           ) AS usuario_comun
         FROM usuarios u`,
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
      pool.query<{ estado: string | null; municipio: string | null; n: string }>(
        `SELECT NULLIF(btrim(state), '') AS estado, NULLIF(btrim(city), '') AS municipio, COUNT(*) AS n
         FROM usuarios
         GROUP BY 1, 2`,
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
      // Usuarios por aportes (2026-11-22): cuántos envió y cuántos le aprobaron cada cuenta en el periodo.
      pool.query<{ tipo: "enviados" | "aprobados"; grupo: number; n: number }>(
        `WITH por_usuario AS (
           SELECT u.id,
                  COUNT(a.id) AS enviados,
                  COUNT(a.id) FILTER (WHERE a.status = 'aceptado') AS aprobados
             FROM usuarios u
             LEFT JOIN aportes a ON a.user_id = u.id AND ${condicionDePeriodo("a.submitted_at", "$1", "$2")}
            GROUP BY u.id
         )
         SELECT 'enviados' AS tipo, ${grupoEnSql("enviados")} AS grupo, COUNT(*)::int AS n FROM por_usuario GROUP BY 2
         UNION ALL
         SELECT 'aprobados' AS tipo, ${grupoEnSql("aprobados")} AS grupo, COUNT(*)::int AS n FROM por_usuario GROUP BY 2`,
        limites,
      ),
    ]);

    const totalRegistrados = Number(totalResult.rows[0]?.n ?? 0);

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

    // Estados con sus municipios: del que más cuentas tiene al que menos (empates, de la A a la Z); "sin municipio"
    // al final de su estado.
    const estados = new Map<string, { municipio: string | null; valor: number }[]>();
    let sinUbicacion = 0;
    for (const r of ubicacionResult.rows) {
      if (!r.estado) {
        sinUbicacion += Number(r.n);
        continue;
      }
      const lista = estados.get(r.estado) ?? [];
      lista.push({ municipio: r.municipio, valor: Number(r.n) });
      estados.set(r.estado, lista);
    }
    const porUbicacion = {
      estados: [...estados]
        .map(([estado, municipios]) => ({
          estado,
          valor: municipios.reduce((s, m) => s + m.valor, 0),
          municipios: municipios.sort(
            (a, b) =>
              Number(a.municipio === null) - Number(b.municipio === null) ||
              b.valor - a.valor ||
              (a.municipio ?? "").localeCompare(b.municipio ?? "", "es"),
          ),
        }))
        .sort((a, b) => b.valor - a.valor || a.estado.localeCompare(b.estado, "es")),
      sinUbicacion,
    };

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
      altas: altasResult,
      porAportes: {
        enviados: GRUPOS_POR_APORTES.map((g, i) => ({
          etiqueta: g.etiqueta,
          valor: porAportesResult.rows.find((r) => r.tipo === "enviados" && Number(r.grupo) === i)?.n ?? 0,
        })),
        aprobados: GRUPOS_POR_APORTES.map((g, i) => ({
          etiqueta: g.etiqueta,
          valor: porAportesResult.rows.find((r) => r.tipo === "aprobados" && Number(r.grupo) === i)?.n ?? 0,
        })),
      },
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
