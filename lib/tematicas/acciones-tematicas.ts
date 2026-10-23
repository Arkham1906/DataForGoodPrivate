"use server";

// Server actions de /sistema/tematicas: el SuperUsuario oculta o vuelve a mostrar una temática del
// catálogo, y aprueba o rechaza las nuevas que escriben los usuarios (2026-10-19). Oculta deja de ofrecerse en /bienvenida, /cuenta y el formulario de campaña, pero no se
// quita de los perfiles ni de las campañas que ya la tienen. Queda en audit_log.

import { revalidatePath } from "next/cache";

import { hasRootSession } from "@/lib/rootSession";
import { registrarAuditoria } from "@/lib/auditoria";
import { aprobar, cambiarVisibilidad, rechazar } from "@/lib/tematicas/catalogo";

export type ResultadoDeAccion = { ok: true } | { ok: false; error: string };

export async function cambiarVisibilidadDeTematica(id: number, oculta: boolean): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Temática inválida." };

  const nombre = await cambiarVisibilidad(id, oculta);
  if (!nombre) return { ok: false, error: "La temática no existe." };

  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: oculta ? "tematica.ocultar" : "tematica.mostrar",
    objetivo: { tipo: "tematica", id },
    detalle: { nombre },
  });
  revalidatePath("/sistema/tematicas");
  return { ok: true };
}

/**
 * Aprueba (se ofrece a todos) o rechaza (se borra del catálogo y se quita de los perfiles de quienes
 * la escribieron; desde el 2026-10-22) una temática pendiente.
 */
export async function revisarTematica(id: number, aprobada: boolean): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Temática inválida." };

  let detalle: Record<string, unknown>;
  if (aprobada) {
    const nombre = await aprobar(id);
    if (!nombre) return { ok: false, error: "La temática no existe." };
    detalle = { nombre };
  } else {
    const rechazo = await rechazar(id);
    if (!rechazo) return { ok: false, error: "La temática no existe o ya estaba aprobada." };
    detalle = { nombre: rechazo.nombre, perfiles: rechazo.perfiles };
  }

  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: aprobada ? "tematica.aprobar" : "tematica.rechazar",
    objetivo: { tipo: "tematica", id },
    detalle,
  });
  revalidatePath("/sistema/tematicas");
  return { ok: true };
}
