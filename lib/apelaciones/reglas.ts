// Reglas de las apelaciones (2026-11-22, a pedido del usuario). Sin pg: las usan también las pantallas.
// - Se apelan las sanciones de la cuenta (aviso, suspensión, baneo) y los baneos en una campaña.
// - Una sola apelación por decisión, dentro de los DIAS_PARA_APELAR siguientes. Una suspensión, solo mientras sigue
//   activa (2026-11-23, a pedido del usuario); avisos y baneos, dentro del plazo aunque ya no bloqueen nada.
// - Solo la resuelve el SuperUsuario; su respuesta es final. Aceptarla deshace la decisión (lib/apelaciones/apelaciones.ts).

export const DIAS_PARA_APELAR = 30;
export const MOTIVO_MINIMO = 30;
export const MOTIVO_MAXIMO = 2000;
export const RESPUESTA_MINIMA = 20;
export const RESPUESTA_MAXIMA = 2000;

/** Qué se apela: las tres sanciones de la cuenta y el baneo en una campaña. */
export type ClaseDeDecision = "aviso" | "suspension" | "baneo" | "baneo_campana";

export type EstadoDeApelacion = "pendiente" | "aceptada" | "rechazada";

/** Lo apelado, copiado al apelar (columna `decision` de apelaciones). */
export type DecisionApelada = {
  clase: ClaseDeDecision;
  /** Número del aviso (1 a 4). */
  numero?: number;
  /** Días de la suspensión. */
  dias?: number;
  /** El motivo que escribió quien decidió. */
  motivo: string;
  /** ISO. */
  aplicadaEn: string;
  /** "SuperUsuario", "Escala de avisos", el nombre del supervisor o del creador de la campaña. */
  aplicadaPor: string;
  campana?: { id: string; nombre: string };
};

export const NOMBRE_DE_DECISION: Record<ClaseDeDecision, string> = {
  aviso: "Aviso",
  suspension: "Suspensión de la cuenta",
  baneo: "Baneo de la cuenta",
  baneo_campana: "Baneo en una campaña",
};

export const NOMBRE_DE_ESTADO: Record<EstadoDeApelacion, string> = {
  pendiente: "En revisión",
  aceptada: "Aceptada",
  rechazada: "No procede",
};

/** "Aviso 2", "Suspensión de la cuenta (7 días)", "Baneo en «Aves de Tepic»". */
export function tituloDeDecision(d: DecisionApelada): string {
  if (d.clase === "aviso") return d.numero ? `Aviso ${d.numero}` : "Aviso";
  if (d.clase === "suspension") return `${NOMBRE_DE_DECISION.suspension}${d.dias ? ` (${d.dias} ${d.dias === 1 ? "día" : "días"})` : ""}`;
  if (d.clase === "baneo_campana") return d.campana ? `Baneo en «${d.campana.nombre}»` : NOMBRE_DE_DECISION.baneo_campana;
  return NOMBRE_DE_DECISION.baneo;
}

/** Qué pasa si el SuperUsuario acepta la apelación (lo leen la persona y el SuperUsuario). */
export function efectoDeAceptar(clase: ClaseDeDecision): string {
  switch (clase) {
    case "aviso":
      return "El aviso se anula: deja de contar para la escala de avisos. Si ese aviso suspendió o baneó la cuenta, ese bloqueo también se levanta.";
    case "suspension":
      return "La suspensión se anula y la cuenta vuelve a funcionar de inmediato.";
    case "baneo":
      return "El baneo se anula: la cuenta vuelve a funcionar y su correo sale de la lista negra.";
    case "baneo_campana":
      return "Se quita el baneo y la persona puede volver a aportar en esa campaña. Se avisa a quien la organiza.";
  }
}

/** Errores de un texto de apelación o de respuesta; null si está bien. */
export function errorDeTexto(texto: string, minimo: number, maximo: number, que: string): string | null {
  const largo = texto.trim().length;
  if (largo < minimo) return `${que} debe tener al menos ${minimo} caracteres.`;
  if (largo > maximo) return `${que} puede tener hasta ${maximo} caracteres.`;
  return null;
}
