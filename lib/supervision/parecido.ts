// Qué tanto se parecen dos campañas (2026-11-07, a pedido del usuario): antes "Campañas similares" solo
// comparaba la temática. Compara cinco cosas: temática, subtemáticas, nombre, descripción y tipos de
// dato. Sin imports de servidor: es lógica pura y la usan lib/supervision/similares.ts y
// components/supervision/CampanasSimilares.

import { palabrasQueImportan } from "@/lib/etiquetas/sinonimos";
import { claveDeTematica } from "@/lib/tematicas/analizar";

export type Coincidencia = "tematica" | "subtematica" | "nombre" | "descripcion" | "tipos";

/** En el orden en que se muestran. */
export const NOMBRE_DE_COINCIDENCIA: Record<Coincidencia, string> = {
  tematica: "Temática",
  subtematica: "Subtemática",
  nombre: "Nombre",
  descripcion: "Descripción",
  tipos: "Tipos de dato",
};

export type DatosParaComparar = {
  tematica: string;
  etiquetas: string[];
  name: string;
  description: string;
  dataTypes: string[];
};

/** Lo que dice cualquier campaña: que dos las compartan no significa que se parezcan. */
const PALABRAS_COMUNES = new Set(
  (
    "ante bajo cada cerca como cual cuando desde donde durante entre esta estas este esto estos hacer hasta " +
    "mas mediante mismo mucho muy nuestra nuestro otra otro para pero porque puede pueden sera sobre solo " +
    "tambien tiene todas todo todos tras ayuda ayudar campana colaborar dato datos enviar estado fotos fotografia " +
    "informacion mejorar municipio objetivo participar persona personas proyecto queremos recoleccion " +
    "recolectar recopilar registrar registro subir tepic buscamos comunidad lugar zona"
  ).split(" "),
);

/** Palabras con significado de un texto, normalizadas como las etiquetas (singular, ortografía). */
function palabrasClave(texto: string): Set<string> {
  const utiles = claveDeTematica(texto)
    .split(" ")
    .filter((p) => p.length >= 4 && !PALABRAS_COMUNES.has(p));
  return new Set(utiles.length > 0 ? palabrasQueImportan(utiles.join(" ")) : []);
}

function enComun(a: Set<string>, b: Set<string>): number {
  return [...a].filter((p) => b.has(p)).length;
}

/** Nombres cortos: "Limpieza de playas" y "Limpieza de las playas de Tepic" comparten casi todo. */
function nombresParecidos(a: string, b: string): boolean {
  const clavesA = palabrasClave(a);
  const clavesB = palabrasClave(b);
  const comunes = enComun(clavesA, clavesB);
  return comunes >= 2 || (comunes === 1 && Math.min(clavesA.size, clavesB.size) === 1);
}

/** Textos largos: pide varias palabras y una parte real del texto más corto, no una coincidencia suelta. */
function descripcionesParecidas(a: string, b: string): boolean {
  const clavesA = palabrasClave(a);
  const clavesB = palabrasClave(b);
  const comunes = enComun(clavesA, clavesB);
  return comunes >= 4 && comunes / Math.min(clavesA.size, clavesB.size) >= 0.3;
}

const PESOS: Record<Coincidencia, number> = { nombre: 4, subtematica: 3, descripcion: 3, tematica: 2, tipos: 1 };

/** Las coincidencias entre dos campañas y su puntaje. */
export function compararCampanas(
  a: DatosParaComparar,
  b: DatosParaComparar,
): { coincidencias: Coincidencia[]; puntaje: number } {
  const clavesDe = (lista: string[]) => new Set(lista.map(claveDeTematica));
  const etiquetasDeA = clavesDe(a.etiquetas);
  const tiposDeA = new Set(a.dataTypes);
  const iguales: Record<Coincidencia, boolean> = {
    tematica: claveDeTematica(a.tematica) !== "" && claveDeTematica(a.tematica) === claveDeTematica(b.tematica),
    subtematica: [...clavesDe(b.etiquetas)].some((e) => etiquetasDeA.has(e)),
    nombre: nombresParecidos(a.name, b.name),
    descripcion: descripcionesParecidas(a.description, b.description),
    tipos: b.dataTypes.some((t) => tiposDeA.has(t)),
  };
  const coincidencias = (Object.keys(NOMBRE_DE_COINCIDENCIA) as Coincidencia[]).filter((c) => iguales[c]);
  return { coincidencias, puntaje: coincidencias.reduce((total, c) => total + PESOS[c], 0) };
}

/**
 * Si una campaña entra en la lista: la misma temática, o de otra temática pero con el mismo nombre,
 * descripción o subtemática. Los tipos de dato solos no bastan: casi todas piden fotos.
 */
export function esSimilar(coincidencias: Coincidencia[]): boolean {
  return coincidencias.some((c) => c !== "tipos");
}
