// Límite de aportes por tipo de dato (2026-10-28, a pedido del usuario): el creador puede poner, para
// cada tipo que pide la campaña, cuántos aportes de ese tipo recibe EN TOTAL (p. ej. 100 fotos y 20
// videos). Es opcional: un tipo sin número no tiene límite (y las campañas anteriores, ninguno).
// Cuentan los enviados que no se rechazaron (pendientes y aprobados): un rechazado libera su lugar.
// Al llenarse un tipo ya nadie puede mandar de ese tipo; la cuota por persona sigue igual.
// Se guarda en campanas.limite_por_tipo ({ "foto": 100 }) y el conteo en campanas.enviados_por_tipo
// (lo recalcula recalcularContadores, lib/aportes/comun.ts, que también lo exige al insertar).
// Sin imports de servidor: lo usan el formulario de campaña y las pantallas de aportar.

import type { DataType } from "@/types";
import { PLURALES_DE_TIPO } from "@/lib/campanas/reparto-sugerido";

export type LimitePorTipo = Partial<Record<DataType, number>>;
export type EnviadosPorTipo = Partial<Record<DataType, number>>;

export const LIMITE_MAXIMO_POR_TIPO = 1_000_000;

const TIPOS: DataType[] = ["texto", "foto", "video", "audio", "documento"];

function esTipo(valor: string): valor is DataType {
  return (TIPOS as string[]).includes(valor);
}

/**
 * Valida el límite que manda el formulario ({ foto: 100, video: "" }). Los tipos que la campaña no
 * pide se descartan; vacío, null o 0 = sin límite. Devuelve null si ningún tipo tiene límite.
 */
export function normalizarLimitePorTipo(
  input: unknown,
  tipos: readonly string[],
): { ok: true; limite: LimitePorTipo | null } | { ok: false; error: string } {
  if (input === null || input === undefined || input === "") return { ok: true, limite: null };
  if (typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "El límite por tipo de dato no es válido" };
  const limite: LimitePorTipo = {};
  for (const [tipo, valor] of Object.entries(input as Record<string, unknown>)) {
    if (!esTipo(tipo) || !tipos.includes(tipo)) continue;
    if (valor === null || valor === undefined || valor === "" || valor === 0) continue;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1 || n > LIMITE_MAXIMO_POR_TIPO) {
      return { ok: false, error: `El límite de ${PLURALES_DE_TIPO[tipo][1]} debe ser un número entero mayor a 0` };
    }
    limite[tipo] = n;
  }
  return { ok: true, limite: Object.keys(limite).length > 0 ? limite : null };
}

/** Lee un JSONB { tipo: número } de la fila (limite_por_tipo o enviados_por_tipo). */
function mapaDeTipos(valor: unknown, tipos?: readonly string[]): Partial<Record<DataType, number>> {
  const mapa: Partial<Record<DataType, number>> = {};
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return mapa;
  for (const [tipo, n] of Object.entries(valor as Record<string, unknown>)) {
    if (!esTipo(tipo) || (tipos && !tipos.includes(tipo))) continue;
    const numero = Number(n);
    if (Number.isInteger(numero) && numero >= 0) mapa[tipo] = numero;
  }
  return mapa;
}

/** Límite de la fila de `campanas`, solo de los tipos que la campaña pide hoy. */
export function limitePorTipoDesdeFila(row: { limite_por_tipo?: unknown; data_types?: unknown }): LimitePorTipo {
  const tipos = Array.isArray(row.data_types) ? row.data_types.map(String) : [];
  const limite = mapaDeTipos(row.limite_por_tipo, tipos);
  for (const tipo of Object.keys(limite) as DataType[]) if (!limite[tipo]) delete limite[tipo];
  return limite;
}

/** Aportes no rechazados de cada tipo (campanas.enviados_por_tipo). */
export function enviadosPorTipoDesdeFila(row: { enviados_por_tipo?: unknown }): EnviadosPorTipo {
  return mapaDeTipos(row.enviados_por_tipo);
}

/** Cuántos aportes de ese tipo le caben aún a la campaña; null = sin límite. */
export function quedanDelTipo(tipo: string, limite: LimitePorTipo, enviados: EnviadosPorTipo): number | null {
  if (!esTipo(tipo) || !limite[tipo]) return null;
  return Math.max(0, limite[tipo]! - (enviados[tipo] ?? 0));
}

/** Los tipos que todavía reciben aportes (los que no tienen límite o no lo han llenado). */
export function tiposConLugar<T extends string>(tipos: readonly T[], limite: LimitePorTipo, enviados: EnviadosPorTipo): T[] {
  return tipos.filter((t) => quedanDelTipo(t, limite, enviados) !== 0);
}

/** "Esta campaña ya no recibe fotos: llegó a su límite de 100." */
export function mensajeDeTipoLleno(tipo: string, limite: LimitePorTipo): string {
  const plural = esTipo(tipo) ? PLURALES_DE_TIPO[tipo][1] : tipo;
  const n = esTipo(tipo) ? limite[tipo] : undefined;
  return `Esta campaña ya no recibe ${plural}: llegó a su límite${n ? ` de ${n}` : ""}.`;
}

/** "100 fotos (quedan 40)" o "100 fotos (completo)", para mostrar el límite de cada tipo. */
export function textoDelLimite(tipo: DataType, limite: LimitePorTipo, enviados: EnviadosPorTipo): string | null {
  const n = limite[tipo];
  if (!n) return null;
  const quedan = quedanDelTipo(tipo, limite, enviados) ?? 0;
  const nombre = PLURALES_DE_TIPO[tipo][n === 1 ? 0 : 1];
  return `${n} ${nombre} ${quedan === 0 ? "(completo)" : `(${quedan === 1 ? "queda 1" : `quedan ${quedan}`})`}`;
}

/** Tipos ordenados como en el formulario, para los resúmenes. */
const ORDEN: DataType[] = ["texto", "foto", "video", "audio", "documento"];

/**
 * "100 fotos (quedan 40) y 20 videos (completo)": los límites de los tipos que pide la campaña,
 * o null si ninguno tiene límite.
 */
export function resumenDeLimites(tipos: readonly string[], limite: LimitePorTipo, enviados: EnviadosPorTipo): string | null {
  const partes = ORDEN.filter((t) => tipos.includes(t))
    .map((t) => textoDelLimite(t, limite, enviados))
    .filter((p): p is string => Boolean(p));
  if (partes.length === 0) return null;
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/** Aviso cuando ya no cabe ningún tipo; null si todavía se puede aportar algo. */
export function avisoDeTodoLleno(tipos: readonly string[], limite: LimitePorTipo, enviados: EnviadosPorTipo): string | null {
  return tipos.length > 0 && tiposConLugar(tipos, limite, enviados).length === 0
    ? "Esta campaña ya recibió todos los aportes que pedía de cada tipo."
    : null;
}
