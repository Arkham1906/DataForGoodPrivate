// Clases compartidas por los catálogos públicos con el estilo de la landing (/explorar y /datos; /leaderboard
// usa las de orden para sus categorías). La opción elegida va en oscuro, como las pestañas de la landing. En
// móvil, los filtros son una fila con scroll horizontal (`dashboard-nav`); en escritorio, una columna.

export const ETIQUETA_DE_FILTRO = "mb-2 font-mono text-[12.5px] text-system-600";

export const FILA_DE_FILTROS =
  "dashboard-nav flex min-w-0 flex-row gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-col md:gap-1 md:overflow-visible md:pb-0";

export function claseDeFiltro(elegido: boolean): string {
  return `flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-pill border px-3 py-1.5 text-[12.5px] md:shrink md:rounded-[10px] md:border-0 md:px-2.5 md:py-1.5 md:text-[13px] ${
    elegido
      ? "border-system-900 bg-system-900 font-semibold text-white"
      : "border-system-300 bg-white text-system-600 hover:bg-system-100 md:border-transparent md:bg-transparent"
  }`;
}

/** El número de cada filtro: sobre la opción elegida (oscura), el gris no se leería. */
export function claseDeContador(elegido: boolean): string {
  return `font-mono text-[11px] ${elegido ? "text-white/75" : "text-system-500"}`;
}

export function claseDeOrden(elegido: boolean): string {
  return `shrink-0 whitespace-nowrap rounded-[10px] px-3.5 py-2 text-[13.5px] transition-colors ${
    elegido ? "bg-system-900 font-semibold text-white" : "text-system-600 hover:text-system-900"
  }`;
}
