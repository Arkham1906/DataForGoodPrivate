"use server";

// Server actions del SuperUsuario en /supervisar: tomar y dictaminar campañas, y pausarlas,
// reanudarlas o finalizarlas.
// Cada una verifica la sesión raíz; la lógica está en ./decision.ts.

import { revalidatePath } from "next/cache";

import { hasRootSession } from "@/lib/rootSession";
import {
  ACCIONES_DE_SUPERVISION,
  registrarDecisionDeCampana,
  tomarCampanaParaSupervisar,
  type AccionDeSupervision,
  type EntradaDeDecision,
} from "@/lib/supervision/decision";
import {
  CAMBIOS_DE_ESTADO_POR_SUPERVISION,
  cambiarEstadoPorSupervision,
  type CambioDeEstadoPorSupervision,
} from "@/lib/supervision/estado-por-supervision";

export type ResultadoDeSupervision = { ok: true; mensaje: string } | { ok: false; error: string };

/**
 * Dictamen del SuperUsuario desde /supervisar. Mismas reglas que un
 * supervisor (motivo obligatorio al rechazar, sanción opcional al creador, aceptada con
 * inicio futuro, notificación al creador), pero la autoría queda como SuperUsuario.
 */
export async function decidirComoSuperUsuario(
  campanaId: string,
  accion: AccionDeSupervision,
  entrada: EntradaDeDecision = {},
): Promise<ResultadoDeSupervision> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!/^\d+$/.test(campanaId) || !ACCIONES_DE_SUPERVISION.has(accion)) {
    return { ok: false, error: "Petición inválida." };
  }

  const resultado = await registrarDecisionDeCampana(campanaId, accion, entrada, { tipo: "root" });
  if (!resultado.ok) return { ok: false, error: resultado.error };

  revalidatePath("/supervisar", "layout");
  return { ok: true, mensaje: resultado.mensaje };
}

/**
 * Pausar (con motivo), reanudar o finalizar (con motivo) una campaña aceptada, la supervise
 * quien la supervise (2026-10-15). Reglas en ./estado-por-supervision.ts.
 */
export async function cambiarEstadoComoSuperUsuario(
  campanaId: string,
  cambio: CambioDeEstadoPorSupervision,
  motivo: string,
): Promise<ResultadoDeSupervision> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!/^\d+$/.test(campanaId) || !CAMBIOS_DE_ESTADO_POR_SUPERVISION.has(cambio)) {
    return { ok: false, error: "Petición inválida." };
  }

  const resultado = await cambiarEstadoPorSupervision(campanaId, cambio, motivo, { tipo: "root" });
  if (!resultado.ok) return { ok: false, error: resultado.error };

  revalidatePath("/supervisar", "layout");
  return { ok: true, mensaje: resultado.mensaje };
}

/** "Supervisar esta campaña": el SuperUsuario la toma en exclusiva. */
export async function tomarComoSuperUsuario(campanaId: string): Promise<ResultadoDeSupervision> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!/^\d+$/.test(campanaId)) return { ok: false, error: "Petición inválida." };

  const resultado = await tomarCampanaParaSupervisar(campanaId, { tipo: "root" });
  if (!resultado.ok) return { ok: false, error: resultado.error };

  revalidatePath("/supervisar", "layout");
  return { ok: true, mensaje: "Ahora supervisas esta campaña" };
}
