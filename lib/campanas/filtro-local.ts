// Filtro y orden de listas de campañas ya cargadas en el navegador (/supervision y
// /supervisar), con los mismos criterios que buscarCampanas() de ./sistema.ts aplica en SQL
// para /sistema/campanas. Sin imports de servidor: lo usan componentes cliente.

import { TEMAS_DE_INTERES } from "@/lib/intereses";

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
  // Las que no tienen fecha de cierre van al final.
  vence: (a, b) => {
    if (!a.endDate || !b.endDate) return a.endDate ? -1 : b.endDate ? 1 : 0;
    return a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0;
  },
};

/**
 * Aplica búsqueda (nombre, temática, creador o id exacto), temática, tipo de dato y orden.
 * Sin orden elegido ("Más recientes") respeta el orden en que llegó la lista, que las APIs
 * ya entregan de la más nueva a la más vieja.
 */
export function filtrarCampanas<T extends CampanaFiltrable>(
  lista: T[],
  filtros: FiltrosLocales,
  tematicaDe: (campana: T) => string,
): T[] {
  const q = filtros.q.trim().toLowerCase();
  const resultado = lista.filter((c) => {
    const tema = tematicaDe(c);
    if (filtros.tematica && tema !== filtros.tematica) return false;
    if (filtros.tematica && filtros.etiqueta && !(c.etiquetas ?? []).some((e) => e.nombre === filtros.etiqueta)) return false;
    if (filtros.tipo && !(c.dataTypes ?? []).includes(filtros.tipo)) return false;
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
 * si las tiene pero los filtros las ocultan todas, que ninguna coincide.
 */
export function avisoSinResultados(totalSinFiltrar: number, sinCampanas: string): string {
  return totalSinFiltrar === 0 ? sinCampanas : "Ninguna campaña coincide con estos filtros.";
}

/** Temáticas para el filtro: las compartidas y, al final, cualquier otra que traigan las campañas. */
export function opcionesDeTematica(temas: string[]): string[] {
  const extra = [...new Set(temas.filter((t) => t && !TEMAS_DE_INTERES.includes(t)))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  return [...TEMAS_DE_INTERES, ...extra];
}
