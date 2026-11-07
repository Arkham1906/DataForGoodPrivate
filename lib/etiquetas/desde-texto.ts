// Etiquetas que menciona el texto de intereses de una persona (2026-10-28, a pedido del usuario: si
// escribe "me gustan los perros", además de la temática Animales se marca la etiqueta Perros).
// Corre en el navegador (ui/SubtematicasDelPerfil). Compara palabra por palabra, sin acentos ni
// mayúsculas y en singular (palabraBase() de lib/etiquetas/sinonimos.ts): "perro", "perros" y "Perros" valen
// igual, y una etiqueta de varias palabras ("Agua potable") cuenta si salen seguidas. Desde el
// 2026-11-07 también por sus sinónimos ("lomitos" marca Perros, lib/etiquetas/sinonimos.ts). Sin
// erratas: en un texto libre darían aciertos falsos. Sin imports de servidor.

import { claveDeTematica } from "@/lib/tematicas/analizar";
import { palabraBase, terminosDeEtiqueta } from "@/lib/etiquetas/sinonimos";

function palabrasEnSingular(texto: string): string[] {
  return claveDeTematica(texto).split(" ").filter(Boolean).map(palabraBase);
}

function aparece(buscadas: string[], palabras: string[]): boolean {
  if (buscadas.length === 0) return false;
  for (let i = 0; i + buscadas.length <= palabras.length; i++) {
    if (buscadas.every((p, j) => palabras[i + j] === p)) return true;
  }
  return false;
}

/** Ids de las `etiquetas` cuyo nombre o algún sinónimo aparece en `texto`. */
export function etiquetasEnElTexto(texto: string, etiquetas: { id: number; nombre: string }[]): Set<number> {
  const palabras = palabrasEnSingular(texto);
  const encontradas = new Set<number>();
  if (palabras.length === 0) return encontradas;
  for (const etiqueta of etiquetas) {
    if (terminosDeEtiqueta(etiqueta.nombre).some((t) => aparece(palabrasEnSingular(t), palabras))) {
      encontradas.add(etiqueta.id);
    }
  }
  return encontradas;
}
