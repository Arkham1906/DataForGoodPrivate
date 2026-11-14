// Gamificación en la baja definitiva de una cuenta (2026-11-13, A2 de la auditoría; SRS v1.3 RF-GAM-60). La llama
// ejecutarBajasVencidas() (lib/usuarios/baja.ts) dentro de su transacción, con la fila del usuario bloqueada.
//
// RF-GAM-60: en la baja definitiva se elimina el perfil de gamificación y se anonimiza el registro de EXP; la baja no
// revierte EXP. Decisión del responsable (2026-11-13): el registro anonimizado SE CONSERVA, sin dueño, para las
// estadísticas del sistema.
// - exp_movimientos: inalterable (un trigger impide borrar y editar lo calculado), pero permite quitar las llaves:
//   usuario_id y aporte_id pasan a NULL (los aportes conservan su user_id hacia la fila vacía, así que el aporte_id
//   volvería a unir los movimientos con la persona) y se marca anonimizado_en. Quedan cantidad, tipo, campaña, fecha
//   y el cálculo. El motivo no se puede cambiar; nombra la campaña, no a la persona.
// - Todo lo demás del perfil se borra: progreso y contadores, rango (ascensos), medallas, inventario y avatar, racha,
//   misiones, potenciadores, bonos de cuota, subtemáticas de interés, posiciones semanales en la tabla de líderes y
//   preferencias. Las llaves de exp_movimientos hacia misiones y potenciadores se ponen en NULL solas (ON DELETE SET
//   NULL, que el trigger permite).
// La fila de usuarios no se borra (ver baja.ts): sin estas filas, la cuenta vacía ya no tiene progreso que mostrar.

import type { PoolClient } from "pg";

type Consultor = Pick<PoolClient, "query">;

/** Tablas del perfil de gamificación, por usuario_id. mision_instancias se lleva mision_instancia_aportes en cascada. */
const TABLAS_DEL_PERFIL = [
  "mision_instancias",
  "potenciadores",
  "racha_eventos",
  "racha_dias",
  "medalla_ascensos",
  "medallas_usuario",
  "rango_ascensos",
  "usuario_objetos",
  "usuario_contadores",
  "campana_cuota_bonos",
  "usuario_etiquetas",
  "lideres_posiciones_semanales",
  "usuario_preferencias",
  "usuario_progreso",
] as const;

export async function borrarPerfilDeGamificacion(client: Consultor, usuarioId: number): Promise<{ movimientosAnonimizados: number }> {
  const anonimizados = await client.query(
    `UPDATE exp_movimientos SET usuario_id = NULL, aporte_id = NULL, anonimizado_en = NOW() WHERE usuario_id = $1`,
    [usuarioId],
  );
  // Nombres de tabla fijos (la constante de arriba), nunca del usuario.
  for (const tabla of TABLAS_DEL_PERFIL) {
    await client.query(`DELETE FROM ${tabla} WHERE usuario_id = $1`, [usuarioId]);
  }
  return { movimientosAnonimizados: anonimizados.rowCount ?? 0 };
}
