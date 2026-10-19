// Preferencias de "Comunicación y notificaciones" en /cuenta (2026-10-14). Sin imports de servidor:
// la usan la ventana de Preferencias (cliente), PATCH /api/usuarios/[id]/preferencias y la sesión.
// Todas llegan como notificación de la app (campana, /notificaciones y push), nunca por correo.

export type ClaveDePreferencia = "avisosCampanasNuevas" | "avisosAportes" | "recordatorioSemanal" | "resumenMensual" | "notificaciones";

export type Preferencias = Record<ClaveDePreferencia, boolean>;

export const OPCIONES_DE_PREFERENCIAS: {
  clave: ClaveDePreferencia;
  /** Columna de `usuarios`. */
  columna: string;
  titulo: string;
  encendida: string;
  apagada: string;
}[] = [
  {
    clave: "avisosCampanasNuevas",
    columna: "avisos_campanas_nuevas",
    titulo: "Campañas nuevas",
    encendida: "Campañas de tus temáticas en tu zona (hasta 3 al día) y las especiales.",
    apagada: "No recibes avisos de campañas nuevas.",
  },
  {
    clave: "avisosAportes",
    columna: "avisos_aportes",
    titulo: "Aportes",
    encendida: "Te avisamos cuando aceptan o rechazan uno de tus aportes.",
    apagada: "No recibes avisos del estado de tus aportes; los ves en Mis aportes.",
  },
  {
    clave: "recordatorioSemanal",
    columna: "recordatorio_semanal",
    titulo: "Recordatorios",
    encendida: "Los lunes, si te falta cuota en campañas donde participas o que guardaste y cierran pronto.",
    apagada: "No recibes el recordatorio semanal.",
  },
  {
    clave: "resumenMensual",
    columna: "resumen_mensual",
    titulo: "Newsletter",
    encendida: "El día 1, un resumen del mes: tus aportes aceptados, campañas de tus temáticas y datos abiertos.",
    apagada: "No recibes el resumen mensual.",
  },
];

/**
 * Interruptor general "Notificaciones" (2026-10-19, en lugar del de "Privacidad", que no hacía nada).
 * Apagado, no llega ninguna notificación (ni a la campana ni como push), salvo las de la cuenta:
 * rol, sanciones e invitaciones de revisor (NOTIFICACIONES_ESENCIALES en lib/notificaciones/notificaciones.ts).
 * Las cuatro de arriba conservan su valor y vuelven a valer al encenderlo.
 */
export const PREFERENCIA_GENERAL = {
  clave: "notificaciones" as const,
  columna: "notificaciones_activas",
  titulo: "Notificaciones",
  encendida: "Recibes notificaciones según las opciones de arriba.",
  apagada: "No recibes notificaciones, salvo las de tu cuenta (roles, sanciones e invitaciones de revisor).",
};

/** Todas las que guarda PATCH /api/usuarios/[id]/preferencias. */
export const TODAS_LAS_PREFERENCIAS = [...OPCIONES_DE_PREFERENCIAS, PREFERENCIA_GENERAL];
