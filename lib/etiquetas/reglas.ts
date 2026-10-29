// Etiquetas (subtemáticas de una temática, 2026-10-27): constantes y tipos compartidos por el
// servidor (lib/etiquetas/catalogo.ts) y los componentes cliente. Sin imports de servidor.

/** Etiquetas que puede llevar una campaña (opcionales). */
export const MAXIMO_DE_ETIQUETAS_POR_CAMPANA = 5;

/** Etiquetas que una persona puede marcar en sus intereses. */
export const MAXIMO_DE_ETIQUETAS_EN_PERFIL = 20;

/**
 * Etiquetas nuevas que una persona puede proponer al guardar su perfil (2026-10-28): quedan pendientes
 * hasta que el SuperUsuario las revisa, y cuentan dentro de MAXIMO_DE_ETIQUETAS_EN_PERFIL.
 */
export const MAXIMO_DE_ETIQUETAS_NUEVAS_EN_PERFIL = 5;

/**
 * Una etiqueta que se ofrece: aprobada y visible. `pendiente` (2026-10-28): una que propuso quien
 * mira (o que ya tiene en su perfil) y el SuperUsuario aún no revisa; solo la ve esa persona.
 */
export type EtiquetaDelCatalogo = { id: number; nombre: string; pendiente?: boolean };

/** Etiqueta que la persona escribe en sus intereses porque no la encontró (2026-10-28). */
export type EtiquetaNueva = { tematica: string; nombre: string };

/** Etiquetas que se ofrecen, por nombre de temática. */
export type CatalogoDeEtiquetas = Record<string, EtiquetaDelCatalogo[]>;

/** Etiqueta de una campaña: `pendiente` mientras el SuperUsuario no aprueba la que propuso el creador. */
export type EtiquetaDeCampana = { nombre: string; pendiente: boolean };
