"use server";

// Server actions de /sistema/especialidades (2026-10-26): el SuperUsuario crea especialidades y
// edita o borra las que no son base. Renombrar cambia el nombre también en los perfiles; borrar la
// quita de ellos. Queda en audit_log. Pasos comunes en lib/catalogos/acciones-de-catalogo.ts.

import { accionesDeCatalogo, type ResultadoDeAccion } from "@/lib/catalogos/acciones-de-catalogo";
import { validarEspecialidad } from "@/lib/perfil-opciones";
import { especialidadesDelPanel } from "@/lib/usuarios/especialidades";

const acciones = accionesDeCatalogo({
  catalogo: especialidadesDelPanel,
  validar: validarEspecialidad,
  tipo: "especialidad",
  ruta: "/sistema/especialidades",
  invalido: "Especialidad inválida.",
});

/** Crea una especialidad: se sugiere a todos desde ya en /bienvenida y /cuenta. */
export async function crearEspecialidadDelPanel(nombre: string): Promise<ResultadoDeAccion> {
  return acciones.crear(nombre);
}

/** Cambia el nombre de una especialidad que no es base; también en los perfiles que la tienen. */
export async function editarEspecialidad(id: number, nombre: string): Promise<ResultadoDeAccion> {
  return acciones.editar(id, nombre);
}

/** Borra una especialidad que no es base; los perfiles que la tenían quedan sin especialidad. */
export async function borrarEspecialidadDelPanel(id: number): Promise<ResultadoDeAccion> {
  return acciones.borrar(id);
}
