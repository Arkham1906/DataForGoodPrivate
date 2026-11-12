// Temática que ya existe y equivale a la que alguien propone (2026-11-11, a pedido del usuario: "si
// quiere agregar una temática similar a la que ya existe, asignarle esa automáticamente"). Decisión del
// usuario: cuenta el nombre y también el significado.
//   1. El nombre escrito de otra forma: plural, acentos, espacios, orden, palabras vacías, muletillas,
//      ortografía o una errata ("Medioambiente", "Deportes", "Salúd"). Las reglas son las de las
//      subtemáticas (etiquetaEquivalente de lib/etiquetas/sinonimos.ts), sin su diccionario de variantes.
//   2. El significado, con el diccionario de palabras clave de los intereses (analizarIntereses de
//      ./analizar.ts): "Ecología" → Medio ambiente, "Mascotas" → Protección animal. Solo si apunta a
//      UNA temática del catálogo: "Robótica educativa" (Tecnología y Educación) se puede proponer.
// Sin imports de servidor: lo usan ui/SelectorDeTemas (para elegir la existente al proponer) y
// lib/tematicas/catalogo.ts (que manda).

import { analizarIntereses, claveDeTematica } from "@/lib/tematicas/analizar";
import { etiquetaEquivalente } from "@/lib/etiquetas/sinonimos";

/** De `catalogo` (temáticas que se ofrecen), la que equivale a `escrito`, o null si no hay una sola. */
export function tematicaEquivalente(escrito: string, catalogo: string[]): string | null {
  const limpio = escrito.trim().replace(/\s+/g, " ");
  if (!claveDeTematica(limpio) || catalogo.length === 0) return null;

  // Temática "" a propósito: así no entran las variantes del diccionario de subtemáticas, que son de
  // subtemáticas ("Fauna", "Reciclaje") y no de temáticas.
  const porNombre = etiquetaEquivalente(limpio, catalogo, { tematica: "" });
  if (porNombre) return porNombre;

  const delCatalogo = new Map(catalogo.map((nombre) => [claveDeTematica(nombre), nombre]));
  const porSignificado = new Set(
    analizarIntereses(limpio, catalogo)
      .tematicas.map((tema) => delCatalogo.get(claveDeTematica(tema)))
      .filter((tema): tema is string => Boolean(tema)),
  );
  return porSignificado.size === 1 ? [...porSignificado][0] : null;
}

/**
 * Aviso al marcar la temática que ya existe en lugar de proponer la escrita (igual o parecida).
 * Texto pedido por el usuario (2026-11-12): "Esa temática ya existe, es «…»".
 */
export function avisoDeTematicaExistente(existente: string): string {
  return `Esa temática ya existe, es «${existente}». La marcamos para ti.`;
}
