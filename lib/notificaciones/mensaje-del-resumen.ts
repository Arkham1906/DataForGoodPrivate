// Texto de la notificación mensual "Newsletter" (resumen_mensual; 2026-11-03, a pedido del usuario: que se
// entienda mejor). Solo lista lo que sí pasó: un número en 0 no se menciona. Sin imports: se puede probar
// suelto. Debe caber en el aviso al teléfono (180 caracteres, lib/notificaciones/push.ts).

export function mensajeDelResumen(mes: string, aceptados: number, campanas: number, conjuntos: number): string {
  const partes: string[] = [];
  if (aceptados > 0) {
    partes.push(aceptados === 1 ? "se aceptó 1 de tus aportes" : `se aceptaron ${aceptados} de tus aportes`);
  }
  if (campanas > 0) {
    partes.push(
      campanas === 1
        ? "se abrió 1 campaña de tus temáticas en tu zona"
        : `se abrieron ${campanas} campañas de tus temáticas en tu zona`,
    );
  }
  if (conjuntos > 0) {
    partes.push(
      conjuntos === 1
        ? "se publicó 1 conjunto de datos abiertos que ya puedes consultar"
        : `se publicaron ${conjuntos} conjuntos de datos abiertos que ya puedes consultar`,
    );
  }
  return `Esto pasó en ${mes}: ${new Intl.ListFormat("es", { type: "conjunction" }).format(partes)}.`;
}
