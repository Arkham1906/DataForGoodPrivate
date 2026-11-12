// Quién atiende un reporte de aporte (2026-11-12). Desde 3b17c5c (Gerard) lo ve, recibe y resuelve solo el
// supervisor asignado a la campaña. Si la campaña no tiene un supervisor activo (perdió el rol, está
// suspendido o baneado, dio de baja su cuenta, o nunca lo tuvo) y no la supervisa el SuperUsuario, el
// reporte se trata como uno de campaña: es de todos los supervisores (decisión del usuario, 2026-11-12).
// Si la supervisa el SuperUsuario, queda para él (lo ve en /supervisar/reportes y en el aviso del menú).
// Solo fragmentos de SQL: los usan lib/reportes/reportes.ts, lib/moderacion/acciones.ts,
// lib/notificaciones/notificaciones.ts y lib/notificaciones/avisos-a-supervisores.ts.

import { condicionDeRol } from "@/lib/usuarios/tabla-roles";
import { SQL_SANCION_BLOQUEANTE } from "@/lib/sanciones";

/** El supervisor asignado a la campaña `c` (alias) puede atenderla: tiene el rol, cuenta verificada, sin baja ni sanción. */
export function sqlTieneSupervisorActivo(c: string): string {
  return `EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = ${c}.supervisor_id
      AND ${condicionDeRol("u", "'supervisor'")}
      AND u.email_verificado
      AND u.eliminada_en IS NULL AND u.baja_solicitada_en IS NULL
      AND NOT ${SQL_SANCION_BLOQUEANTE}
  )`;
}

/** La campaña `c` no tiene quién atienda sus reportes de aportes: van a todos los supervisores. */
export function sqlSinResponsableDeReportes(c: string): string {
  return `(NOT ${c}.supervisado_por_root AND NOT ${sqlTieneSupervisorActivo(c)})`;
}

/**
 * El reporte `r` (de la campaña `c`) le toca al supervisor del parámetro `param` (p. ej. "$2").
 * Con el parámetro en NULL (SuperUsuario) siempre es true.
 */
export function sqlReporteVisibleParaSupervisor(r: string, c: string, param: string): string {
  return `(${param}::int IS NULL OR ${r}.tipo = 'campana' OR ${c}.supervisor_id = ${param} OR ${sqlSinResponsableDeReportes(c)})`;
}
