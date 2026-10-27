// Catálogo de organizaciones del perfil (tabla `organizaciones`, lib/db-schema.ts), 2026-10-26.
// La persona dice en /bienvenida y /cuenta a qué organización pertenece (una, opcional;
// usuarios.organizacion). Al crear la tabla se siembra con las organizaciones que ya usaban las
// campañas (campanas.organizer); después crece con lo que escriben los usuarios y se sugiere a todos.
// El SuperUsuario lo administra en /sistema/organizaciones; renombrar cambia también
// campanas.organizer. Al crear una campaña se propone la del perfil (NuevaCampanaForm).
// Lógica común: lib/catalogos/catalogo-de-perfil.ts.

import { crearCatalogo } from "@/lib/catalogos/catalogo-de-perfil";
import { claveDeCatalogo, validarOrganizacion } from "@/lib/perfil-opciones";

export const organizacionesDelPanel = crearCatalogo({
  tabla: "organizaciones",
  columnaDeUsuarios: "organizacion",
  columnaDeCampanas: "organizer",
  validar: validarOrganizacion,
  clave: claveDeCatalogo,
  articulo: "La organización",
});

export const organizacionesVisibles = organizacionesDelPanel.visibles;
export const resolverOrganizacion = organizacionesDelPanel.resolver;
