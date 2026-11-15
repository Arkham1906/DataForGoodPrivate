// Contrato del historial de EXP (2026-11-14; SRS v1.3: RF-GAM-03, 07, 37 a 39; descuento por reporte, A1 de la
// propuesta v1.4). Lo arma lib/gamificacion/historial-exp.ts en el servidor y lo pintan la página /progreso/historial
// y components/gamificacion/HistorialDeExp.tsx. Sin imports de servidor.

import type { TipoDeAporte } from "./exp-reglas";

/** Tipos que ve la persona. «ajuste» reúne los ajustes administrativos (ajuste_admin y el retirado ajuste_calidad). */
export type TipoDeMovimiento = "aporte" | "mision" | "bono" | "descuento" | "ajuste";

/** Filtros de la lista. «descuento» solo se ofrece si la persona tiene alguno (decisión del 2026-11-14). */
export type FiltroDeMovimientos = "todos" | "aporte" | "mision" | "bono" | "descuento";

export const FILTROS_DE_MOVIMIENTOS: readonly FiltroDeMovimientos[] = ["todos", "aporte", "mision", "bono", "descuento"];

/** Movimientos por página. Decisión del 2026-11-14: páginas numeradas de 10 (1 = los 10 más recientes, 2 = los 10
 *  anteriores…), en lugar de una lista que crece hacia abajo. */
export const MOVIMIENTOS_POR_PAGINA = 10;

export type MovimientoDeExp = {
  id: string;
  tipo: TipoDeMovimiento;
  /** Negativa en los descuentos. */
  exp: number;
  /** ISO. */
  creadoEn: string;
  /** Texto guardado con el movimiento; respaldo cuando falta la entidad relacionada (campaña o misión borradas). */
  motivo: string | null;
  campana: { id: number; nombre: string } | null;
  /** Aportes y descuentos: tipo de dato y calificación del aporte (del movimiento; sobreviven aunque el aporte se borre). */
  tipoDeDato: TipoDeAporte | null;
  calificacion: number | null;
  /** Aportes y descuentos: el aporte, si todavía existe (para enlazar a su detalle). */
  aporte: { id: number; enviadoEn: string | null } | null;
  /** Aportes: cómo se calculó, con lo que guardó el movimiento (RF-GAM-07). null si faltan datos (movimientos viejos). */
  calculo: {
    base: number;
    multCalidad: number;
    factor: number;
    bonificacionPotenciador: number;
    multCampana: number;
  } | null;
  /** Aportes: si después un reporte lo descontó. */
  descontado: { id: string; en: string } | null;
  /** Descuentos: el movimiento original que devuelven. */
  original: { id: string; en: string; exp: number } | null;
  mision: { nombre: string; periodicidad: string; periodoInicio: string; periodoFin: string } | null;
  /** Bonos de cuota: la cuota y la EXP de referencia, con las reglas de la versión de parámetros con que se calculó. */
  bono: { cuota: number; expReferencia: number; porcentaje: number | null; minimo: number | null; maximo: number | null } | null;
};

export type PaginaDeMovimientos = {
  movimientos: MovimientoDeExp[];
  /** EXP de cada día que aparece en la página, completo aunque la página corte el día (clave: AAAA-MM-DD en la zona de la app). */
  totalesPorDia: Record<string, number>;
  /** Página mostrada, de 1 a `paginas` (1 si no hay movimientos). */
  pagina: number;
  paginas: number;
  /** Movimientos del filtro en total, en todas las páginas. */
  total: number;
};

export type ReglasDeExp = {
  expBase: Record<TipoDeAporte, number>;
  multiplicadores: { calificacion: number; multiplicador: number }[];
  bonificacionPotenciador: number;
  factorMaximo: number;
  bono: { porcentaje: number; minimo: number; maximo: number; cuotaMinima: number };
};

export type HistorialDeExp = {
  /** EXP acumulada (usuario_progreso.exp_total), la misma que usan los rangos. */
  total: number;
  /** Suma de los movimientos por origen. descuentos es ≤ 0. */
  desglose: { aportes: number; misiones: number; bonos: number; descuentos: number; ajustes: number };
  hayDescuentos: boolean;
  hayAjustes: boolean;
  hayMovimientos: boolean;
  /** Aportes aceptados cuya EXP todavía no se registra (exp_otorgada NULL; la da el barrido de recompensas.ts). */
  enCamino: number;
  pagina: PaginaDeMovimientos;
  /** null si no hay parámetros vigentes: la página omite «Cómo se calcula». */
  reglas: ReglasDeExp | null;
};
