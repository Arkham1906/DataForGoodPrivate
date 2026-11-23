// Lado del servidor de components/sistema/FiltrosEnLaUrl (2026-11-22): lee los filtros de la URL y compara texto
// sin mayúsculas ni acentos. Lo usan las pantallas del panel que filtran listas ya cargadas en la página.

/** Minúsculas, sin acentos y con un solo espacio entre palabras. */
export function normalizarParaBuscar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** La búsqueda de la URL, normalizada y de hasta 100 caracteres ("" si no hay). */
export function busquedaDeLaUrl(valor: unknown): string {
  return typeof valor === "string" ? normalizarParaBuscar(valor.slice(0, 100)) : "";
}

/** El valor de la URL si es uno de los permitidos; si no, "" (sin filtro). */
export function opcionDeLaUrl<T extends string>(valor: unknown, permitidos: readonly T[]): T | "" {
  return typeof valor === "string" && (permitidos as readonly string[]).includes(valor) ? (valor as T) : "";
}

/** ¿Están todas las palabras de `busqueda` (ya normalizada) en alguno de los campos? Sin búsqueda, sí. */
export function coincideConLaBusqueda(
  busqueda: string,
  ...campos: (string | number | null | undefined)[]
): boolean {
  if (!busqueda) return true;
  const texto = normalizarParaBuscar(campos.filter((c) => c !== null && c !== undefined).join(" "));
  return busqueda.split(" ").every((palabra) => texto.includes(palabra));
}

/** "3 de 10" cuando el filtro deja fuera algo; el total si no. */
export function cuantosDeCuantos(mostrados: number, total: number): string {
  return mostrados === total ? String(total) : `${mostrados} de ${total}`;
}
