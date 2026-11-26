// Filtro y orden de listas de campañas ya cargadas en el navegador, con los mismos criterios que
// buscarCampanas() de ./sistema.ts aplica en SQL. El modo de tipos puede requerir todos o alguno.
// Sin imports de servidor: lo usan componentes cliente.

import { TEMAS_DE_INTERES } from "@/lib/intereses";
import { NOMBRE_DE_TIPO, mensajeSinTiposDeDato, tiposDesde } from "@/lib/campanas/sistema-opciones";

export type FiltrosLocales = { q: string; tematica: string; etiqueta?: string; tipo: string; orden: string };

export const FILTROS_VACIOS: FiltrosLocales = { q: "", tematica: "", etiqueta: "", tipo: "", orden: "" };

/** Cambia un filtro; otra temática vacía la etiqueta (subtemática), que ya no aplica. */
export function conFiltro(actuales: FiltrosLocales, clave: string, valor: string): FiltrosLocales {
  return { ...actuales, [clave]: valor, ...(clave === "tematica" ? { etiqueta: "" } : {}) };
}

type CampanaFiltrable = {
  id: string;
  name: string;
  creatorName?: string;
  dataTypes?: string[];
  /** Subtemáticas (2026-10-27). */
  etiquetas?: { nombre: string }[];
  participants?: number;
  currentContributions?: number;
  approvedContributions?: number;
  goalContributions?: number;
  endDate?: string | null;
};

type ModoDeCoincidenciaDeTipos = "todos" | "alguno";

function coincideConTipos(campana: CampanaFiltrable, tipos: readonly string[], modo: ModoDeCoincidenciaDeTipos): boolean {
  if (tipos.length === 0) return true;
  return modo === "alguno"
    ? tipos.some((tipo) => (campana.dataTypes ?? []).includes(tipo))
    : tipos.every((tipo) => (campana.dataTypes ?? []).includes(tipo));
}

// La meta cuenta solo los aprobados (./meta.ts).
function avance(c: CampanaFiltrable) {
  const meta = Number(c.goalContributions ?? 0);
  return meta > 0 ? Number(c.approvedContributions ?? 0) / meta : 0;
}

// Mismos órdenes que ORDEN_SQL de ./sistema.ts; el desempate es el id más alto.
const COMPARADORES: Record<string, (a: CampanaFiltrable, b: CampanaFiltrable) => number> = {
  participantes: (a, b) => Number(b.participants ?? 0) - Number(a.participants ?? 0),
  aportes: (a, b) => Number(b.currentContributions ?? 0) - Number(a.currentContributions ?? 0),
  avance: (a, b) => avance(b) - avance(a),
  menor_avance: (a, b) => avance(a) - avance(b),
  menos_aportes: (a, b) => Number(a.currentContributions ?? 0) - Number(b.currentContributions ?? 0),
  // Las que no tienen fecha de cierre van al final.
  vence: (a, b) => {
    if (!a.endDate || !b.endDate) return a.endDate ? -1 : b.endDate ? 1 : 0;
    return a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0;
  },
};

/**
 * Aplica búsqueda (nombre, temática, creador o id exacto), temática, tipo de dato y orden.
 * `modoDeTipos` es AND por defecto; `alguno` usa OR. Sin orden elegido ("Más recientes") respeta
 * el orden en que llegó la lista, que las APIs ya entregan de la más nueva a la más vieja.
 */
export function filtrarCampanas<T extends CampanaFiltrable>(
  lista: T[],
  filtros: FiltrosLocales,
  tematicaDe: (campana: T) => string,
  modoDeTipos: ModoDeCoincidenciaDeTipos = "todos",
): T[] {
  const q = filtros.q.trim().toLowerCase();
  const tipos = tiposDesde(filtros.tipo);
  const resultado = lista.filter((c) => {
    const tema = tematicaDe(c);
    if (filtros.tematica && tema !== filtros.tematica) return false;
    if (filtros.tematica && filtros.etiqueta && !(c.etiquetas ?? []).some((e) => e.nombre === filtros.etiqueta)) return false;
    if (!coincideConTipos(c, tipos, modoDeTipos)) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      tema.toLowerCase().includes(q) ||
      (c.etiquetas ?? []).some((e) => e.nombre.toLowerCase().includes(q)) ||
      (c.creatorName ?? "").toLowerCase().includes(q) ||
      c.id === filtros.q.trim()
    );
  });

  const comparar = COMPARADORES[filtros.orden];
  if (!comparar) return resultado;
  return [...resultado].sort((a, b) => comparar(a, b) || Number(b.id) - Number(a.id));
}

/**
 * Cuántas campañas de `lista` quedarían al marcar cada tipo de dato además de los ya `elegidos` (2026-11-25):
 * el número junto a cada casilla de SelectorDeTipos. Para un tipo ya marcado, cuenta las que salen ahora. `lista` va
 * con los demás filtros aplicados y sin el de tipo. Siempre los 5 tipos. El modo predeterminado requiere todos.
 */
export function conteoDeTipos<T extends CampanaFiltrable>(
  lista: T[],
  elegidos: string,
  modoDeTipos: ModoDeCoincidenciaDeTipos = "todos",
): Record<string, number> {
  const marcados: string[] = tiposDesde(elegidos);
  return Object.fromEntries(
    Object.keys(NOMBRE_DE_TIPO).map((tipo) => {
      const pedidos = marcados.includes(tipo) ? marcados : [...marcados, tipo];
      return [tipo, lista.filter((c) => coincideConTipos(c, pedidos, modoDeTipos)).length];
    }),
  );
}

/** Etiquetas de cada temática en una lista de campañas, en orden alfabético (para el filtro de etiqueta). */
export function etiquetasPorTematica<T extends CampanaFiltrable>(
  lista: T[],
  tematicaDe: (campana: T) => string,
): Record<string, string[]> {
  const porTema = new Map<string, Set<string>>();
  for (const c of lista) {
    const tema = tematicaDe(c);
    for (const e of c.etiquetas ?? []) {
      const nombres = porTema.get(tema) ?? new Set<string>();
      nombres.add(e.nombre);
      porTema.set(tema, nombres);
    }
  }
  return Object.fromEntries([...porTema].map(([tema, nombres]) => [tema, [...nombres].sort((a, b) => a.localeCompare(b, "es"))]));
}

/**
 * Aviso de lista vacía: si la pestaña no tiene campañas, el texto propio de esa pestaña;
 * si las tiene pero los filtros las ocultan todas, que ninguna coincide. Con `porTipo` (2026-11-24): si
 * sin el filtro de tipo de dato sí habría alguna, dice que no hay campañas con esos tipos (mensajeSinTiposDeDato).
 */
export function avisoSinResultados(
  totalSinFiltrar: number,
  sinCampanas: string,
  porTipo?: { tipo: string; sinFiltroDeTipo: number; modo?: ModoDeCoincidenciaDeTipos },
): string {
  if (totalSinFiltrar === 0) return sinCampanas;
  if (porTipo && porTipo.sinFiltroDeTipo > 0) {
    return mensajeSinTiposDeDato(porTipo.tipo, "campañas", porTipo.modo) || "Ninguna campaña coincide con estos filtros.";
  }
  return "Ninguna campaña coincide con estos filtros.";
}

/** Temáticas para el filtro: las compartidas y, al final, cualquier otra que traigan las campañas. */
export function opcionesDeTematica(temas: string[]): string[] {
  const extra = [...new Set(temas.filter((t) => t && !TEMAS_DE_INTERES.includes(t)))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  return [...TEMAS_DE_INTERES, ...extra];
}
