// Por qué la supervisión rechazó una campaña, para que su creador lo vea en /mis-campanas y al
// corregirla en el formulario (2026-10-22, a pedido del usuario; antes solo llegaba en la
// notificación). Sale del último 'rechazada' de campana_supervisores (lib/supervision/decision.ts)
// y, si hubo sanción, de su reporte con origen 'rechazo' y la fila de sanciones. Solo lo trae
// GET /api/campanas?mine=true, y solo mientras la campaña sigue rechazada.
// Sin imports de servidor: lo usan la API y los componentes cliente.

export type RechazoDeCampana = {
  motivo: string;
  /** Cuándo se rechazó (ISO). */
  fecha: string;
  /** La rechazó el SuperUsuario en modo supervisor (si no, un supervisor). */
  porSuperUsuario: boolean;
  /** "un aviso", "una suspensión de 7 días"...; null si no hubo sanción. */
  sancion: string | null;
};

function describirSancion(tipo: unknown, dias: unknown): string | null {
  switch (tipo) {
    case "STRIKE":
      return "un aviso";
    case "SUSPENSION_TEMPORAL":
      return Number(dias) > 0 ? `una suspensión de ${Number(dias)} días` : "una suspensión";
    case "BANEO_DE_CAMPANA":
      return "el baneo de la cuenta";
    default:
      return tipo ? "una sanción" : null;
  }
}

/** Lee las columnas rechazo_* que agrega la consulta de ?mine=true; null si no viene. */
export function rechazoDesdeFila(row: Record<string, unknown>): RechazoDeCampana | null {
  if (row.status !== "rechazada" || !row.rechazo_en) return null;
  return {
    motivo: String(row.rechazo_motivo ?? "").trim() || "Sin motivo registrado",
    fecha: new Date(row.rechazo_en as string).toISOString(),
    porSuperUsuario: row.rechazo_por_root === true,
    sancion: describirSancion(row.rechazo_sancion_tipo, row.rechazo_sancion_dias),
  };
}
