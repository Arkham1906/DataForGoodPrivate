// Motivos de los reportes (2026-10-12), estados y la "clave" que identifica qué se reportó. Sin imports
// de servidor: lo usan /campanas/[id], el detalle de un aporte (creador y revisor) y la bandeja /reportes.

/** Por qué se reporta una campaña. Se elige uno y/o se describe con palabras propias. */
export const MOTIVOS_DE_REPORTE_DE_CAMPANA = [
  "Contenido ofensivo o inapropiado",
  "Engaño o fraude: pide datos para otro fin",
  "Pide datos personales o sensibles",
  "Información falsa o engañosa",
  "Spam o publicidad",
  "Pone en riesgo a quien participa",
];

/** "Otro" de la lista de motivos de rechazo: obliga a escribir la explicación. */
export const OTRO_MOTIVO = "Otro";

/**
 * Por qué la supervisión rechaza una campaña (2026-10-16): los de reportar una campaña y "Otro".
 * Se elige uno y/o se explica con palabras propias; con "Otro", la explicación es obligatoria.
 */
export const MOTIVOS_DE_RECHAZO_DE_CAMPANA = [...MOTIVOS_DE_REPORTE_DE_CAMPANA, OTRO_MOTIVO];

/** Largo máximo de la explicación del rechazo. */
export const MAXIMO_EXPLICACION_DE_RECHAZO = 500;

/** El motivo del rechazo como lo lee el creador: "Motivo de la lista. Explicación", o solo uno de los dos. */
export function textoDelMotivoDeRechazo(motivoDeLista: string | null, explicacion: string | null): string {
  const lista = motivoDeLista && motivoDeLista !== OTRO_MOTIVO ? motivoDeLista : null;
  if (lista && explicacion) return `${lista}. ${explicacion}`;
  return lista ?? explicacion ?? "";
}

/** Por qué el creador o un revisor reporta a quien envió un aporte. */
export const MOTIVOS_DE_REPORTE_DE_APORTE = [
  "Contenido ofensivo o inapropiado",
  "Contenido ilegal o peligroso",
  "Información falsa a propósito",
  "Aportes repetidos o spam",
  "Acoso o amenazas",
];

/** Largo máximo de la descripción de un reporte. */
export const MAXIMO_DESCRIPCION_DE_REPORTE = 500;

export type TipoDeReporte = "campana" | "aporte";
export type EstadoDeReporte = "pendiente" | "descartado" | "sancionado";

export const ETIQUETA_DE_ESTADO_DE_REPORTE: Record<EstadoDeReporte, string> = {
  pendiente: "Pendiente",
  descartado: "Descartado",
  sancionado: "Sancionado",
};

/**
 * Qué se reportó: "campana-116" (la campaña 116, contra su creador) o "aporte-55" (el aporte 55, contra
 * quien lo envió). Se resuelven juntos todos los reportes pendientes de esa clave. Va en la URL de
 * .../sanciones/[usuarioId]?reportes=<clave> y en descartarReportes.
 */
export type ClaveDeReportes = { tipo: TipoDeReporte; id: number };

export function leerClaveDeReportes(valor: unknown): ClaveDeReportes | null {
  const m = typeof valor === "string" ? /^(campana|aporte)-(\d{1,9})$/.exec(valor) : null;
  return m ? { tipo: m[1] as TipoDeReporte, id: Number(m[2]) } : null;
}

export const escribirClaveDeReportes = (c: ClaveDeReportes) => `${c.tipo}-${c.id}`;
