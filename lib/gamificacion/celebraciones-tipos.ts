// Tipos de las celebraciones (2026-11-16; lienzo aprobado el mismo día; RF-GAM-84). Documento:
// claude/pantallas-v12/celebracion-propuesta.md. Sin imports de servidor: los usan el servidor (celebraciones.ts,
// racha.ts) y los componentes cliente (components/gamificacion/celebraciones/).
//
// Hay tres celebraciones: ascenso de rango, nivel de medalla y racha. Las dos primeras salen de rango_ascensos y
// medalla_ascensos con celebracion_vista_en sin fecha (pendientes) y se marcan vistas al cerrarlas: se ven una vez.
// La de racha no se guarda: la devuelve POST /api/aportes cuando el envío alarga, empieza o reaviva la racha.
//
// Ventana «ya tienes el máximo» (2026-11-19; lienzo de misiones aprobado el mismo día): el objeto de una misión difícil
// que no cabe en el inventario entra en la misma cola, después de racha, rango y medallas. No se marca vista: se quita
// al decidir (POST con `objeto`); cerrarla la deja para la siguiente visita (lib/gamificacion/inventario.ts).

import type { ObjetoDeMision } from "./misiones-reglas";

/** Lo que trae un ascenso (rango_ascensos.recompensas, que escribe evaluacion.ts). */
export type RecompensaDeRango =
  | { tipo: "etapa_avatar"; etapa: number }
  | { tipo: "insignia"; rango: number }
  | { tipo: "coleccionable"; nombre: string };

export type CelebracionDeRango = {
  /** Filas de rango_ascensos que esta celebración marca vistas. */
  ids: number[];
  /** Rango que tenía antes del primer ascenso pendiente. */
  anterior: number;
  numero: number;
  nombre: string;
  /** Rangos del catálogo, para «10 de 20». */
  total: number;
  /** Rangos pendientes de celebrar antes del último: se nombran, no se celebran aparte. */
  intermedios: { numero: number; nombre: string }[];
  recompensas: RecompensaDeRango[];
  /** El rango que se revela al subir (RF-GAM-78): el siguiente, con su nombre. */
  siguiente: { numero: number; nombre: string } | null;
  /** El que se avista: solo su número. */
  avistado: number | null;
};

export type CelebracionDeMedalla = {
  /** Filas de medalla_ascensos que esta celebración marca vistas (una por nivel, también los intermedios). */
  ids: number[];
  clave: string;
  nombre: string;
  mide: string | null;
  /** Medallas que miden la racha (Llama Constante): su celebración lleva fuego. */
  conFuego: boolean;
  /** Nivel antes de los pendientes; 0 si es su primer nivel. */
  nivelAntes: number;
  nivel: number;
  totalNiveles: number;
  nombreDelNivel: string;
  /** Niveles que también se alcanzaron en el salto, sin el último. */
  intermedios: string[];
  /** Ilustración de antes (sin nivel: la del nivel 1, que se dibuja en gris) y la nueva. */
  imagenAntes: string;
  imagen: string;
  valor: number;
  siguiente: { nombre: string; umbral: number } | null;
};

/** Objeto de una misión que no cabe en el inventario. */
export type ObjetoPorDecidir = {
  /** mision_instancias.id. */
  instanciaId: string;
  /** Nombre de la misión que lo dio. */
  mision: string;
  objeto: ObjetoDeMision;
  /** El otro objeto, si cabe; null si también está al máximo (solo se avisa que se pierde). */
  alternativa: ObjetoDeMision | null;
  protectores: number;
  potenciadorActivo: boolean;
  potenciadoresEnEspera: number;
};

export type CelebracionesPendientes = {
  rango: CelebracionDeRango | null;
  medallas: CelebracionDeMedalla[];
  objetos: ObjetoPorDecidir[];
};

/** Respuesta de la ventana: cambiar por el otro objeto o dejarlo pasar («No, gracias» o «Entendido»). */
export type DecisionDeObjeto = { instancia: string; accion: "cambiar" | "rechazar" };

/** Lo que mide una medalla para que su celebración lleve fuego: la racha (decisión del 2026-11-16). */
export const MEDIDAS_CON_FUEGO: ReadonlySet<string> = new Set(["racha_maxima"]);

/** Día de la fila de la semana en la celebración de racha: los últimos 7 días, hoy al final. */
export type DiaDeLaCelebracion = { dia: string; conAporte: boolean; hoy: boolean };

/**
 * Cambio de la racha que provocó un envío, cuando hay que celebrarlo: el primer aporte del día la alarga, la empieza o
 * la reaviva después de perderla (Fénix). El segundo aporte del día no cambia nada y no devuelve esto.
 */
export type CambioDeRacha = {
  tipo: "alarga" | "empieza" | "reaviva";
  antes: number;
  ahora: number;
  semana: DiaDeLaCelebracion[];
};

/** Evento de ventana con el que la pantalla de aportar avisa a las celebraciones de un CambioDeRacha. */
export const EVENTO_CELEBRAR_RACHA = "dataforgood:celebrar-racha";

/** Lo que se envía a POST /api/progreso/celebraciones para marcar vistas. */
export type CelebracionesVistas = { rangos: number[]; medallas: number[] };
