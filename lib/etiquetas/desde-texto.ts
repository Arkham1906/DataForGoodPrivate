// Etiquetas que menciona el texto de intereses de una persona (2026-10-28, a pedido del usuario: si
// escribe "me gustan los perros", además de la temática Animales se marca la etiqueta Perros).
// Corre en el navegador (ui/SubtematicasDelPerfil). Compara palabra por palabra, sin acentos ni
// mayúsculas y en singular (palabraBase() de lib/etiquetas/sinonimos.ts): "perro", "perros" y "Perros" valen
// igual, y una etiqueta de varias palabras ("Agua potable") cuenta si salen seguidas. Desde el
// 2026-11-07 también por sus sinónimos ("lomitos" marca Perros, lib/etiquetas/sinonimos.ts). Sin
// erratas: en un texto libre darían aciertos falsos. Sin imports de servidor.
// Desde el 2026-11-11 (a pedido del usuario, al validar las variantes):
//   - Gana la mención más larga: las palabras que ya forman parte de una variante no marcan otra
//     etiqueta. "Tala de árboles" es Deforestación y ya no marca también Árboles; "hoyos en la calle"
//     es Baches y no Calles y banquetas. Si "árboles" sale en otra parte del texto, sí cuenta.
//   - Con `tematica` en cada etiqueta, solo se usan las variantes del diccionario de esa temática.

import { claveDeTematica } from "@/lib/tematicas/analizar";
import { palabraBase, terminosDeEtiqueta } from "@/lib/etiquetas/sinonimos";

function palabrasEnSingular(texto: string): string[] {
  return claveDeTematica(texto).split(" ").filter(Boolean).map(palabraBase);
}

type Mencion = { id: number; inicio: number; largo: number };

/** Dónde aparece `buscadas` (palabras seguidas) en `palabras`. */
function posiciones(buscadas: string[], palabras: string[]): number[] {
  const halladas: number[] = [];
  if (buscadas.length === 0) return halladas;
  for (let i = 0; i + buscadas.length <= palabras.length; i++) {
    if (buscadas.every((p, j) => palabras[i + j] === p)) halladas.push(i);
  }
  return halladas;
}

/** Ids de las `etiquetas` cuyo nombre o algún sinónimo aparece en `texto`. */
export function etiquetasEnElTexto(texto: string, etiquetas: { id: number; nombre: string; tematica?: string }[]): Set<number> {
  const palabras = palabrasEnSingular(texto);
  const encontradas = new Set<number>();
  if (palabras.length === 0) return encontradas;

  const menciones: Mencion[] = [];
  for (const etiqueta of etiquetas) {
    for (const termino of terminosDeEtiqueta(etiqueta.nombre, etiqueta.tematica)) {
      const buscadas = palabrasEnSingular(termino);
      for (const inicio of posiciones(buscadas, palabras)) menciones.push({ id: etiqueta.id, inicio, largo: buscadas.length });
    }
  }

  // De la más larga a la más corta: una mención que cabe completa dentro de una más larga de otra
  // etiqueta ya aceptada no cuenta.
  menciones.sort((a, b) => b.largo - a.largo);
  const aceptadas: Mencion[] = [];
  for (const m of menciones) {
    const dentroDeOtra = aceptadas.some(
      (a) => a.id !== m.id && a.largo > m.largo && m.inicio >= a.inicio && m.inicio + m.largo <= a.inicio + a.largo,
    );
    if (dentroDeOtra) continue;
    aceptadas.push(m);
    encontradas.add(m.id);
  }
  return encontradas;
}
