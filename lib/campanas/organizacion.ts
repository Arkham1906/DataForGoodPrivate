// Organización de una campaña (campanas.organizer): texto libre y opcional que escribe el creador
// (2026-10-15, a pedido del usuario; antes el formulario mandaba siempre "Ayuntamiento de Tepic").
// Sin imports de servidor: lo usan NuevaCampanaForm y POST/PUT/PATCH de /api/campanas.

/** Largo máximo (la columna es VARCHAR(160)). */
export const LARGO_MAXIMO_ORGANIZACION = 160;

/** Mensaje de error si la organización es demasiado larga, o null si vale (vacía también vale). */
export function errorDeOrganizacion(organizacion: string | null): string | null {
  if (organizacion && organizacion.length > LARGO_MAXIMO_ORGANIZACION) {
    return `La organización no puede pasar de ${LARGO_MAXIMO_ORGANIZACION} caracteres`;
  }
  return null;
}

/**
 * Quién organiza la campaña, como se muestra (2026-10-22, a pedido del usuario): la organización
 * que puso el creador o, si no puso ninguna, su nombre (campanas.creator_name, que se mantiene al
 * día al cambiar el nombre en /cuenta y queda genérico si la cuenta se da de baja).
 */
export function quienOrganiza(campana: { organizer?: string | null; creatorName?: string | null }): string {
  return campana.organizer?.trim() || campana.creatorName?.trim() || "Sin especificar";
}
