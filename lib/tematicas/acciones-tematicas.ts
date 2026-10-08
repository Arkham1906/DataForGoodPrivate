"use server";

// Server action de /sistema/tematicas: el SuperUsuario oculta o vuelve a mostrar una temática del
// catálogo. Oculta deja de ofrecerse en /bienvenida, /cuenta y el formulario de campaña, pero no se
// quita de los perfiles ni de las campañas que ya la tienen. Queda en audit_log.

import { revalidatePath } from "next/cache";

import { hasRootSession } from "@/lib/rootSession";
import { registrarAuditoria } from "@/lib/auditoria";
import { cambiarVisibilidad } from "@/lib/tematicas/catalogo";

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
