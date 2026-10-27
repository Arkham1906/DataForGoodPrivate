// Tipos y formato de las notificaciones, compartidos por el servidor y los componentes cliente
// (NotificationsBell, /notificaciones). Sin imports de servidor: no importar `pg` aquí.

/** Qué evento generó la notificación (columna `notificaciones.tipo`). */
export type TipoDeNotificacion =
  // Sobre mis aportes
  | "aporte_aceptado"
  | "aporte_rechazado"
  | "campana_baneo"
  | "campana_desbaneo"
  // Sobre mis campañas
  | "campana_aceptada"
  | "campana_rechazada"
  | "campana_reportada"
  | "campana_iniciada"
  | "campana_finalizada"
  // La supervisión la pausó o la reanudó (lib/supervision/estado-por-supervision.ts).
  | "campana_pausada"
  | "campana_reanudada"
  // El SuperUsuario revirtió la aceptación o el rechazo (lib/usuarios/acciones-supervisor.ts).
  | "campana_en_revision"
  | "revisor_acepto"
  | "aporte_reportado"
  // Al creador, cada 10 aportes recibidos; reemplaza al anterior de la campaña (./hitos-de-aportes.ts).
  | "aportes_recibidos"
  // Supervisión y revisión
  | "invitacion_revisor"
  // El creador lo quitó como revisor de su campaña (lib/campanas/revisores.ts, 2026-10-22).
  | "revisor_quitado"
  | "rol_asignado"
  | "rol_revocado"
  // Al supervisor: el SuperUsuario revirtió una de sus decisiones.
  | "supervision_revertida"
  // A los supervisores (./avisos-a-supervisores.ts): llegó un reporte o una campaña entró a revisión.
  | "reporte_nuevo"
  | "campana_por_revisar"
  // Al supervisor de la campaña: el creador la editó mientras estaba pausada.
  | "campana_editada"
  // Campañas para participar (lib/notificaciones/campanas-por-interes.ts)
  | "campana_nueva"
  | "campana_especial"
  // Una temática nueva coincide con lo que escribió sobre sus gustos (./tematica-nueva.ts, 2026-10-26).
  | "tematica_nueva"
  // Periódicas, según Preferencias (lib/notificaciones/periodicas.ts)
  | "recordatorio_semanal"
  | "resumen_mensual"
  // Sanciones de la cuenta
  | "sancion_aplicada"
  | "sancion_restaurada";

/** Notificación como la entrega GET /api/notificaciones (y la página /notificaciones). */
export type Notificacion = {
  id: string;
  type: string;
  title: string;
  message: string;
  campaignId: string | null;
  campaignName: string | null;
  /** Ruta de la app a la que lleva (sin basePath), o null si no lleva a ningún lado. */
  href: string | null;
  /** Solo en invitacion_revisor: true mientras la invitación siga sin aceptar. */
  invitationPending: boolean;
  readAt: string | null;
  createdAt: string;
};

export type PaginaDeNotificaciones = {
  data: Notificacion[];
  noLeidas: number;
  /** Cuántas borraría "Limpiar" (limpiarNotificaciones): leídas o más viejas que DIAS_PARA_NOTIFICACION_VIEJA. */
  limpiables: number;
  total: number;
  pagina: number;
  porPagina: number;
};

/** Tono del punto de color de cada notificación (mismos nombres que ui/Tag). */
export function tonoDeNotificacion(tipo: string): "ok" | "warn" | "danger" | "default" {
  switch (tipo) {
    case "aporte_aceptado":
    case "campana_aceptada":
    case "campana_iniciada":
    case "campana_reanudada":
    case "campana_nueva":
    case "tematica_nueva":
    case "revisor_acepto":
    case "rol_asignado":
    case "sancion_restaurada":
    case "campana_desbaneo":
    case "aportes_recibidos":
      return "ok";
    case "campana_especial":
    case "campana_reportada":
    case "campana_pausada":
    case "aporte_reportado":
    case "rol_revocado":
    case "revisor_quitado":
    case "campana_en_revision":
    case "supervision_revertida":
    case "reporte_nuevo":
    case "campana_editada":
      return "warn";
    case "aporte_rechazado":
    case "campana_rechazada":
    case "campana_baneo":
    case "sancion_aplicada":
      return "danger";
    default:
      return "default";
  }
}

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Mazatlan",
});

/** "6 oct, 14:32" en hora de Tepic. Igual en servidor y cliente (no depende de la hora actual). */
export function fechaDeNotificacion(iso: string): string {
  return FECHA.format(new Date(iso));
}

/** "hace 5 min", "hace 3 h"... Solo para componentes que se dibujan en el cliente (la campana). */
export function haceCuanto(iso: string, ahora: number = Date.now()): string {
  const minutos = Math.floor((ahora - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return dias === 1 ? "ayer" : `hace ${dias} días`;
  return fechaDeNotificacion(iso);
}

/** Evento que avisa a la campana que algo cambió en otra parte de la página (p. ej. /notificaciones). */
/**
 * "Limpiar" de /notificaciones (2026-10-19) borra las leídas y, aunque no se hayan leído, las que
 * tienen más de estos días. TODO(dominio): 30 días es provisional.
 */
export const DIAS_PARA_NOTIFICACION_VIEJA = 30;

/**
 * Avisos que cambian lo que la persona puede ver o hacer: al llegar en vivo (GET /api/eventos),
 * la campana refresca la página para que el menú y los permisos se pongan al día sin recargar
 * (p. ej. aparece "Supervisión" al recibir el rol; una suspensión lleva a /cuenta-bloqueada).
 */
export const AVISOS_QUE_REFRESCAN: ReadonlySet<string> = new Set([
  "rol_asignado",
  "rol_revocado",
  "sancion_aplicada",
  "sancion_restaurada",
  "campana_baneo",
  "campana_desbaneo",
  "revisor_acepto",
]);

export const EVENTO_NOTIFICACIONES = "dataforgood:notificaciones";
