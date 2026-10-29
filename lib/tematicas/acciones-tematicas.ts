"use server";

// Server actions de /sistema/tematicas: el SuperUsuario crea, edita y borra las que no son base
// (2026-10-26), oculta o vuelve a mostrar una temática del
// catálogo, y aprueba o rechaza las nuevas que escriben los usuarios (2026-10-19). Oculta deja de ofrecerse en /bienvenida, /cuenta y el formulario de campaña, pero no se
// quita de los perfiles ni de las campañas que ya la tienen. Queda en audit_log.

import { revalidatePath } from "next/cache";

import { hasRootSession } from "@/lib/rootSession";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisarTematicaNueva } from "@/lib/notificaciones/tematica-nueva";
import { avisarTematicaRevisada } from "@/lib/notificaciones/tematica-revisada";
import {
  aprobar,
  borrarTematica,
  cambiarVisibilidad,
  crearTematica,
  propuestaDeTematica,
  rechazar,
  renombrarTematica,
  validarNombreDeTematica,
} from "@/lib/tematicas/catalogo";

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
 * la escribieron; desde el 2026-10-22) una temática pendiente. Desde el 2026-10-29 una campaña
 * también puede usar una propuesta: al rechazarla, `reemplazo` es la temática aprobada a la que pasan
 * esas campañas (obligatorio si alguna la usa). Se avisa a quien la propuso y a esos creadores.
 */
export async function revisarTematica(id: number, aprobada: boolean, reemplazo?: string): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Temática inválida." };

  // Antes de decidir: rechazar la borra, y después ya no se sabe quién la propuso.
  const propuesta = await propuestaDeTematica(id);
  let detalle: Record<string, unknown>;
  let rechazo: Awaited<ReturnType<typeof rechazar>> | null = null;
  if (aprobada) {
    const nombre = await aprobar(id);
    if (!nombre) return { ok: false, error: "La temática no existe." };
    detalle = { nombre };
  } else {
    rechazo = await rechazar(id, typeof reemplazo === "string" ? reemplazo : undefined);
    if (!rechazo.ok) return rechazo;
    detalle = {
      nombre: rechazo.nombre,
      perfiles: rechazo.perfiles,
      ...(rechazo.reemplazo ? { reemplazo: rechazo.reemplazo, campanas: rechazo.campanas.map((c) => c.id) } : {}),
    };
  }

  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: aprobada ? "tematica.aprobar" : "tematica.rechazar",
    objetivo: { tipo: "tematica", id },
    detalle,
  });
  revalidatePath("/sistema/tematicas");
  await avisarTematicaRevisada(propuesta, aprobada, rechazo?.ok ? rechazo : undefined);
  // Aprobada, ya se ofrece a todos: se agrega y se avisa a quien la mencionó en sus gustos.
  if (aprobada) avisarTematicaNueva(String(detalle.nombre));
  return { ok: true };
}

/** Crea una temática desde el panel (2026-10-26): aprobada y visible para todos desde ya. */
export async function crearTematicaDelPanel(nombreEscrito: string): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  const validado = validarNombreDeTematica(nombreEscrito);
  if (!validado.ok) return validado;

  const resultado = await crearTematica(validado.nombre);
  if (!resultado.ok) return resultado;

  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: "tematica.crear",
    objetivo: { tipo: "tematica", id: resultado.id },
    detalle: { nombre: validado.nombre },
  });
  revalidatePath("/sistema/tematicas");
  // Se agrega y se avisa a quien la mencionó en sus gustos (en segundo plano).
  avisarTematicaNueva(validado.nombre);
  return { ok: true };
}

/** Cambia el nombre de una temática que no es base; también en perfiles y campañas que la tienen. */
export async function editarTematica(id: number, nombreEscrito: string): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Temática inválida." };
  const validado = validarNombreDeTematica(nombreEscrito);
  if (!validado.ok) return validado;

  const resultado = await renombrarTematica(id, validado.nombre);
  if (!resultado.ok) return resultado;

  if (resultado.anterior !== validado.nombre) {
    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: "tematica.editar",
      objetivo: { tipo: "tematica", id },
      detalle: { antes: resultado.anterior, despues: validado.nombre, perfiles: resultado.perfiles, campanas: resultado.campanas },
    });
  }
  revalidatePath("/sistema/tematicas");
  return { ok: true };
}

/** Borra una temática que no es base y que ninguna campaña usa; se quita de los perfiles. */
export async function borrarTematicaDelPanel(id: number): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Temática inválida." };

  const resultado = await borrarTematica(id);
  if (!resultado.ok) return resultado;

  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: "tematica.borrar",
    objetivo: { tipo: "tematica", id },
    detalle: { nombre: resultado.nombre, perfiles: resultado.perfiles },
  });
  revalidatePath("/sistema/tematicas");
  return { ok: true };
}
