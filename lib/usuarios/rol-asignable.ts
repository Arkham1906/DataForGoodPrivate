/**
 * Sin dependencias de servidor (nada de `pool`/`pg`): este módulo lo importan
 * tanto Server Components como Client Components (p. ej. botones-de-rol.tsx),
 * y un import de `pg` en un componente cliente rompe el build.
 */

/**
 * Permisos del usuario común (2026-11-22, a pedido del usuario): crear campañas y aportar ya son roles.
 * Toda cuenta los tiene desde que se crea (trigger de usuario_roles, lib/db-schema.ts); el SuperUsuario los
 * quita o los devuelve en /usuarios/[id]/roles. Sin "Creador de campaña" no crea campañas ni envía a
 * revisión un borrador o una rechazada, pero sigue administrando las que ya tiene; sin "Aportador" no
 * aporta ni se inscribe a campañas. Lo exige el servidor con puedeCrearCampanas/puedeAportar:
 * errorDeRolDeCreador (lib/campanas/estado-del-creador.ts) en POST /api/campanas y en PATCH/PUT de
 * /api/campanas/[id], y POST /api/aportes y /api/campanas/[id]/inscripcion.
 */
export type PermisoDeUsuario = "CREADOR_DE_CAMPANAS" | "APORTADOR";

/** Roles que se dan o se quitan desde el panel: los delegados y los permisos del usuario común. */
export type RolAsignable = "SUPERVISOR" | "REVISOR_DE_APORTES" | PermisoDeUsuario;

export const PERMISOS_DE_USUARIO: PermisoDeUsuario[] = ["CREADOR_DE_CAMPANAS", "APORTADOR"];

export const NOMBRE_DE_ROL: Record<RolAsignable, string> = {
  SUPERVISOR: "Supervisor",
  REVISOR_DE_APORTES: "Revisor de aportes",
  CREADOR_DE_CAMPANAS: "Creador de campaña",
  APORTADOR: "Aportador",
};

export const QUIEN_ASIGNA: Record<RolAsignable, string> = {
  SUPERVISOR: "Solo lo asigna el SuperUsuario",
  REVISOR_DE_APORTES:
    "Lo asigna el creador de una campaña al invitar; el SuperUsuario solo puede revocarlo",
  CREADOR_DE_CAMPANAS:
    "Toda cuenta lo tiene: crea campañas y las envía a revisión. Solo el SuperUsuario lo quita o lo devuelve",
  APORTADOR:
    "Toda cuenta lo tiene: se inscribe a campañas y envía aportes. Solo el SuperUsuario lo quita o lo devuelve",
};

/** Qué pasa al quitarlo, para el aviso antes de confirmar. */
export const AL_QUITAR: Record<PermisoDeUsuario, string> = {
  CREADOR_DE_CAMPANAS:
    "No podrá crear campañas ni enviar a revisión un borrador o una rechazada. Sus campañas siguen y las sigue administrando (aportes, revisores, pausar, editar).",
  APORTADOR:
    "No podrá inscribirse a campañas ni enviar aportes. Los que ya envió se conservan y se revisan como siempre.",
};

/** Etiqueta del directorio y de la ficha cuando le quitaron el permiso. */
export const ETIQUETA_SIN_PERMISO: Record<PermisoDeUsuario, string> = {
  CREADOR_DE_CAMPANAS: "Sin rol de creador",
  APORTADOR: "Sin rol de aportador",
};

/** El código que se guarda en `usuario_roles.rol` (lib/roles.ts). */
export const CODIGO_DE_ROL: Record<RolAsignable, string> = {
  SUPERVISOR: "supervisor",
  REVISOR_DE_APORTES: "revisor",
  CREADOR_DE_CAMPANAS: "creador",
  APORTADOR: "aportador",
};

/** Los mensajes que da el servidor (403) y que repite la interfaz antes de intentarlo. */
export const SIN_ROL_DE_CREADOR =
  "La administración te retiró el rol de creador de campaña: no puedes crear campañas ni enviarlas a revisión. Tus campañas siguen y las puedes administrar desde Mis campañas.";
export const SIN_ROL_DE_APORTADOR =
  "La administración te retiró el rol de aportador: no puedes inscribirte a campañas ni enviar aportes. Los aportes que ya enviaste se conservan.";

export function puedeCrearCampanas(roles: readonly string[]): boolean {
  return roles.includes(CODIGO_DE_ROL.CREADOR_DE_CAMPANAS);
}

export function puedeAportar(roles: readonly string[]): boolean {
  return roles.includes(CODIGO_DE_ROL.APORTADOR);
}

/**
 * Un nombre por rol delegado, para mostrarlos como etiquetas separadas. Ya no son
 * mutuamente excluyentes: alguien puede ser Supervisor y Revisor de aportes a la vez.
 * Creador de campaña y Aportador no salen aquí: los tiene toda cuenta, y lo que se marca es
 * que se los hayan quitado (permisosRetiradosDesde).
 */
export function nombresDeRoles(roles: string[]): string[] {
  if (roles.includes("admin")) return ["SuperUsuario"];

  const nombres = [
    roles.includes("supervisor") && "Supervisor",
    roles.includes("revisor") && "Revisor de aportes",
  ].filter((n): n is string => Boolean(n));

  return nombres.length > 0 ? nombres : ["Usuario común"];
}

export function nombreDeRolPrincipal(roles: string[]): string {
  return nombresDeRoles(roles).join(" y ");
}

/** Los roles delegados vigentes (puede haber cero, uno o los dos). */
export function rolesVigentesDesde(roles: string[]): RolAsignable[] {
  const vigentes: RolAsignable[] = [];
  if (roles.includes("supervisor")) vigentes.push("SUPERVISOR");
  if (roles.includes("revisor")) vigentes.push("REVISOR_DE_APORTES");
  return vigentes;
}

/** Los permisos del usuario común que tiene. */
export function permisosDesde(roles: string[]): PermisoDeUsuario[] {
  return PERMISOS_DE_USUARIO.filter((p) => roles.includes(CODIGO_DE_ROL[p]));
}

/** Los permisos del usuario común que le quitaron. */
export function permisosRetiradosDesde(roles: string[]): PermisoDeUsuario[] {
  return PERMISOS_DE_USUARIO.filter((p) => !roles.includes(CODIGO_DE_ROL[p]));
}
