// Tickets de supervisión (2026-11-24, a pedido del usuario; decisiones del usuario en cada punto): las acciones
// importantes de un supervisor no se aplican solas, van como ticket al SuperUsuario, que tiene la decisión final.
//   - Sanciones: suspensión o baneo directos, y un aviso que por la escala suspende o banea (2.º, 3.º y 4.º); también
//     la sanción que se pide al rechazar una campaña (el rechazo sí se aplica al momento). El 1.er aviso, que solo
//     manda un mensaje, sigue directo.
//   - Datos abiertos: publicar o no publicar los de una campaña finalizada.
// Mientras el ticket espera no pasa nada: la persona conserva su acceso, los datos no se publican y los reportes
// ligados quedan "en revisión por el SuperUsuario". El SuperUsuario solo aprueba (se aplica tal cual) o rechaza con
// una respuesta que ve el supervisor. El SuperUsuario, cuando modera él mismo, sigue aplicando todo directo.
// Sin imports de servidor: lo usan las pantallas. La lógica está en lib/tickets/crear.ts y lib/tickets/resolver.ts.

import type { TipoDeSancion } from "@/lib/usuarios/directorio";
import { consecuenciaDelAviso, describirConsecuencia } from "@/lib/usuarios/escala-de-avisos";

export type TipoDeTicket = "sancion" | "datos_abiertos";
export type EstadoDeTicket = "pendiente" | "aprobado" | "rechazado";

/** Lo que guarda un ticket de sanción en `tickets.datos`. */
export type PedidoDeSancion = {
  tipo: TipoDeSancion;
  /** Solo SUSPENSION_TEMPORAL. */
  dias?: number;
  /** El motivo que leerá la persona. */
  detalle: string;
  /** Avisos vigentes de la cuenta cuando se pidió: describen el ticket ya resuelto ("Aviso 2: ..."). */
  avisosAlPedir?: number;
  /** Clave de los reportes que se confirman ("campana-116" o "aporte-55"), si vino de la bandeja de reportes. */
  reportes?: string;
  /** Si se pidió al rechazar una campaña: lo necesario para dejar el reporte resuelto al aprobar. */
  rechazo?: { campanaId: number; lista: string | null; explicacion: string | null; motivo: string };
};

/** Lo que guarda un ticket de datos abiertos en `tickets.datos`. */
export type PedidoDeDatos = { decision: "publicar_datos" | "no_publicar_datos"; motivo: string | null };

/** Largo mínimo de la respuesta al rechazar un ticket: es lo que lee el supervisor. */
export const RESPUESTA_MINIMA_DE_TICKET = 10;
export const RESPUESTA_MAXIMA_DE_TICKET = 1000;

export const NOMBRE_DE_ESTADO_DE_TICKET: Record<EstadoDeTicket, string> = {
  pendiente: "Esperando al SuperUsuario",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

/**
 * ¿Esta sanción, pedida por un supervisor, va como ticket? `avisosPrevios`: avisos vigentes de la cuenta (sin los
 * anulados por apelación), para saber qué haría el siguiente aviso.
 */
export function sancionVaComoTicket(tipo: TipoDeSancion, avisosPrevios: number): boolean {
  if (tipo === "SUSPENSION_TEMPORAL" || tipo === "BANEO_DE_CAMPANA") return true;
  return consecuenciaDelAviso(avisosPrevios + 1).tipo !== "mensaje";
}

/** "Suspensión de 7 días", "Baneo de la cuenta", "Aviso 2 de 4: suspensión de 2 días". */
export function describirSancionPedida(p: { tipo: TipoDeSancion; dias?: number }, avisosPrevios: number): string {
  if (p.tipo === "SUSPENSION_TEMPORAL") return `Suspensión de ${p.dias} días`;
  if (p.tipo === "BANEO_DE_CAMPANA") return "Baneo de la cuenta (y su correo a la lista negra)";
  const numero = avisosPrevios + 1;
  return `Aviso ${numero}: ${describirConsecuencia(consecuenciaDelAviso(numero))}`;
}

export function describirPedidoDeDatos(p: PedidoDeDatos): string {
  return p.decision === "publicar_datos" ? "Publicar sus datos en Datos abiertos" : "No publicar sus datos";
}

export function errorDeRespuestaDeTicket(respuesta: string): string | null {
  const texto = respuesta.trim();
  if (texto.length < RESPUESTA_MINIMA_DE_TICKET) {
    return `Explica al supervisor por qué no se aprueba (al menos ${RESPUESTA_MINIMA_DE_TICKET} caracteres).`;
  }
  if (texto.length > RESPUESTA_MAXIMA_DE_TICKET) return `La respuesta admite hasta ${RESPUESTA_MAXIMA_DE_TICKET} caracteres.`;
  return null;
}
