// Validación del diccionario de subtemáticas (2026-11-11, a pedido del usuario: "que estén validadas
// las variantes de las subtemáticas"). Revisa DICCIONARIO_DE_SUBTEMATICAS (./sinonimos.ts) contra las
// subtemáticas base (./base.ts) y las temáticas base (lib/intereses.ts), y devuelve los problemas
// en texto; vacío si todo está bien. Lo corre `npm run validar:diccionario`
// (scripts/validar-diccionario.mjs), que termina con error si hay alguno. Sin imports de servidor.
//
// Reglas, todas dentro de una temática (entre temáticas una variante sí puede repetirse: "albergues"
// es Refugios en Protección animal y Refugios temporales en Protección civil):
//   1. La temática existe y cada subtemática base tiene su entrada (aunque sea sin variantes).
//   2. Las variantes van en minúsculas, sin espacios de más, con letras, espacios, guiones o comas.
//   3. Ninguna variante se repite, repite el nombre de su subtemática ni es el nombre de una temática.
//   4. Ninguna variante está en dos subtemáticas de la misma temática.
//   5. Al proponerla, cada variante lleva a su subtemática y a ninguna otra (etiquetaEquivalente).
//   6. En un texto de intereses, cada variante marca su subtemática y solo esa (etiquetasEnElTexto),
//      salvo las de SOLO_AL_PROPONER, que a propósito no se buscan en textos.

import { TEMAS_DE_INTERES } from "@/lib/intereses";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { ETIQUETAS_BASE } from "@/lib/etiquetas/base";
import { DICCIONARIO_DE_SUBTEMATICAS, SOLO_AL_PROPONER, etiquetaEquivalente } from "@/lib/etiquetas/sinonimos";
import { etiquetasEnElTexto } from "@/lib/etiquetas/desde-texto";

const FORMATO_DE_VARIANTE = /^\p{Ll}[\p{Ll} ,-]*\p{Ll}$/u;

export function problemasDelDiccionario(): string[] {
  const problemas: string[] = [];
  const temas = new Map(TEMAS_DE_INTERES.map((t) => [claveDeTematica(t), t]));

  for (const [tematica, subtematicas] of Object.entries(DICCIONARIO_DE_SUBTEMATICAS)) {
    // 1. La temática y sus subtemáticas base.
    if (!temas.has(claveDeTematica(tematica))) problemas.push(`${tematica}: no es una temática base.`);
    for (const base of ETIQUETAS_BASE[tematica] ?? []) {
      if (!(base in subtematicas)) problemas.push(`${tematica} > ${base}: subtemática base sin entrada en el diccionario.`);
    }

    const nombres = Object.keys(subtematicas);
    const duenas = new Map<string, string>();
    const ids = nombres.map((nombre, id) => ({ id, nombre, tematica }));

    for (const [subtematica, variantes] of Object.entries(subtematicas)) {
      const lugar = `${tematica} > ${subtematica}`;
      const vistas = new Set<string>();
      for (const variante of variantes) {
        const clave = claveDeTematica(variante);
        // 2. Formato.
        if (!FORMATO_DE_VARIANTE.test(variante) || /\s{2,}/.test(variante)) {
          problemas.push(`${lugar}: «${variante}» debe ir en minúsculas, sin espacios de más y solo con letras, espacios, guiones o comas.`);
        }
        // 3. Repetida, igual a su subtemática o a una temática.
        if (vistas.has(clave)) problemas.push(`${lugar}: «${variante}» está repetida.`);
        vistas.add(clave);
        if (clave === claveDeTematica(subtematica)) problemas.push(`${lugar}: «${variante}» es el mismo nombre de la subtemática.`);
        if (temas.has(clave)) problemas.push(`${lugar}: «${variante}» es el nombre de la temática «${temas.get(clave)}».`);
        // 4. En dos subtemáticas de la misma temática.
        const otra = duenas.get(clave);
        if (otra && otra !== subtematica) problemas.push(`${lugar}: «${variante}» también es variante de «${otra}».`);
        duenas.set(clave, subtematica);
        // 5. Al proponerla lleva a su subtemática.
        const resuelve = etiquetaEquivalente(variante, nombres, { tematica });
        if (resuelve !== subtematica) {
          problemas.push(`${lugar}: al proponer «${variante}» ${resuelve ? `se toma como «${resuelve}»` : "no se reconoce como ninguna (ambigua)"}.`);
        }
        // 6. En un texto marca su subtemática y solo esa.
        if (SOLO_AL_PROPONER.has(variante)) continue;
        const marcadas = [...etiquetasEnElTexto(variante, ids)].map((id) => nombres[id]);
        if (marcadas.length !== 1 || marcadas[0] !== subtematica) {
          problemas.push(`${lugar}: en un texto, «${variante}» marca ${marcadas.length ? marcadas.map((m) => `«${m}»`).join(" y ") : "ninguna"}.`);
        }
      }
    }
  }
  return problemas;
}
