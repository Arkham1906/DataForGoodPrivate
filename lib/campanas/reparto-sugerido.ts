// Reparto sugerido de la cuota por persona entre los tipos de dato (2026-10-27, decisión del
// usuario). Solo es una sugerencia para que los aportes queden balanceados entre tipos: la persona
// puede mandar hasta la cuota general de cualquier tipo (p. ej. con cuota 10, foto y audio: 8 fotos y
// 2 audios valen). Del 2026-10-21 al 2026-10-27 la cuota se repartía por tipo y se exigía
// (campanas.cuota_por_tipo, que quedó sin uso); se quitó a pedido del usuario. La meta no se reparte.
// Sin imports de servidor: lo usan el formulario de campaña y las pantallas que muestran la cuota.

import type { DataType } from "@/types";

/** Orden fijo de los tipos (el de los botones del formulario). */
export const ORDEN_DE_TIPOS: DataType[] = ["texto", "foto", "video", "audio", "documento"];

/** [singular, plural] de cada tipo: "foto"/"fotos". */
export const PLURALES_DE_TIPO: Record<DataType, [string, string]> = {
  texto: ["texto", "textos"],
  foto: ["foto", "fotos"],
  video: ["video", "videos"],
  audio: ["audio", "audios"],
  documento: ["archivo", "archivos"],
};

/** "5 fotos", "1 audio". */
export function cantidadDeTipo(tipo: DataType, cantidad: number): string {
  return `${cantidad} ${PLURALES_DE_TIPO[tipo][cantidad === 1 ? 0 : 1]}`;
}

/**
 * Sugerencia de reparto balanceado, o null si no aplica (menos de dos tipos o sin cuota). Partes
 * iguales; si no divide exacto, lo que sobra va a los primeros tipos (10 entre 3 → 4, 3 y 3):
 * "unos 5 de cada tipo" o "4 textos, 3 fotos y 3 audios".
 */
export function repartoSugerido(cuota: number | null | undefined, tipos: readonly string[]): string | null {
  const orden = ORDEN_DE_TIPOS.filter((t) => tipos.includes(t));
  if (orden.length < 2 || !cuota || !Number.isInteger(cuota) || cuota < orden.length) return null;
  const base = Math.floor(cuota / orden.length);
  const sobra = cuota % orden.length;
  if (sobra === 0) return `unos ${base} de cada tipo`;
  const partes = orden.map((t, i) => cantidadDeTipo(t, base + (i < sobra ? 1 : 0)));
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}
