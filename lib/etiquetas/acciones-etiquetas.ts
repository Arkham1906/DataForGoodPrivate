"use server";

// Server actions de las etiquetas (subtemáticas, 2026-10-27) en /sistema/tematicas: el SuperUsuario
// las crea dentro de una temática, las edita, las borra (si ninguna campaña las usa), las oculta o
// muestra, y aprueba o rechaza las que propusieron los usuarios (en su campaña o, desde el 2026-10-28,
// en su perfil; se les avisa con una notificación). Lógica en lib/etiquetas/catalogo.ts.
// Todo queda en audit_log.

import { revalidatePath } from "next/cache";

import { registrarAuditoria } from "@/lib/auditoria";
import { hasRootSession } from "@/lib/rootSession";
import {
  aprobarEtiqueta,
  borrarEtiqueta,
  cambiarVisibilidadDeEtiqueta as cambiarVisibilidad,
  crearEtiqueta,
  propuestaDeEtiqueta,
  rechazarEtiqueta,
  renombrarEtiqueta,
} from "@/lib/etiquetas/catalogo";
import { validarNombreDeTematica } from "@/lib/tematicas/catalogo";
import { avisarEtiquetaRevisada } from "@/lib/notificaciones/etiqueta-revisada";

export type ResultadoDeAccion = { ok: true } | { ok: false; error: string };

const idValido = (id: number) => Number.isInteger(id) && id > 0;

function terminar() {
  revalidatePath("/sistema/tematicas");
}

/** Nueva etiqueta del panel en una temática: aprobada y visible desde ya. */
export async function crearEtiquetaDelPanel(tematicaId: number, nombreEscrito: string): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!idValido(tematicaId)) return { ok: false, error: "Temática inválida." };
  const validado = validarNombreDeTematica(nombreEscrito);
  if (!validado.ok) return validado;

  const resultado = await crearEtiqueta(tematicaId, validado.nombre);
  if (!resultado.ok) return resultado;
  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: "etiqueta.crear",
    objetivo: { tipo: "etiqueta", id: resultado.id },
    detalle: { nombre: validado.nombre, tematica: resultado.tematica },
  });
  terminar();
  return { ok: true };
}

/** Cambia el nombre de una etiqueta; campañas y perfiles la tienen por id y ya ven el nuevo. */
export async function editarEtiqueta(id: number, nombreEscrito: string): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!idValido(id)) return { ok: false, error: "Etiqueta inválida." };
  const validado = validarNombreDeTematica(nombreEscrito);
  if (!validado.ok) return validado;

  const resultado = await renombrarEtiqueta(id, validado.nombre);
  if (!resultado.ok) return resultado;
  if (resultado.anterior !== validado.nombre) {
    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: "etiqueta.editar",
      objetivo: { tipo: "etiqueta", id },
      detalle: { antes: resultado.anterior, despues: validado.nombre },
    });
  }
  terminar();
  return { ok: true };
}

/** Borra una etiqueta que ninguna campaña usa; se quita de los perfiles. */
export async function borrarEtiquetaDelPanel(id: number): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!idValido(id)) return { ok: false, error: "Etiqueta inválida." };

  const resultado = await borrarEtiqueta(id);
  if (!resultado.ok) return resultado;
  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: "etiqueta.borrar",
    objetivo: { tipo: "etiqueta", id },
    detalle: { nombre: resultado.nombre, perfiles: resultado.perfiles },
  });
  terminar();
  return { ok: true };
}

/** Oculta (deja de ofrecerse, se queda donde ya está) o vuelve a mostrar una etiqueta. */
export async function cambiarVisibilidadDeEtiqueta(id: number, oculta: boolean): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!idValido(id)) return { ok: false, error: "Etiqueta inválida." };

  const nombre = await cambiarVisibilidad(id, oculta);
  if (!nombre) return { ok: false, error: "La etiqueta no existe." };
  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: oculta ? "etiqueta.ocultar" : "etiqueta.mostrar",
    objetivo: { tipo: "etiqueta", id },
    detalle: { nombre },
  });
  terminar();
  return { ok: true };
}

/** Aprueba (se ofrece a todos y se ve en su campaña) o rechaza (se borra y sale de su campaña) una propuesta. */
export async function revisarEtiqueta(id: number, aprobada: boolean): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
  if (!idValido(id)) return { ok: false, error: "Etiqueta inválida." };

  // Antes de decidir: rechazar la borra, y después ya no se sabe quién la propuso (2026-10-28).
  const propuesta = await propuestaDeEtiqueta(id);
  let detalle: Record<string, unknown>;
  if (aprobada) {
    const nombre = await aprobarEtiqueta(id);
    if (!nombre) return { ok: false, error: "La etiqueta no existe." };
    detalle = { nombre };
  } else {
    const rechazo = await rechazarEtiqueta(id);
    if (!rechazo) return { ok: false, error: "La etiqueta no existe o ya estaba aprobada." };
    detalle = { nombre: rechazo.nombre, campanas: rechazo.campanas };
  }
  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: aprobada ? "etiqueta.aprobar" : "etiqueta.rechazar",
    objetivo: { tipo: "etiqueta", id },
    detalle,
  });
  // Se avisa a quien la propuso (no a quien la tenía sin proponerla).
  if (propuesta) await avisarEtiquetaRevisada(propuesta, aprobada);
  terminar();
  return { ok: true };
}
