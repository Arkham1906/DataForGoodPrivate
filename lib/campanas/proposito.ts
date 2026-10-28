// Propósito de una campaña: ¿para qué se utilizarán los datos? (2026-10-27, decisiones del usuario).
// Uno por campaña, de esta lista, u "Otro" con una frase corta. Obligatorio al enviar a revisión (un
// borrador puede quedar sin él). Se guarda en campanas.proposito (el valor) y campanas.proposito_otro
// (la frase de "Otro"). Se muestra en la campaña, en los acuerdos al inscribirse o aportar y en datos
// abiertos. Sin imports de servidor: lo usan el formulario, las pantallas y las rutas.

import { esInapropiada } from "@/lib/tematicas/filtro";

export const PROPOSITOS = [
  { valor: "investigacion_cientifica", etiqueta: "Investigación científica" },
  { valor: "desarrollo_ia", etiqueta: "Desarrollo de IA" },
  { valor: "monitoreo", etiqueta: "Monitoreo" },
  { valor: "prevencion", etiqueta: "Prevención" },
  { valor: "diagnostico", etiqueta: "Diagnóstico o detección" },
  { valor: "educacion", etiqueta: "Educación" },
  { valor: "planeacion", etiqueta: "Planeación" },
  { valor: "toma_de_decisiones", etiqueta: "Toma de decisiones" },
  { valor: "concientizacion", etiqueta: "Concientización" },
  { valor: "desarrollo_tecnologico", etiqueta: "Desarrollo tecnológico" },
  { valor: "politicas_publicas", etiqueta: "Políticas públicas" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

export type Proposito = (typeof PROPOSITOS)[number]["valor"];

/** Largo máximo de la frase de "Otro" (= columna campanas.proposito_otro). */
export const LARGO_MAXIMO_PROPOSITO_OTRO = 80;

const VALORES = new Set<string>(PROPOSITOS.map((p) => p.valor));

export function esProposito(valor: unknown): valor is Proposito {
  return typeof valor === "string" && VALORES.has(valor);
}

/** Cómo se lee el propósito: la etiqueta de la lista o, con "Otro", la frase. null si no tiene. */
export function textoDelProposito(proposito: unknown, otro?: unknown): string | null {
  if (!esProposito(proposito)) return null;
  if (proposito === "otro") return String(otro ?? "").trim() || "Otro";
  return PROPOSITOS.find((p) => p.valor === proposito)?.etiqueta ?? null;
}

/**
 * Valida el propósito que llega del formulario. `exigir`: la campaña va a revisión (no es borrador).
 * Devuelve el error, o los valores limpios para guardar (null = sin propósito).
 */
export function validarProposito(
  entrada: unknown,
  otroEntrada: unknown,
  exigir: boolean,
): { ok: true; proposito: Proposito | null; otro: string | null } | { ok: false; error: string } {
  const proposito = String(entrada ?? "").trim();
  if (!proposito) {
    return exigir ? { ok: false, error: "Elige el propósito: ¿para qué se utilizarán los datos?" } : { ok: true, proposito: null, otro: null };
  }
  if (!esProposito(proposito)) return { ok: false, error: "Ese propósito no está en la lista" };
  if (proposito !== "otro") return { ok: true, proposito, otro: null };
  const otro = String(otroEntrada ?? "").trim().replace(/\s+/g, " ");
  if (!otro) return { ok: false, error: "Escribe para qué se utilizarán los datos (propósito «Otro»)" };
  if (otro.length > LARGO_MAXIMO_PROPOSITO_OTRO) {
    return { ok: false, error: `El propósito no puede pasar de ${LARGO_MAXIMO_PROPOSITO_OTRO} caracteres` };
  }
  if (esInapropiada(otro)) return { ok: false, error: "El propósito tiene palabras que no se permiten" };
  return { ok: true, proposito, otro };
}
