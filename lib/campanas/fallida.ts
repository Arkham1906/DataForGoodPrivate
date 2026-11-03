// Campaña fallida (2026-11-01, decisiones del usuario). Una campaña que termina con muy pocos aportes
// aprobados queda "fallida" en vez de "finalizada":
//   - Aplica en cualquier forma de terminar: por su fecha de fin (finalizeExpiredCampaigns), porque la
//     finaliza su creador (PATCH /api/campanas/[id]), la supervisión o el SuperUsuario
//     (lib/supervision/estado-por-supervision.ts) o la baja de la cuenta (lib/usuarios/baja.ts).
//   - Falla con menos del PORCENTAJE_MINIMO de la meta en aprobados (10 de 100 falla; 25 de 100 no).
//     Sin meta (0) nunca falla. El estado se fija al terminar.
//   - No publica datos abiertos ni cuenta en las cifras de la landing (las dos leen solo 'finalizada').
//     Por eso, con aportes, sí se puede eliminar, y en la baja sus aportes no cuentan como "utilizados".
//   - Su creador la puede extender: con una fecha de fin nueva vuelve a activa, como una finalizada.
// Sin imports de servidor: lo usan pantallas cliente.

/** Por debajo de este porcentaje de la meta (en aprobados), la campaña termina fallida. */
export const PORCENTAJE_MINIMO = 25;

/** Estados de una campaña que ya terminó. */
export const ESTADOS_TERMINADOS = ["finalizada", "fallida"] as const;

export function estaTerminada(estado: string | null | undefined): boolean {
  return estado === "finalizada" || estado === "fallida";
}

/** true si, terminando ahora con estos aprobados, la campaña quedaría fallida. */
export function terminariaFallida(aprobados: number, meta: number): boolean {
  return meta > 0 && aprobados * 100 < meta * PORCENTAJE_MINIMO;
}

/**
 * Expresión SQL con el estado al terminar ('fallida' o 'finalizada') de la campaña `alias`
 * (tabla campanas). Cuenta los aportes aceptados directamente, no campana_estadisticas.
 */
export function sqlEstadoAlTerminar(alias = "campanas"): string {
  return `(CASE WHEN ${alias}.goal_contributions > 0
            AND (SELECT COUNT(*) FROM aportes a_t WHERE a_t.campaign_id = ${alias}.id AND a_t.status = 'aceptado') * 100
                < ${alias}.goal_contributions * ${PORCENTAJE_MINIMO}
          THEN 'fallida' ELSE 'finalizada' END)`;
}

/** Texto para el creador cuando su campaña terminó fallida. */
export function explicacionDeFallida(): string {
  return `juntó menos del ${PORCENTAJE_MINIMO}% de su meta en aportes aprobados, así que quedó como fallida y no publica datos abiertos. Puedes extenderla con una nueva fecha de cierre desde Mis campañas.`;
}
