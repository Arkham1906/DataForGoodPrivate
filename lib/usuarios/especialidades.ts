// Catálogo de especialidades del perfil (tabla `especialidades`, lib/db-schema.ts), 2026-10-26.
// Empieza con ESPECIALIDADES de lib/perfil-opciones.ts y crece con lo que escriben los usuarios en
// /bienvenida y /cuenta: se sugiere a todos desde que se guarda (decisión del usuario). El
// SuperUsuario lo administra en /sistema/especialidades. La lógica es la de todo catálogo del perfil
// (lib/catalogos/catalogo-de-perfil.ts).
//   - especialidadesVisibles(): la lista que sugieren los formularios (GET /api/especialidades).
//   - resolverEspecialidad(): valida la que manda un perfil y la da de alta si es nueva.
//   - especialidadesDelPanel: listar, crear, renombrar y borrar para /sistema/especialidades.

import { crearCatalogo } from "@/lib/catalogos/catalogo-de-perfil";
import { claveDeCatalogo, validarEspecialidad } from "@/lib/perfil-opciones";

export const especialidadesDelPanel = crearCatalogo({
  tabla: "especialidades",
  columnaDeUsuarios: "specialty",
  validar: validarEspecialidad,
  clave: claveDeCatalogo,
  articulo: "La especialidad",
});

export const especialidadesVisibles = especialidadesDelPanel.visibles;

export type ResultadoDeEspecialidad = { ok: true; especialidad: string | null } | { ok: false; error: string };

/** Ver `resolver` en catalogo-de-perfil.ts. `usuarioId`: quién la escribió. */
export async function resolverEspecialidad(
  entrada: string,
  usuarioId: number | null,
  opciones?: { darDeAlta?: boolean },
): Promise<ResultadoDeEspecialidad> {
  const r = await especialidadesDelPanel.resolver(entrada, usuarioId, opciones);
  return r.ok ? { ok: true, especialidad: r.valor } : r;
}
