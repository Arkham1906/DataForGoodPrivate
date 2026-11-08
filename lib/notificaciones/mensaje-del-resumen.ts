// Texto de la notificación mensual "Newsletter" (resumen_mensual; 2026-11-03, a pedido del usuario: que se
// entienda mejor). Desde el 2026-11-07 (a pedido del usuario) solo habla de la persona: sus aportes
// aceptados en el mes; ya no cuenta campañas nuevas de sus temáticas ni datos abiertos de la plataforma.
// Sin imports: se puede probar suelto. Debe caber en el aviso al teléfono (180 caracteres,
// lib/notificaciones/push.ts).

export function mensajeDelResumen(mes: string, aceptados: number): string {
  return aceptados === 1
    ? `Esto pasó en ${mes}: se aceptó 1 de tus aportes.`
    : `Esto pasó en ${mes}: se aceptaron ${aceptados} de tus aportes.`;
}
