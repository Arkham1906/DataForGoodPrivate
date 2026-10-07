// Números de la recuperación de contraseña. Sin imports de servidor: los usan
// lib/usuarios/recuperacion.ts y la pantalla /recuperar.

/** Minutos que dura un código. */
export const MINUTOS_DE_VIGENCIA = 15;
/** Intentos por código; al agotarlos hay que pedir otro. */
export const INTENTOS_POR_CODIGO = 3;
/** Segundos mínimos entre dos correos a la misma cuenta. */
export const SEGUNDOS_ENTRE_ENVIOS = 60;
