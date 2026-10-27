"use server";

// Server actions de /sistema/organizaciones (2026-10-26): el SuperUsuario crea organizaciones y
// edita o borra las demás (no hay base). Renombrar cambia el nombre también en los perfiles y en las
// campañas (campanas.organizer); borrar la quita de los perfiles, las campañas conservan su texto.
// Queda en audit_log. Pasos comunes en lib/catalogos/acciones-de-catalogo.ts.

import { accionesDeCatalogo, type ResultadoDeAccion } from "@/lib/catalogos/acciones-de-catalogo";
import { validarOrganizacion } from "@/lib/perfil-opciones";
import { organizacionesDelPanel } from "@/lib/usuarios/organizaciones";

const acciones = accionesDeCatalogo({
  catalogo: organizacionesDelPanel,
  validar: validarOrganizacion,
  tipo: "organizacion",
  ruta: "/sistema/organizaciones",
  invalido: "Organización inválida.",
});

/** Crea una organización: se sugiere a todos desde ya. */
export async function crearOrganizacionDelPanel(nombre: string): Promise<ResultadoDeAccion> {
  return acciones.crear(nombre);
}

/** Cambia el nombre de una organización; también en los perfiles y las campañas que la tienen. */
export async function editarOrganizacion(id: number, nombre: string): Promise<ResultadoDeAccion> {
  return acciones.editar(id, nombre);
}

/** Borra una organización; los perfiles que la tenían quedan sin organización. */
export async function borrarOrganizacionDelPanel(id: number): Promise<ResultadoDeAccion> {
  return acciones.borrar(id);
}
