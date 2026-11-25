// Qué muestra cada pestaña de la lista de campañas de supervisión (2026-11-25, a pedido del usuario: todo título
// lleva debajo qué se está viendo). Lo usan /supervision/campanas (ListaDeSupervision) y /supervisar (pestanas.tsx),
// que tienen las mismas cuatro pestañas. Sin imports de servidor: lo leen componentes cliente.

export type PestanaDeSupervision = "pending" | "supervised" | "flagged" | "finished";

export const DESCRIPCION_DE_PESTANA: Record<PestanaDeSupervision, string> = {
  pending: "Campañas que sus creadores enviaron a revisión. Abre una para aceptarla o rechazarla antes de que se publique.",
  supervised: "Campañas aceptadas que siguen en curso: activas, programadas o pausadas. Puedes pausarlas, reanudarlas o finalizarlas.",
  flagged: "Campañas que se rechazaron en la revisión o que recibieron reportes.",
  finished: "Campañas que ya terminaron. En las que quedan por decidir, elige si sus datos se publican como datos abiertos.",
};
