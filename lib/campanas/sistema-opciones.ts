import type { Pestana } from "@/components/sistema/subtabs";

/*
 * Constantes, tipos y formato de la sección Campañas del panel del
 * SuperUsuario. Sin imports de servidor: lo usan también componentes
 * cliente (filtros.tsx). Las consultas están en ./sistema.ts.
 */

export const PESTANAS_CAMPANAS: Pestana[] = [
  { href: "/sistema/campanas/dashboard", etiqueta: "Dashboard" },
  { href: "/sistema/campanas", etiqueta: "Listado" },
];

export const POR_PAGINA = 20;

/* ── modelo ─────────────────────────────────────────────────────────────── */

export type EstadoDeCampana =
  | "activa"
  | "aceptada"
  | "pausada"
  | "en_revision"
  | "borrador"
  | "rechazada"
  | "finalizada";

export type TipoDeDato = "foto" | "video" | "audio" | "documento" | "texto";

type TonoDeEtiqueta = "default" | "ok" | "warn" | "danger";

export const ETIQUETA_DE_CAMPANA: Record<EstadoDeCampana, { texto: string; tono: TonoDeEtiqueta }> = {
  activa: { texto: "Activa", tono: "ok" },
  // Aceptada por el supervisor con fecha de inicio futura: se activa sola ese día.
  aceptada: { texto: "Programada", tono: "ok" },
  pausada: { texto: "Pausada", tono: "warn" },
  en_revision: { texto: "En revisión", tono: "warn" },
  borrador: { texto: "Borrador", tono: "default" },
  rechazada: { texto: "Rechazada", tono: "danger" },
  finalizada: { texto: "Finalizada", tono: "default" },
};

export const ORDEN_DE_ESTADOS: EstadoDeCampana[] = [
  "activa",
  "aceptada",
  "pausada",
  "en_revision",
  "borrador",
  "rechazada",
  "finalizada",
];

export const NOMBRE_DE_TIPO: Record<TipoDeDato, string> = {
  foto: "Foto",
  video: "Video",
  audio: "Audio",
  documento: "Documento",
  texto: "Texto",
};

export const VIGENCIAS = [
  { valor: "7d", etiqueta: "Vence en menos de 7 días" },
  { valor: "30d", etiqueta: "Vence en menos de 30 días" },
  { valor: "mas30", etiqueta: "Más de 30 días" },
];

export const ORDENES_DE_CAMPANA = [
  { valor: "participantes", etiqueta: "Más participantes" },
  { valor: "aportes", etiqueta: "Más aportes" },
  { valor: "avance", etiqueta: "Mayor avance" },
  { valor: "vence", etiqueta: "Vence antes" },
];

/**
 * Estados del listado: sin borradores, que son privados de su creador hasta
 * que los envía a revisión.
 */
export const ESTADOS_DEL_LISTADO: EstadoDeCampana[] = ORDEN_DE_ESTADOS.filter((e) => e !== "borrador");

export function esEstado(v?: string): EstadoDeCampana | undefined {
  return ORDEN_DE_ESTADOS.includes(v as EstadoDeCampana) ? (v as EstadoDeCampana) : undefined;
}

export function esTipo(v?: string): TipoDeDato | undefined {
  return v && v in NOMBRE_DE_TIPO ? (v as TipoDeDato) : undefined;
}

export type FilaDeCampana = {
  id: string;
  nombre: string;
  tematica: string;
  creador: string;
  tiposDeDato: TipoDeDato[];
  estado: EstadoDeCampana;
  participantes: number;
  aportes: number;
  /** Los que cuentan para la meta (./meta.ts). */
  aprobados: number;
  meta: number;
  /** "YYYY-MM-DD"; null si la campaña no tiene fecha de cierre. */
  venceEn: string | null;
};

export type DashboardDeCampanas = {
  activas: number;
  registradas: number;
  participantesUnicos: number;
  aportesRecibidos: number;
  avanceMedio: number;
  porTematica: { etiqueta: string; valor: number }[];
  porTipoDeDato: { etiqueta: string; valor: number }[];
  porEstado: Record<EstadoDeCampana, number>;
  vigencia: {
    menosDe7: number;
    entre7y30: number;
    masDe30: number;
    sinFecha: number;
    duracionMediaEnDias: number | null;
    antiguedadMediaEnDias: number | null;
  };
  masParticipacion: FilaDeCampana[];
  cortadoEn: Date;
};

/* ── formato ────────────────────────────────────────────────────────────── */

// La regla de la meta (solo aprobados) vive en ./meta.ts.
export { porcentajeDeMeta } from "./meta";

/** "YYYY-MM-DD" de hoy en la hora local del servidor, igual que lib/campaign-date. */
export function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function diasRestantes(venceEn: string | null): number | null {
  if (!venceEn) return null;
  return Math.max(0, Math.round((Date.parse(venceEn) - Date.parse(hoyLocal())) / 86_400_000));
}

export function formatearFechaCampana(fecha: string | null, conAnio = true): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(conAnio ? { year: "numeric" } : {}),
  });
}
