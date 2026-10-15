// Motivos que se ofrecen en una lista (también se puede redactar uno): rechazar un aporte y
// "Reportar a supervisión" del revisor. Sin imports de servidor: lo usan las pantallas cliente del creador y del revisor.

export const MOTIVOS_DE_RECHAZO = [
  "Contenido borroso o ilegible",
  "No corresponde a la campaña",
  "Datos incompletos",
  "Contenido duplicado",
];

/** Por qué el revisor reporta un aporte al creador (para que decida si banea a quien lo envió). */
export const MOTIVOS_DE_REPORTE = [
  "Contenido ofensivo o inapropiado",
  "Contenido ilegal o peligroso",
  "Información falsa a propósito",
  "Aportes repetidos o spam",
];

/** Largo máximo del motivo redactado de un reporte. */
export const MAXIMO_MOTIVO_DE_REPORTE = 500;
