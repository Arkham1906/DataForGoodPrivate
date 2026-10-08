// Título de la pestaña (WCAG 2.4.2: que diga dónde estás). Cada pantalla queda "Título · DataForGood".
// En Next la plantilla solo pasa al nivel de abajo: un layout que declara su título como texto
// corta la herencia para las páginas más profundas. Por eso los layouts usan tituloDeSeccion(),
// que vuelve a poner la plantilla; las páginas pueden usar un texto simple.

export const PLANTILLA_DE_TITULO = "%s · DataForGood";

export function tituloDeSeccion(titulo: string) {
  return { default: titulo, template: PLANTILLA_DE_TITULO };
}
