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
  // Llegó su inicio, pero el creador ya tiene el máximo de activas (lib/campaign-date.ts, 2026-10-27).
  | "campana_en_espera"
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
  // Socialización, a quien participa (./socializacion.ts, 2026-10-28): la campaña pasó un hito de su
  // meta, o se activó otra con alguna de sus etiquetas.
  | "campana_avance"
  | "campana_relacionada"
  // Una temática nueva coincide con lo que escribió sobre sus gustos (./tematica-nueva.ts, 2026-10-26).
  | "tematica_nueva"
  // El SuperUsuario revisó una etiqueta que la persona propuso en su perfil o su campaña (2026-10-28).
  | "etiqueta_aprobada"
  | "etiqueta_rechazada"
  // El SuperUsuario revisó una temática que la persona propuso (2026-10-29); al rechazarla, también al
  // creador de cada campaña que la usaba (pasó a otra temática).
  | "tematica_aprobada"
  | "tematica_rechazada"
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

/**
 * Escala de colores de las notificaciones (2026-10-27, a pedido del usuario: los colores de antes
 * confundían; el verde servía igual para "tu aporte fue aceptado" que para "hay una campaña nueva", y
 * lo que pedía una acción salía sin color). Cada color dice qué significa para quien la recibe, y es
 * el mismo en la campana, /notificaciones (con leyenda) e /inicio.
 */
export type CategoriaDeNotificacion = "problema" | "accion" | "buena" | "novedad" | "aviso";

export const CATEGORIAS_DE_NOTIFICACION: Record<
  CategoriaDeNotificacion,
  { nombre: string; punto: string; tono: "danger" | "warn" | "ok" | "info" | "default" }
> = {
  problema: { nombre: "Algo salió mal", punto: "bg-error-700", tono: "danger" },
  accion: { nombre: "Necesitas hacer algo", punto: "bg-warning-500", tono: "warn" },
  buena: { nombre: "Buenas noticias", punto: "bg-success-700", tono: "ok" },
  novedad: { nombre: "Novedades para participar", punto: "bg-brand-600", tono: "info" },
  aviso: { nombre: "Para que lo sepas", punto: "bg-system-500", tono: "default" },
};

/** Orden de la leyenda: de lo más urgente a lo informativo. */
export const ORDEN_DE_CATEGORIAS: CategoriaDeNotificacion[] = ["problema", "accion", "buena", "novedad", "aviso"];

export function categoriaDeNotificacion(tipo: string): CategoriaDeNotificacion {
  switch (tipo) {
    // Algo salió mal para ti.
    case "aporte_rechazado":
    case "campana_rechazada":
    case "campana_baneo":
    case "sancion_aplicada":
      return "problema";
    // Necesitas hacer algo (revisar, aceptar o atender tu campaña).
    case "invitacion_revisor":
    case "campana_por_revisar":
    case "reporte_nuevo":
    case "campana_editada":
    case "campana_en_espera":
    case "campana_pausada":
      return "accion";
    // Buenas noticias.
    case "aporte_aceptado":
    case "campana_aceptada":
    case "campana_iniciada":
    case "campana_reanudada":
    case "revisor_acepto":
    case "rol_asignado":
    case "sancion_restaurada":
    case "campana_desbaneo":
    case "aportes_recibidos":
    case "etiqueta_aprobada":
    case "tematica_aprobada":
    case "campana_avance":
      return "buena";
    // Novedades para participar.
    case "campana_nueva":
    case "campana_especial":
    case "campana_relacionada":
    case "tematica_nueva":
    case "recordatorio_semanal":
    case "resumen_mensual":
      return "novedad";
    // Solo para que lo sepas: campana_finalizada, rol_revocado, revisor_quitado, campana_en_revision,
    // supervision_revertida, etiqueta_rechazada, tematica_rechazada y los que ya no se crean (campana_reportada, aporte_reportado).
    default:
      return "aviso";
  }
}

/** Tono de ui/Tag de cada notificación (/inicio). */
export function tonoDeNotificacion(tipo: string): "danger" | "warn" | "ok" | "info" | "default" {
  return CATEGORIAS_DE_NOTIFICACION[categoriaDeNotificacion(tipo)].tono;
}

/** Clase del punto de color de una notificación; leída, un círculo vacío (así no se confunde con el gris de "Para que lo sepas"). */
export function claseDelPunto(tipo: string, leida: boolean): string {
  return leida ? "border border-system-300 bg-transparent" : CATEGORIAS_DE_NOTIFICACION[categoriaDeNotificacion(tipo)].punto;
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
