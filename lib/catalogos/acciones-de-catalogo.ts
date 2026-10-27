// Pasos comunes de las server actions de un catálogo del perfil en el panel (2026-10-26):
// sesión raíz → validación → lógica (catalogo-de-perfil.ts) → bitácora → revalidar la pantalla.
// Las llaman lib/usuarios/acciones-especialidades.ts y lib/usuarios/acciones-organizaciones.ts
// (que son los archivos "use server"); este no lo es, porque exporta una función que no es acción.

import { revalidatePath } from "next/cache";

import { hasRootSession } from "@/lib/rootSession";
import { registrarAuditoria, type AccionAuditada } from "@/lib/auditoria";
import type { crearCatalogo } from "./catalogo-de-perfil";

export type ResultadoDeAccion = { ok: true } | { ok: false; error: string };

type Validacion = { ok: true; nombre: string } | { ok: false; error: string };

export function accionesDeCatalogo(opciones: {
  catalogo: ReturnType<typeof crearCatalogo>;
  validar: (entrada: string) => Validacion;
  /** "especialidad", "organizacion": objetivo y prefijo de la bitácora. */
  tipo: "especialidad" | "organizacion";
  ruta: string;
  invalido: string;
}) {
  const { catalogo, validar, tipo, ruta, invalido } = opciones;
  const accion = (verbo: "crear" | "editar" | "borrar") => `${tipo}.${verbo}` as AccionAuditada;

  async function crear(nombreEscrito: string): Promise<ResultadoDeAccion> {
    if (!(await hasRootSession())) throw new Error("No autorizado");
    const validada = validar(String(nombreEscrito ?? ""));
    if (!validada.ok) return validada;
    const resultado = await catalogo.crear(validada.nombre);
    if (!resultado.ok) return resultado;
    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: accion("crear"),
      objetivo: { tipo, id: resultado.id },
      detalle: { nombre: validada.nombre },
    });
    revalidatePath(ruta);
    return { ok: true };
  }

  async function editar(id: number, nombreEscrito: string): Promise<ResultadoDeAccion> {
    if (!(await hasRootSession())) throw new Error("No autorizado");
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: invalido };
    const validada = validar(String(nombreEscrito ?? ""));
    if (!validada.ok) return validada;
    const resultado = await catalogo.renombrar(id, validada.nombre);
    if (!resultado.ok) return resultado;
    if (resultado.anterior !== validada.nombre) {
      await registrarAuditoria({
        actor: { tipo: "superusuario" },
        accion: accion("editar"),
        objetivo: { tipo, id },
        detalle: { antes: resultado.anterior, despues: validada.nombre, perfiles: resultado.perfiles, campanas: resultado.campanas },
      });
    }
    revalidatePath(ruta);
    return { ok: true };
  }

  async function borrar(id: number): Promise<ResultadoDeAccion> {
    if (!(await hasRootSession())) throw new Error("No autorizado");
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: invalido };
    const resultado = await catalogo.borrar(id);
    if (!resultado.ok) return resultado;
    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: accion("borrar"),
      objetivo: { tipo, id },
      detalle: { nombre: resultado.nombre, perfiles: resultado.perfiles },
    });
    revalidatePath(ruta);
    return { ok: true };
  }

  return { crear, editar, borrar };
}
