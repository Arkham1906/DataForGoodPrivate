// Campaña terminada. Desde el 2026-11-04 (a pedido del usuario) no hay estado "incompleta": toda campaña
// termina como "finalizada", junte los aportes que junte; su supervisión decide si publica sus datos
// abiertos (lib/supervision/datos-abiertos.ts). Sin imports de servidor: lo usan pantallas cliente.

/** Estados de una campaña que ya terminó. */
export const ESTADOS_TERMINADOS = ["finalizada"] as const;

export function estaTerminada(estado: string | null | undefined): boolean {
  return estado === "finalizada";
}
