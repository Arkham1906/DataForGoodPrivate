"use server";

// Server actions del SuperUsuario en /supervisar: dictaminar campañas (las toma al hacerlo), y
// pausarlas, reanudarlas o finalizarlas.
// Cada una verifica la sesión raíz; la lógica está en ./decision.ts.

import { revalidatePath } from "next/cache";

import { hasRootSession } from "@/lib/rootSession";
import {
  ACCIONES_DE_SUPERVISION,
  registrarDecisionDeCampana,
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
 * Desde el 2026-10-22 (a pedido del usuario) no hay botón "Supervisar esta campaña" para el
 * SuperUsuario: si nadie la supervisa, aceptar o rechazar la toma en el mismo paso (con su
 * `supervision.tomar` en la bitácora). Si la tomó un supervisor con cuenta, se le respeta.
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

  // Ya la supervisa el SuperUsuario: sigue igual. Libre: la toma, después de validar. De otro supervisor: error.
  const resultado = await registrarDecisionDeCampana(campanaId, accion, entrada, { tipo: "root" }, { tomarSiEstaLibre: true });
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

