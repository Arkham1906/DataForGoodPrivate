// Reglas de la EXP (2026-11-09; SRS v1.3: RF-GAM-01 a 03, 32, 37, 38; tablas 4.1 y 4.2). Lógica pura, sin base de
// datos: la usan lib/gamificacion/recompensas.ts y lib/db-schema.ts (siembra de parametros_gamificacion). Los valores
// NO se escriben en el cálculo: llegan en ParametrosDeGamificacion, que sale de la versión vigente de la tabla
// (RF-GAM-64, RNF-GAM-05). Sin imports de servidor.

import type { CalificacionDeAporte } from "@/lib/aportes/calificacion";

export type TipoDeAporte = "texto" | "foto" | "documento" | "audio" | "video";

/** Forma de parametros_gamificacion.valores desde la versión 2 (calificación de 1 a 5, SRS v1.2). */
export type ParametrosDeGamificacion = {
  expBase: Record<TipoDeAporte, number>;
  /** Clave: la calificación como texto ("1" a "5"), porque JSON no tiene llaves numéricas. */
  multiplicadorCalificacion: Record<"1" | "2" | "3" | "4" | "5", number>;
  potenciador: { bonificacion: number; duracionMinutos: number; enEspera: number };
  factorMaximo: number;
  bonoCuota: { porcentaje: number; minimo: number; maximo: number; cuotaMinima: number };
};

/** Versión 2 (SRS v1.2, tablas 4.1 y 4.2a): sustituye a la v1, que usaba tres calidades con nombre. */
export const PARAMETROS_GAMIFICACION_V2: ParametrosDeGamificacion = {
  expBase: { texto: 10, foto: 20, documento: 20, audio: 30, video: 30 },
  multiplicadorCalificacion: { "1": 1.0, "2": 1.25, "3": 1.5, "4": 1.75, "5": 2.0 },
  potenciador: { bonificacion: 0.5, duracionMinutos: 15, enEspera: 3 },
  factorMaximo: 5,
  bonoCuota: { porcentaje: 25, minimo: 10, maximo: 150, cuotaMinima: 3 },
};

/** Al entero más cercano, con las mitades hacia arriba (RF-GAM-03). Quita el ruido de coma flotante (52.4999… → 52.5). */
export function redondearExp(valor: number): number {
  return Math.floor(Number(valor.toFixed(6)) + 0.5);
}

export type CalculoDeExp = {
  base: number;
  multCalidad: number;
  multCampana: number;
  bonificacionPotenciador: number;
  factor: number;
  exp: number;
};

/**
 * EXP = redondeo(base × multiplicador de calificación × factor), con factor = 1 + bonificación del potenciador +
 * (multiplicador de campaña − 1), tope `factorMaximo` (RF-GAM-03). Un tipo sin EXP base en los parámetros da 0.
 */
export function calcularExpDeAporte(
  entrada: {
    tipo: string;
    calificacion: CalificacionDeAporte;
    /** Multiplicador de la campaña especial vigente al enviar; 1 si no hay. */
    multCampana: number;
    /** Bonificación del potenciador vigente al enviar; 0 si no hay (RF-GAM-36). */
    bonificacionPotenciador: number;
  },
  parametros: ParametrosDeGamificacion,
): CalculoDeExp {
  const base = parametros.expBase[entrada.tipo as TipoDeAporte] ?? 0;
  const multCalidad = parametros.multiplicadorCalificacion[String(entrada.calificacion) as "1"] ?? 1;
  const multCampana = Math.max(1, entrada.multCampana);
  const bonificacionPotenciador = Math.max(0, entrada.bonificacionPotenciador);
  const factor = Math.min(parametros.factorMaximo, 1 + bonificacionPotenciador + (multCampana - 1));
  return { base, multCalidad, multCampana, bonificacionPotenciador, factor, exp: redondearExp(base * multCalidad * factor) };
}

/**
 * Bono por completar la cuota (RF-GAM-37, 38): el porcentaje de la EXP de referencia (base × calificación de los
 * aportes que cumplieron la cuota, sin potenciador ni campaña), entre el mínimo y el máximo. null si la cuota es
 * menor que la mínima: esa campaña no da bono.
 */
export function bonoDeCuota(
  entrada: { cuota: number; referencias: readonly number[] },
  parametros: ParametrosDeGamificacion,
): { referencia: number; bono: number } | null {
  const { porcentaje, minimo, maximo, cuotaMinima } = parametros.bonoCuota;
  if (entrada.cuota < cuotaMinima) return null;
  const referencia = entrada.referencias.reduce((suma, r) => suma + r, 0);
  const bono = Math.min(maximo, Math.max(minimo, redondearExp((referencia * porcentaje) / 100)));
  return { referencia, bono };
}

/** Lee `valores` de la tabla y comprueba que tenga la forma de la v2; null si no (p. ej. la v1, con tres calidades). */
export function parametrosDesde(valores: unknown): ParametrosDeGamificacion | null {
  const v = valores as Partial<ParametrosDeGamificacion> | null;
  if (!v || typeof v !== "object") return null;
  const mult = v.multiplicadorCalificacion;
  if (!mult || ["1", "2", "3", "4", "5"].some((k) => typeof mult[k as "1"] !== "number")) return null;
  if (!v.expBase || typeof v.factorMaximo !== "number" || !v.bonoCuota || !v.potenciador) return null;
  return v as ParametrosDeGamificacion;
}
