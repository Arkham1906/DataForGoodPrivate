// Pendientes (2026-11-24, a pedido del usuario): lo que una persona (o el SuperUsuario) tiene por hacer, cada uno por
// separado, con su enlace, cuánto lleva esperando o cuándo vence, y su urgencia. Los arman lib/pendientes/del-usuario.ts
// (zona de usuario) y lib/pendientes/del-panel.ts (SuperUsuario); los muestran las pantallas /pendientes y
// /sistema/pendientes, el recuadro azul del menú lateral (los más importantes y "Ver todos") y el número junto a
// "Pendientes" del menú. Sin imports de servidor: lo usan componentes cliente.

/** "urgente": bloquea a alguien o vence ya; "pronto": conviene atenderlo estos días; "normal": cuando puedas. */
export type Urgencia = "urgente" | "pronto" | "normal";

export type Pendiente = {
  /** Única en la lista (p. ej. "dictaminar-12"). */
  clave: string;
  /** Sección de la pantalla (ver SECCIONES_*). */
  seccion: string;
  /** Qué hacer: "Dictaminar «Baches en avenidas»". */
  texto: string;
  href: string;
  urgencia: Urgencia;
  /** Cuánto lleva esperando o cuándo vence: "Espera hace 5 días", "Cierra mañana". */
  detalle?: string;
  /** Instante de referencia (ISO) para ordenar: lo que lleva más esperando o vence antes, primero. */
  desde?: string;
  /** Qué clase de pendiente es ("supervisar", "reportes"...): con él, "Requiere atención" de /sistema los agrupa. */
  tipo?: string;
  /** Cuántas cosas abarca el renglón (aportes que esperan, reportes); sin él, 1. */
  cantidad?: number;
  /** Solo reportes: en cuántos casos (una campaña o un aporte reportado) se reparten. */
  casos?: number;
};

export type Seccion = { clave: string; titulo: string; descripcion: string };

/** Secciones de /pendientes, en el orden de la pantalla (lo que bloquea a otros primero). */
export const SECCIONES_DEL_USUARIO: Seccion[] = [
  { clave: "supervision", titulo: "Supervisión", descripcion: "Campañas y reportes que esperan tu decisión como supervisor." },
  { clave: "revision", titulo: "Revisión de aportes", descripcion: "Campañas donde eres revisor de aportes." },
  { clave: "campanas", titulo: "Tus campañas", descripcion: "Lo que falta en las campañas que creaste." },
  { clave: "aportar", titulo: "Aportar", descripcion: "Campañas donde aún te faltan aportes para tu cuota." },
  { clave: "apelaciones", titulo: "Tus apelaciones", descripcion: "Respuestas a tus apelaciones de los últimos días." },
  { clave: "perfil", titulo: "Tu perfil", descripcion: "Datos que ayudan a mostrarte campañas que te interesan." },
];

/** Secciones de /sistema/pendientes. */
export const SECCIONES_DEL_PANEL: Seccion[] = [
  { clave: "tickets", titulo: "Tickets de supervisores", descripcion: "Sanciones y decisiones de datos abiertos que pidieron los supervisores: no se aplican hasta que las apruebas." },
  { clave: "supervision", titulo: "Supervisión", descripcion: "Campañas sin supervisor o a tu cargo y decisiones de datos abiertos." },
  { clave: "moderacion", titulo: "Moderación", descripcion: "Reportes y apelaciones que esperan una decisión." },
  { clave: "aportes", titulo: "Aportes sin revisar", descripcion: "Campañas con aportes que esperan revisión hace más de una semana." },
  { clave: "catalogo", titulo: "Temáticas y subtemáticas", descripcion: "Propuestas que solo tú apruebas o rechazas." },
];

/** Días que un aporte puede esperar revisión antes de salir en los pendientes del panel (antes en lib/sistema/resumen.ts). */
export const DIAS_DE_ESPERA_DE_UN_APORTE = 7;

/** Días de espera desde los que un pendiente pasa a "pronto" y a "urgente". */
export const DIAS_PARA_PRONTO = 3;
export const DIAS_PARA_URGENTE = 7;
/** Días antes del cierre desde los que una fecha límite es "pronto" y "urgente". */
export const DIAS_DE_CIERRE_PRONTO = 7;
export const DIAS_DE_CIERRE_URGENTE = 2;
/** Cuántos pendientes caben en el recuadro del menú lateral antes de "Ver todos". */
export const PENDIENTES_EN_EL_MENU = 3;

const ORDEN_DE_URGENCIA: Record<Urgencia, number> = { urgente: 0, pronto: 1, normal: 2 };

export const ETIQUETA_DE_URGENCIA: Record<Urgencia, string> = { urgente: "Urgente", pronto: "Pronto", normal: "" };

/** Días completos entre `desde` y ahora (0 si es de hoy o del futuro). */
export function diasDesde(desde: Date | string | null | undefined, ahora = Date.now()): number {
  if (!desde) return 0;
  const t = new Date(desde).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((ahora - t) / 86_400_000));
}

/** Urgencia por tiempo de espera. */
export function urgenciaPorEspera(dias: number): Urgencia {
  return dias >= DIAS_PARA_URGENTE ? "urgente" : dias >= DIAS_PARA_PRONTO ? "pronto" : "normal";
}

/** Urgencia por días que faltan para una fecha límite. */
export function urgenciaPorCierre(diasQueFaltan: number): Urgencia {
  return diasQueFaltan <= DIAS_DE_CIERRE_URGENTE ? "urgente" : diasQueFaltan <= DIAS_DE_CIERRE_PRONTO ? "pronto" : "normal";
}

/** "hoy", "ayer", "hace 5 días". */
export function haceCuanto(dias: number): string {
  return dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
}

/** "Cierra hoy", "Cierra mañana", "Cierra en 4 días". */
export function cuandoCierra(diasQueFaltan: number): string {
  return diasQueFaltan <= 0 ? "Cierra hoy" : diasQueFaltan === 1 ? "Cierra mañana" : `Cierra en ${diasQueFaltan} días`;
}

/** Lo más urgente primero; a igual urgencia, lo que lleva más esperando (o vence antes). */
export function ordenarPendientes(lista: Pendiente[]): Pendiente[] {
  return [...lista].sort(
    (a, b) =>
      ORDEN_DE_URGENCIA[a.urgencia] - ORDEN_DE_URGENCIA[b.urgencia] ||
      (a.desde ?? "9999").localeCompare(b.desde ?? "9999"),
  );
}

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Lo que pinta el recuadro azul del menú lateral (components/layout/AvisoDelMenu). */
export type AvisoDePendientes = {
  texto: string;
  renglones?: { texto: string; href: string; urgencia?: Urgencia }[];
  enlace?: { href: string; etiqueta: string };
  cierre?: string;
};

/**
 * El recuadro del menú con los pendientes (2026-11-24): los PENDIENTES_EN_EL_MENU más urgentes y "Ver todos (N)" a la
 * pantalla de pendientes. Sin pendientes, la sugerencia (si hay) o la frase de siempre.
 */
export function avisoConPendientes(
  pendientes: Pendiente[],
  opciones: { verTodos: string; frase: AvisoDePendientes; sugerencia?: Pendiente | null; encabezado?: (n: number) => string },
): AvisoDePendientes {
  const n = pendientes.length;
  if (n > 0) {
    const encabezado = opciones.encabezado ?? ((total: number) => (total === 1 ? "Tienes 1 pendiente:" : `Tienes ${total} pendientes:`));
    return {
      texto: encabezado(n),
      renglones: pendientes.slice(0, PENDIENTES_EN_EL_MENU).map((p) => ({ texto: p.texto, href: p.href, urgencia: p.urgencia })),
      enlace: { href: opciones.verTodos, etiqueta: n > PENDIENTES_EN_EL_MENU ? `Ver todos (${n})` : "Ver pendientes" },
    };
  }
  if (opciones.sugerencia) {
    return {
      texto: "Te puede interesar:",
      renglones: [{ texto: `${opciones.sugerencia.texto} (${opciones.sugerencia.detalle?.toLowerCase() ?? ""})`.replace(" ()", ""), href: opciones.sugerencia.href }],
    };
  }
  return opciones.frase;
}
