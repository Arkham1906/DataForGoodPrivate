// Máximo por persona de cada tipo de dato (2026-10-31, a pedido del usuario: "si la campaña pide foto y
// video, una cuota de fotos y otra cuota de videos"). Solo con la meta POR TIPO DE DATO: ahí no se escribe
// cuota general; cada tipo que pide la campaña lleva su máximo (obligatorio, también con un solo tipo) y la
// cuota por persona es la suma (8 fotos + 4 videos = cuota 12; resolverCuotaYMaximos). Con la META GENERAL
// no hay máximos por tipo: solo la cuota escrita, de cualquier tipo (tercer pedido del usuario, el mismo
// día; el primero había sido "cuota general + máximos opcionales" en los dos modos). Cuentan todos los
// aportes de la persona de ese tipo, como la cuota general (borrar uno rechazado libera su lugar).
// Del 2026-10-21 al 2026-10-27 hubo un "reparto" que debía sumar la cuota (campanas.cuota_por_tipo,
// borrada el 2026-10-30); esto es otra cosa: un máximo por tipo.
// Se guarda en campana_tipos.cuota_por_persona y al leer una campaña llega como cuota_por_tipo
// ({ "foto": 8 }; columnasCalculadas de lib/campanas/tipos-de-campana.ts). Lo exige
// insertarAporteConCuota (lib/aportes/comun.ts). Sin imports de servidor: lo usan el formulario de
// campaña y las pantallas de aportar.

import type { DataType } from "@/types";
import { ORDEN_DE_TIPOS, PLURALES_DE_TIPO } from "@/lib/campanas/reparto-sugerido";

export type CuotaPorTipo = Partial<Record<DataType, number>>;
/** Cuántos aportes de cada tipo lleva una persona en la campaña. */
export type MiosPorTipo = Partial<Record<DataType, number>>;

function esTipo(valor: string): valor is DataType {
  return (ORDEN_DE_TIPOS as string[]).includes(valor);
}

/**
 * Lo que una persona puede mandar de un tipo no pasa de lo que recibe toda la campaña de ese tipo
 * (2026-11-04, a pedido del usuario): con límite de 5 fotos, el máximo por persona llega a 5.
 * Solo compara los tipos que traen los dos números.
 */
export function errorDeMaximoSobreLimite(
  maximos: Partial<Record<string, number>> | null | undefined,
  limite: Partial<Record<string, number>> | null | undefined,
): string | null {
  for (const tipo of ORDEN_DE_TIPOS) {
    const maximo = maximos?.[tipo];
    const tope = limite?.[tipo];
    if (maximo && tope && maximo > tope) {
      const plural = PLURALES_DE_TIPO[tipo][1];
      return `El máximo de ${plural} por persona (${maximo}) no puede ser mayor que el límite de ${plural} de la campaña (${tope})`;
    }
  }
  return null;
}

/**
 * Cuota y máximos por persona según cómo se mide la meta (2026-10-31, segundo pedido del usuario: "en por
 * tipo de dato quita la cuota por persona, ya se maneja un máximo de cada tipo"):
 * - `porTipo` (meta por tipo de dato): no hay cuota general que escribir. Cada tipo que pide la campaña
 *   lleva su máximo por persona (obligatorio si `exigirCompleto`, es decir, fuera de borrador; también con
 *   un solo tipo) y la cuota por persona es la suma (8 fotos + 4 videos = cuota 12).
 * - si no (meta general): la cuota escrita y ningún máximo por tipo (se borran los que hubiera).
 */
export function resolverCuotaYMaximos(entrada: {
  porTipo: boolean;
  maximos: unknown;
  tipos: readonly string[];
  cuotaEscrita: number;
  exigirCompleto: boolean;
}): { ok: true; cuota: number; maximos: CuotaPorTipo | null } | { ok: false; error: string } {
  if (!entrada.porTipo) return { ok: true, cuota: entrada.cuotaEscrita, maximos: null };
  const crudos = entrada.maximos && typeof entrada.maximos === "object" && !Array.isArray(entrada.maximos)
    ? (entrada.maximos as Record<string, unknown>)
    : {};
  const maximos: CuotaPorTipo = {};
  for (const tipo of ORDEN_DE_TIPOS.filter((t) => entrada.tipos.includes(t))) {
    const valor = crudos[tipo];
    const plural = PLURALES_DE_TIPO[tipo][1];
    if (valor === null || valor === undefined || valor === "" || valor === 0) {
      if (entrada.exigirCompleto) return { ok: false, error: `Falta el máximo de ${plural} por persona` };
      continue;
    }
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: `El máximo de ${plural} por persona debe ser un número entero mayor a 0` };
    maximos[tipo] = n;
  }
  const suma = Object.values(maximos).reduce((total, n) => total + (n ?? 0), 0);
  return { ok: true, cuota: suma > 0 ? suma : entrada.cuotaEscrita, maximos: suma > 0 ? maximos : null };
}

/**
 * Máximos con los que abre el formulario una campaña con meta por tipo guardada antes del 2026-10-31 (sin
 * máximos): su cuota repartida entre sus tipos, para que la suma siga dando la misma cuota (5 con un tipo
 * → 5; 10 entre foto, video y audio → 4, 3 y 3, lo que sobra a los primeros). Sin cuota, vacío.
 */
export function maximosDesdeLaCuota(tipos: readonly string[], cuota: number): CuotaPorTipo {
  const orden = ORDEN_DE_TIPOS.filter((t) => tipos.includes(t));
  if (orden.length === 0 || !Number.isInteger(cuota) || cuota < 1) return {};
  const base = Math.floor(cuota / orden.length);
  const sobra = cuota % orden.length;
  return Object.fromEntries(orden.map((t, i) => [t, Math.max(1, base + (i < sobra ? 1 : 0))]));
}

/** Lee un JSONB { tipo: número } (cuota_por_tipo de la fila, o los aportes de una persona por tipo). */
export function mapaPorTipo(valor: unknown, tipos?: readonly string[]): Partial<Record<DataType, number>> {
  const mapa: Partial<Record<DataType, number>> = {};
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return mapa;
  for (const [tipo, n] of Object.entries(valor as Record<string, unknown>)) {
    if (!esTipo(tipo) || (tipos && !tipos.includes(tipo))) continue;
    const numero = Number(n);
    if (Number.isInteger(numero) && numero > 0) mapa[tipo] = numero;
  }
  return mapa;
}

/** Máximos de la fila de `campanas` (cuota_por_tipo), solo de los tipos que pide hoy. */
export function cuotaPorTipoDesdeFila(row: { cuota_por_tipo?: unknown; data_types?: unknown }): CuotaPorTipo {
  const tipos = Array.isArray(row.data_types) ? row.data_types.map(String) : [];
  return mapaPorTipo(row.cuota_por_tipo, tipos);
}

/** Cuántos aportes de ese tipo le quedan a la persona; null = sin tope del tipo. */
export function quedanALaPersona(tipo: string, cuota: CuotaPorTipo, mios: MiosPorTipo): number | null {
  if (!esTipo(tipo) || !cuota[tipo]) return null;
  return Math.max(0, cuota[tipo]! - (mios[tipo] ?? 0));
}

/** Los tipos que la persona todavía puede mandar según su tope por tipo. */
export function tiposDentroDeSuCuota<T extends string>(tipos: readonly T[], cuota: CuotaPorTipo, mios: MiosPorTipo): T[] {
  return tipos.filter((t) => quedanALaPersona(t, cuota, mios) !== 0);
}

/** "Ya enviaste el máximo de 4 videos por persona en esta campaña." */
export function mensajeDeCuotaDelTipo(tipo: string, cuota: CuotaPorTipo): string {
  if (!esTipo(tipo) || !cuota[tipo]) return "Ya enviaste el máximo de ese tipo en esta campaña.";
  const n = cuota[tipo]!;
  return `Ya enviaste el máximo de ${n} ${PLURALES_DE_TIPO[tipo][n === 1 ? 0 : 1]} por persona en esta campaña.`;
}

/** "máximo 8 fotos y 4 videos por persona", o null si ningún tipo tiene tope. */
export function resumenDeCuotaPorTipo(tipos: readonly string[], cuota: CuotaPorTipo): string | null {
  const partes = ORDEN_DE_TIPOS.filter((t) => tipos.includes(t) && cuota[t]).map(
    (t) => `${cuota[t]} ${PLURALES_DE_TIPO[t][cuota[t] === 1 ? 0 : 1]}`,
  );
  if (partes.length === 0) return null;
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
  return `máximo ${lista} por persona`;
}

/**
 * Lo que le queda a la persona de cada tipo con tope: "te quedan 3 fotos y 0 videos" (para aportar).
 * null si ningún tipo tiene tope.
 */
export function resumenDeLoQueQueda(tipos: readonly string[], cuota: CuotaPorTipo, mios: MiosPorTipo): string | null {
  const partes = ORDEN_DE_TIPOS.filter((t) => tipos.includes(t) && cuota[t]).map((t) => {
    const quedan = quedanALaPersona(t, cuota, mios) ?? 0;
    return `${quedan} ${PLURALES_DE_TIPO[t][quedan === 1 ? 0 : 1]} (de ${cuota[t]})`;
  });
  if (partes.length === 0) return null;
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}
