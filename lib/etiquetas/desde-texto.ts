// Etiquetas que menciona el texto de intereses de una persona (2026-10-28, a pedido del usuario: si
// escribe "me gustan los perros", además de la temática Animales se marca la etiqueta Perros).
// Corre en el navegador (ui/SubtematicasDelPerfil). Compara palabra por palabra, sin acentos ni
// mayúsculas y en singular (singular() de lib/tematicas/analizar.ts): "perro", "perros" y "Perros" valen
// igual, y una etiqueta de varias palabras ("Agua potable") cuenta si salen seguidas. No adivina
// diminutivos ni sinónimos ("perritos" no marca Perros). Sin imports de servidor.

import { claveDeTematica, singular } from "@/lib/tematicas/analizar";

function palabrasEnSingular(texto: string): string[] {
  return claveDeTematica(texto).split(" ").filter(Boolean).map(singular);
}

/** Ids de las `etiquetas` cuyo nombre aparece en `texto`. */
export function etiquetasEnElTexto(texto: string, etiquetas: { id: number; nombre: string }[]): Set<number> {
  const palabras = palabrasEnSingular(texto);
  const encontradas = new Set<number>();
  if (palabras.length === 0) return encontradas;
  for (const etiqueta of etiquetas) {
    const buscadas = palabrasEnSingular(etiqueta.nombre);
    if (buscadas.length === 0) continue;
    for (let i = 0; i + buscadas.length <= palabras.length; i++) {
      if (buscadas.every((p, j) => palabras[i + j] === p)) {
        encontradas.add(etiqueta.id);
        break;
      }
    }
  }
  return encontradas;
}
