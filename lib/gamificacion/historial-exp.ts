// Historial de EXP de una persona (2026-11-14; SRS v1.3: RF-GAM-03, 07, 37 a 39; descuento por reporte, A1 de la
// propuesta v1.4). Lee exp_movimientos, que es inalterable: cada recompensa y cada descuento es una fila, y el cálculo
// se muestra con lo que guardó esa fila (exp_base, mult_calidad, factor…), nunca recalculado con los parámetros de hoy.
//
//   - obtenerHistorialDeExp(usuarioId): resumen, primera página y reglas vigentes, para la página /progreso/historial.
//   - obtenerPaginaDeMovimientos(usuarioId, filtro, pagina, irA): una página numerada; la pide
//     GET /api/progreso/historial-exp al cambiar de filtro o de página, o al saltar de un descuento a su original.
//
// Páginas numeradas de 10 (decisión del 2026-11-14): la 1 son los 10 más recientes, la 2 los 10 anteriores, y así.
// Orden por creado_en e id. `irA` (el id de un movimiento) devuelve la página donde está, para que el salto entre un
// descuento y su original funcione aunque estén en páginas distintas. Los totales por día se calculan sobre el día
// completo, para que la suma no cambie cuando una página corta un día a la mitad.
// Solo la persona recibe su historial (RF-GAM-77): la consulta filtra por su usuario_id.

import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { leerParametros } from "./parametros";
import type { TipoDeAporte } from "./exp-reglas";
import {
  MOVIMIENTOS_POR_PAGINA,
  type FiltroDeMovimientos,
  type HistorialDeExp,
  type MovimientoDeExp,
  type PaginaDeMovimientos,
  type ReglasDeExp,
  type TipoDeMovimiento,
} from "./historial-exp-tipos";

const TIPOS_POR_FILTRO: Record<FiltroDeMovimientos, readonly string[] | null> = {
  todos: null,
  aporte: ["aporte"],
  mision: ["mision"],
  bono: ["bono_campana"],
  descuento: ["ajuste_invalidacion"],
};

const TIPO_VISIBLE: Record<string, TipoDeMovimiento> = {
  aporte: "aporte",
  mision: "mision",
  bono_campana: "bono",
  ajuste_invalidacion: "descuento",
  ajuste_admin: "ajuste",
  ajuste_calidad: "ajuste",
};

const TIPOS_DE_DATO = new Set<string>(["texto", "foto", "documento", "audio", "video"]);

type Fila = {
  id: string;
  tipo: string;
  exp: number;
  motivo: string | null;
  creado_en: Date;
  dia: string;
  aporte_id: number | null;
  campana_id: number | null;
  campana_nombre: string | null;
  exp_base: number | null;
  calificacion: number | null;
  mult_calidad: number | null;
  mult_campana: number | null;
  bonificacion_potenciador: number | null;
  factor: number | null;
  file_type: string | null;
  submitted_at: Date | null;
  descuento_id: string | null;
  descontado_en: Date | null;
  original_id: string | null;
  original_en: Date | null;
  original_exp: number | null;
  original_calificacion: number | null;
  mision_nombre: string | null;
  periodicidad: string | null;
  periodo_inicio: Date | null;
  periodo_fin: Date | null;
  cuota: number | null;
  exp_referencia: number | null;
  bono_reglas: { porcentaje?: unknown; minimo?: unknown; maximo?: unknown } | null;
};

const iso = (fecha: Date | null) => (fecha ? new Date(fecha).toISOString() : null);
const numero = (valor: unknown) => (typeof valor === "number" && Number.isFinite(valor) ? valor : null);

function aMovimiento(f: Fila): MovimientoDeExp {
  const tipo = TIPO_VISIBLE[f.tipo] ?? "ajuste";
  // El tipo de dato no está en exp_movimientos: si el aporte se borró (su campaña se eliminó), queda null.
  const tipoDeDato = f.file_type && TIPOS_DE_DATO.has(f.file_type) ? (f.file_type as TipoDeAporte) : null;
  return {
    id: f.id,
    tipo,
    exp: f.exp,
    creadoEn: new Date(f.creado_en).toISOString(),
    motivo: f.motivo,
    campana: f.campana_id !== null && f.campana_nombre !== null ? { id: f.campana_id, nombre: f.campana_nombre } : null,
    tipoDeDato,
    calificacion: tipo === "descuento" ? f.original_calificacion : tipo === "aporte" ? f.calificacion : null,
    aporte: f.aporte_id !== null && f.submitted_at !== null ? { id: f.aporte_id, enviadoEn: iso(f.submitted_at) } : null,
    calculo:
      tipo === "aporte" && f.exp_base !== null && f.mult_calidad !== null
        ? {
            base: f.exp_base,
            multCalidad: f.mult_calidad,
            factor: f.factor ?? 1,
            bonificacionPotenciador: f.bonificacion_potenciador ?? 0,
            multCampana: f.mult_campana ?? 1,
          }
        : null,
    descontado: f.descuento_id && f.descontado_en ? { id: f.descuento_id, en: new Date(f.descontado_en).toISOString() } : null,
    original:
      f.original_id && f.original_en ? { id: f.original_id, en: new Date(f.original_en).toISOString(), exp: f.original_exp ?? -f.exp } : null,
    mision:
      f.mision_nombre && f.periodo_inicio && f.periodo_fin
        ? {
            nombre: f.mision_nombre,
            periodicidad: f.periodicidad ?? "",
            periodoInicio: new Date(f.periodo_inicio).toISOString(),
            periodoFin: new Date(f.periodo_fin).toISOString(),
          }
        : null,
    bono:
      tipo === "bono" && f.cuota !== null && f.exp_referencia !== null
        ? {
            cuota: f.cuota,
            expReferencia: f.exp_referencia,
            porcentaje: numero(f.bono_reglas?.porcentaje),
            minimo: numero(f.bono_reglas?.minimo),
            maximo: numero(f.bono_reglas?.maximo),
          }
        : null,
  };
}

/**
 * Una página de movimientos, del más reciente al más antiguo. `pagina` empieza en 1 y se ajusta al rango válido.
 * `irA`: id de un movimiento de la persona; si está en el filtro, manda sobre `pagina` y devuelve la página donde está.
 */
export async function obtenerPaginaDeMovimientos(
  usuarioId: number | string,
  filtro: FiltroDeMovimientos = "todos",
  pagina = 1,
  irA: string | null = null,
): Promise<PaginaDeMovimientos> {
  const tipos = TIPOS_POR_FILTRO[filtro] ?? null;
  const objetivo = irA && /^\d{1,19}$/.test(irA) ? irA : null;
  const conteo = await pool.query<{ total: string; antes: string | null }>(
    `SELECT COUNT(*)::text AS total,
            CASE WHEN $3::bigint IS NULL THEN NULL ELSE
              (COUNT(*) FILTER (WHERE (m.creado_en, m.id) > (SELECT y.creado_en, y.id FROM exp_movimientos y
                                                            WHERE y.id = $3::bigint AND y.usuario_id = $1)))::text
            END AS antes
       FROM exp_movimientos m
      WHERE m.usuario_id = $1 AND ($2::text[] IS NULL OR m.tipo = ANY($2::text[]))`,
    [usuarioId, tipos, objetivo],
  );
  const total = Number(conteo.rows[0]?.total ?? 0);
  const paginas = Math.max(1, Math.ceil(total / MOVIMIENTOS_POR_PAGINA));
  const pedida = objetivo && conteo.rows[0]?.antes != null
    ? Math.floor(Number(conteo.rows[0].antes) / MOVIMIENTOS_POR_PAGINA) + 1
    : Number.isFinite(pagina) ? Math.trunc(pagina) : 1;
  const actual = Math.min(Math.max(1, pedida), paginas);

  const { rows } = await pool.query<Fila>(
    `SELECT m.id::text AS id, m.tipo, m.exp, m.motivo, m.creado_en,
            to_char(m.creado_en AT TIME ZONE $4, 'YYYY-MM-DD') AS dia,
            m.aporte_id, m.campana_id, c.name AS campana_nombre,
            m.exp_base, m.calificacion, m.mult_calidad::float8 AS mult_calidad, m.mult_campana::float8 AS mult_campana,
            m.bonificacion_potenciador::float8 AS bonificacion_potenciador, m.factor::float8 AS factor,
            a.file_type, a.submitted_at,
            d.id::text AS descuento_id, d.creado_en AS descontado_en,
            o.id::text AS original_id, o.creado_en AS original_en, o.exp AS original_exp, o.calificacion AS original_calificacion,
            mis.nombre AS mision_nombre, mis.periodicidad, mi.periodo_inicio, mi.periodo_fin,
            b.cuota, b.exp_referencia, pg.valores->'bonoCuota' AS bono_reglas
       FROM exp_movimientos m
       LEFT JOIN campanas c ON c.id = m.campana_id
       LEFT JOIN aportes a ON a.id = m.aporte_id
       LEFT JOIN LATERAL (
         SELECT x.id, x.creado_en FROM exp_movimientos x
          WHERE x.movimiento_original_id = m.id AND x.tipo = 'ajuste_invalidacion'
          ORDER BY x.id LIMIT 1
       ) d ON m.tipo = 'aporte'
       LEFT JOIN exp_movimientos o ON o.id = m.movimiento_original_id
       LEFT JOIN mision_instancias mi ON mi.id = m.mision_instancia_id
       LEFT JOIN misiones mis ON mis.id = mi.mision_id
       LEFT JOIN campana_cuota_bonos b ON b.exp_movimiento_id = m.id
       LEFT JOIN parametros_gamificacion pg ON pg.version = m.parametros_version AND m.tipo = 'bono_campana'
      WHERE m.usuario_id = $1
        AND ($2::text[] IS NULL OR m.tipo = ANY($2::text[]))
      ORDER BY m.creado_en DESC, m.id DESC
      LIMIT ${MOVIMIENTOS_POR_PAGINA} OFFSET $3`,
    [usuarioId, tipos, (actual - 1) * MOVIMIENTOS_POR_PAGINA, ZONA_DE_CAMPANAS],
  );

  const visibles = rows;
  const dias = [...new Set(visibles.map((f) => f.dia))];
  const totalesPorDia: Record<string, number> = {};
  if (dias.length > 0) {
    const totales = await pool.query<{ dia: string; exp: string }>(
      `SELECT to_char(creado_en AT TIME ZONE $3, 'YYYY-MM-DD') AS dia, SUM(exp)::text AS exp
         FROM exp_movimientos
        WHERE usuario_id = $1 AND ($2::text[] IS NULL OR tipo = ANY($2::text[]))
          AND to_char(creado_en AT TIME ZONE $3, 'YYYY-MM-DD') = ANY($4::text[])
        GROUP BY 1`,
      [usuarioId, tipos, ZONA_DE_CAMPANAS, dias],
    );
    for (const t of totales.rows) totalesPorDia[t.dia] = Number(t.exp);
  }

  return {
    movimientos: visibles.map(aMovimiento),
    totalesPorDia,
    pagina: actual,
    paginas,
    total,
  };
}

function reglasDesde(valores: NonNullable<Awaited<ReturnType<typeof leerParametros>>>["valores"]): ReglasDeExp {
  return {
    expBase: valores.expBase,
    multiplicadores: (["1", "2", "3", "4", "5"] as const).map((c) => ({
      calificacion: Number(c),
      multiplicador: valores.multiplicadorCalificacion[c],
    })),
    bonificacionPotenciador: valores.potenciador.bonificacion,
    factorMaximo: valores.factorMaximo,
    bono: valores.bonoCuota,
  };
}

/** Resumen, primera página (todos los tipos) y reglas vigentes. null si la consulta falla (la página muestra el error). */
export async function obtenerHistorialDeExp(usuarioId: number | string): Promise<HistorialDeExp | null> {
  try {
    const [progresoR, desgloseR, enCaminoR, parametros, pagina] = await Promise.all([
      pool.query<{ exp_total: number }>(`SELECT exp_total FROM usuario_progreso WHERE usuario_id = $1`, [usuarioId]),
      pool.query<{ tipo: string; exp: string; cuantos: string }>(
        `SELECT tipo, SUM(exp)::text AS exp, COUNT(*)::text AS cuantos FROM exp_movimientos WHERE usuario_id = $1 GROUP BY tipo`,
        [usuarioId],
      ),
      pool.query<{ cuantos: string }>(
        `SELECT COUNT(*)::text AS cuantos FROM aportes
          WHERE user_id = $1 AND status = 'aceptado' AND exp_otorgada IS NULL
            AND reviewed_at >= (SELECT MIN(lanzamiento_en) FROM parametros_gamificacion)`,
        [usuarioId],
      ),
      leerParametros(pool),
      obtenerPaginaDeMovimientos(usuarioId),
    ]);

    const desglose = { aportes: 0, misiones: 0, bonos: 0, descuentos: 0, ajustes: 0 };
    let movimientos = 0;
    let descuentos = 0;
    let ajustes = 0;
    for (const f of desgloseR.rows) {
      const exp = Number(f.exp);
      const cuantos = Number(f.cuantos);
      movimientos += cuantos;
      const tipo = TIPO_VISIBLE[f.tipo] ?? "ajuste";
      if (tipo === "aporte") desglose.aportes += exp;
      else if (tipo === "mision") desglose.misiones += exp;
      else if (tipo === "bono") desglose.bonos += exp;
      else if (tipo === "descuento") {
        desglose.descuentos += exp;
        descuentos += cuantos;
      } else {
        desglose.ajustes += exp;
        ajustes += cuantos;
      }
    }

    return {
      total: progresoR.rows[0]?.exp_total ?? 0,
      desglose,
      hayDescuentos: descuentos > 0,
      hayAjustes: ajustes > 0,
      hayMovimientos: movimientos > 0,
      enCamino: Number(enCaminoR.rows[0]?.cuantos ?? 0),
      pagina,
      reglas: parametros ? reglasDesde(parametros.valores) : null,
    };
  } catch (error) {
    console.error("Error leyendo el historial de EXP", error);
    return null;
  }
}
