// Etiquetas (subtemáticas de una temática, 2026-10-27): constantes y tipos compartidos por el
// servidor (lib/etiquetas/catalogo.ts) y los componentes cliente. Sin imports de servidor.

/** Etiquetas que puede llevar una campaña (opcionales). */
export const MAXIMO_DE_ETIQUETAS_POR_CAMPANA = 5;

/** Etiquetas que una persona puede marcar en sus intereses. */
export const MAXIMO_DE_ETIQUETAS_EN_PERFIL = 20;

/** Una etiqueta que se ofrece: aprobada y visible. */
export type EtiquetaDelCatalogo = { id: number; nombre: string };

/** Etiquetas que se ofrecen, por nombre de temática. */
export type CatalogoDeEtiquetas = Record<string, EtiquetaDelCatalogo[]>;

/** Etiqueta de una campaña: `pendiente` mientras el SuperUsuario no aprueba la que propuso el creador. */
export type EtiquetaDeCampana = { nombre: string; pendiente: boolean };
