// EXP que puede dar un aporte aceptado de cada tipo (2026-11-13, a pedido del responsable; SRS v1.3: RF-GAM-01 a 03,
// 32). Sustituye, en la vista de quien aporta, al dato anterior campanas.xp_per_contribution, que ya no se usa para
// calcular nada. El rango va de la calificación más baja a la más alta, sin potenciador: lo calcula
// calcularExpDeAporte con los parámetros vigentes, así que coincide con lo que se concede (RF-GAM-64).

import { pool } from "@/lib/db";
import { calcularExpDeAporte, type TipoDeAporte } from "@/lib/gamificacion/exp-reglas";
import { leerParametros } from "@/lib/gamificacion/parametros";
import type { CalificacionDeAporte } from "@/lib/aportes/calificacion";

export type ExpPorTipo = {
  tipos: { tipo: TipoDeAporte; minimo: number; maximo: number }[];
  /** Lo que suma un potenciador activo al multiplicador (RF-GAM-32), para la nota del recuadro. */
  bonificacionPotenciador: number;
};

const TIPOS: readonly TipoDeAporte[] = ["texto", "foto", "documento", "audio", "video"];
const CALIFICACIONES: readonly CalificacionDeAporte[] = [1, 2, 3, 4, 5];

/** `pedidos` vacío o sin tipos conocidos: los cinco. null si no hay parámetros vigentes. */
export async function obtenerExpPorTipo(pedidos: readonly string[]): Promise<ExpPorTipo | null> {
  const vigentes = await leerParametros(pool);
  if (!vigentes) return null;
  const elegidos = TIPOS.filter((t) => pedidos.includes(t));
  return {
    tipos: (elegidos.length > 0 ? elegidos : TIPOS).map((tipo) => {
      const exps = CALIFICACIONES.map(
        (calificacion) => calcularExpDeAporte({ tipo, calificacion, multCampana: 1, bonificacionPotenciador: 0 }, vigentes.valores).exp,
      );
      return { tipo, minimo: Math.min(...exps), maximo: Math.max(...exps) };
    }),
    bonificacionPotenciador: vigentes.valores.potenciador.bonificacion,
  };
}
