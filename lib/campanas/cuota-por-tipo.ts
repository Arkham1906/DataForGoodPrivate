// Cuota por persona repartida entre los tipos de dato de la campaña (2026-10-21, decisiones del
// usuario). Si una campaña pide foto y audio con cuota 10, cada persona puede mandar, por ejemplo,
// 5 fotos y 5 audios.
//   - El formulario sugiere partes iguales (lo que sobra va a los primeros tipos, en el orden de
//     ORDEN_DE_TIPOS) y el creador ajusta cada número; la suma debe dar la cuota por persona.
//   - Solo con dos tipos o más; con uno, la cuota general ya es la de ese tipo.
//   - La meta total no se reparte.
//   - Campañas sin reparto (NULL: las de antes, o con un solo tipo) siguen con la cuota general.
// Se guarda en campanas.cuota_por_tipo (JSONB). Sin imports de servidor: lo usan el formulario,
// las rutas de campañas y las de aportes.

import type { DataType } from "@/types";

export type CuotaPorTipo = Partial<Record<DataType, number>>;

/** Orden en que se reparte lo que sobra (el mismo de los botones del formulario). */
export const ORDEN_DE_TIPOS: DataType[] = ["texto", "foto", "video", "audio", "documento"];

const PLURALES: Record<DataType, [string, string]> = {
  texto: ["texto", "textos"],
  foto: ["foto", "fotos"],
  video: ["video", "videos"],
  audio: ["audio", "audios"],
  documento: ["documento", "documentos"],
};

function ordenar(tipos: readonly string[]): DataType[] {
  return ORDEN_DE_TIPOS.filter((t) => tipos.includes(t));
}

/** "5 fotos", "1 audio". */
export function cantidadDeTipo(tipo: DataType, cantidad: number): string {
  return `${cantidad} ${PLURALES[tipo][cantidad === 1 ? 0 : 1]}`;
}

/** Partes iguales; lo que sobra, uno a cada tipo empezando por el primero (10 entre 3 → 4, 3, 3). */
export function repartirCuota(cuota: number, tipos: readonly string[]): CuotaPorTipo {
  const orden = ordenar(tipos);
  if (orden.length === 0 || !Number.isInteger(cuota) || cuota <= 0) return {};
  const base = Math.floor(cuota / orden.length);
  const sobra = cuota % orden.length;
  return Object.fromEntries(orden.map((t, i) => [t, base + (i < sobra ? 1 : 0)]));
}

/**
 * Lee el reparto que llega del formulario o de la base: solo tipos de la campaña con un entero
 * de 0 en adelante. Devuelve null si la campaña tiene menos de dos tipos o no llegó nada.
 */
export function normalizarCuotaPorTipo(valor: unknown, tipos: readonly string[]): CuotaPorTipo | null {
  const orden = ordenar(tipos);
  if (orden.length < 2 || !valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const entrada = valor as Record<string, unknown>;
  const reparto: CuotaPorTipo = {};
  for (const tipo of orden) {
    const n = Number(entrada[tipo]);
    if (Number.isInteger(n) && n >= 0) reparto[tipo] = n;
  }
  return Object.keys(reparto).length > 0 ? reparto : null;
}

/** Qué le falta al reparto para enviar la campaña a revisión (null si está bien). */
export function errorDeCuotaPorTipo(cuota: number, tipos: readonly string[], reparto: CuotaPorTipo | null): string | null {
  const orden = ordenar(tipos);
  if (orden.length < 2) return null;
  if (!reparto) return "Reparte la cuota por persona entre los tipos de dato";
  for (const tipo of orden) {
    if (!reparto[tipo] || reparto[tipo]! < 1) return `Cada tipo de dato necesita al menos 1 aporte por persona (falta ${PLURALES[tipo][0]})`;
  }
  const suma = orden.reduce((total, t) => total + (reparto[t] ?? 0), 0);
  if (suma !== cuota) return `El reparto por tipo suma ${suma} y la cuota por persona es ${cuota}`;
  return null;
}

/** Cuántos aportes de ese tipo puede mandar cada persona; null = sin límite propio (vale la cuota general). */
export function limiteDelTipo(reparto: CuotaPorTipo | null | undefined, tipo: string): number | null {
  if (!reparto) return null;
  const n = reparto[tipo as DataType];
  return typeof n === "number" ? n : null;
}

/** "5 fotos y 5 audios" (null si no hay reparto). */
export function describirReparto(reparto: CuotaPorTipo | null | undefined): string | null {
  if (!reparto) return null;
  const partes = ORDEN_DE_TIPOS.filter((t) => typeof reparto[t] === "number").map((t) => cantidadDeTipo(t, reparto[t]!));
  if (partes.length === 0) return null;
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/** Mensaje cuando la persona ya mandó todos los de ese tipo. */
export function mensajeDeCuotaDelTipo(tipo: string, limite: number): string {
  const t = (ORDEN_DE_TIPOS as string[]).includes(tipo) ? (tipo as DataType) : null;
  return t
    ? `Ya llegaste al máximo de ${cantidadDeTipo(t, limite)} por persona en esta campaña`
    : "Ya alcanzaste tu cuota de este tipo en esta campaña";
}
