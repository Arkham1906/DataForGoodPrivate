// Ruta pública de cada temática (2026-11-12, a pedido del usuario, como las páginas de categoría de GoFundMe):
// /explorar/tematica/<slug>, con todas sus campañas activas. El slug sale del nombre: sin acentos, en
// minúsculas y con guiones ("Agua y saneamiento" → "agua-y-saneamiento"). No se guarda: la página lo busca
// entre las temáticas (resolverTematicaDeRuta en lib/campanas/publicas.ts). Sin imports de servidor.

/** "Agua y saneamiento" → "agua-y-saneamiento". */
export function slugDeTematica(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pantalla con todas las campañas activas de la temática. */
export function rutaDeTematica(nombre: string): string {
  return `/explorar/tematica/${slugDeTematica(nombre)}`;
}
