// Contrato de la tabla de líderes de la landing (2026-10-13): tipos y ayudantes que comparten el
// servidor (lib/gamificacion/clasificacion.ts) y los componentes cliente de components/gamificacion.
// Sin imports de servidor (nada de `pg`): lo importa un componente cliente.
//
// Decisiones del usuario (2026-10-13): la landing es pública, así que el nombre va como "Carlos P."
// (nombreParaMostrar) y la foto de perfil solo desde el 2026-11-12 (antes nunca; ver Lider.avatar); cuentan solo los
// aportes aprobados; 6 personas por categoría (3 en el podio y 3 en lista). El periodo era desde siempre;
// desde el 2026-11-12 (a pedido del usuario) la landing elige hoy, este mes, este año o el histórico.
// 2026-11-12 (SRS v1.3: RF-GAM-89, 91, 92, 94; RA-GAM-20, 21): «Por nivel» pasa a «Por rango» y la tabla nunca
// muestra EXP ni racha.

import type { TipoDeAvatar } from "@/lib/usuarios/avatar-opciones";

export type CategoriaDeClasificacion = "aportes" | "rango" | "tematica";

export const CATEGORIAS_DE_CLASIFICACION: { valor: CategoriaDeClasificacion; etiqueta: string }[] = [
  { valor: "aportes", etiqueta: "Por aportes" },
  { valor: "rango", etiqueta: "Por rango" },
  { valor: "tematica", etiqueta: "Por temática" },
];

/**
 * Periodo de la tabla de la landing (2026-11-12, a pedido del usuario). Los aportes cuentan por la fecha
 * en que se aprobaron, en hora de Tepic: "dia" desde las 00:00 de hoy, "mes" desde el día 1 y "anio"
 * desde el 1 de enero. El rango es acumulado: no cambia con el periodo.
 */
export type PeriodoDeClasificacion = "dia" | "mes" | "anio" | "siempre";

export const PERIODOS_DE_CLASIFICACION: { valor: PeriodoDeClasificacion; etiqueta: string; enTexto: string }[] = [
  { valor: "dia", etiqueta: "Hoy", enTexto: "hoy" },
  { valor: "mes", etiqueta: "Este mes", enTexto: "este mes" },
  { valor: "anio", etiqueta: "Este año", enTexto: "este año" },
  { valor: "siempre", etiqueta: "Histórico", enTexto: "desde siempre" },
];

/** Personas por categoría en la landing: las 3 primeras van en el podio y el resto en la lista. */
export const LIDERES_POR_CATEGORIA = 6;
export const LUGARES_DEL_PODIO = 3;
/** Personas por página en /lideres (la tabla completa). */
export const LIDERES_POR_PAGINA = 25;

/** Valida el `?categoria=` de /lideres: cualquier otro valor cae en "aportes". El viejo «nivel» lleva a «rango». */
export function categoriaValida(valor: string | undefined): CategoriaDeClasificacion {
  if (valor === "nivel") return "rango";
  return CATEGORIAS_DE_CLASIFICACION.some((c) => c.valor === valor) ? (valor as CategoriaDeClasificacion) : "aportes";
}

export type Lider = {
  usuarioId: number;
  /** Ya listo para una página pública: "Carlos P." (usa nombreParaMostrar). */
  nombre: string;
  /**
   * Ícono predefinido, "foto" (desde el 2026-11-12, a pedido del usuario: la foto de quien sale en la
   * clasificación es pública) o null para las iniciales.
   */
  avatar: TipoDeAvatar | null;
  /** Versión de la foto para su URL (cambia con cada foto nueva); null sin foto. */
  version: string | null;
  /** Aportes aprobados (aportes y tematica) o número de rango (rango). Ordena la lista, de mayor a menor. */
  valor: number;
  /**
   * Texto chico opcional bajo el valor: en «rango», el nombre del rango, solo si quien consulta ya puede verlo
   * (RF-GAM-92, RNF-GAM-14: el servidor no lo manda si está oculto). Nunca EXP ni racha (RF-GAM-91).
   */
  detalle?: string;
};

export type ClasificacionPorTematica = {
  /** Nombre de la temática, tal como sale en el catálogo ("Medio ambiente"). */
  tematica: string;
  lideres: Lider[];
};

export type TablaDeLideres = {
  aportes: Lider[];
  rango: Lider[];
  /** Una entrada por temática con al menos un aporte aprobado; la primera es la que se muestra al abrir. */
  tematicas: ClasificacionPorTematica[];
};

/** La tabla de la landing armada para cada periodo; el cliente cambia de periodo sin recargar. */
export type TablasPorPeriodo = Record<PeriodoDeClasificacion, TablaDeLideres>;

/** Texto del valor de un líder en cada categoría ("12 aportes", "Rango 5"). */
export function textoDelValor(categoria: CategoriaDeClasificacion, valor: number): string {
  const n = new Intl.NumberFormat("es-MX").format(valor);
  if (categoria === "rango") return `Rango ${n}`;
  return `${n} ${valor === 1 ? "aporte" : "aportes"}`;
}

function conMayusculaInicial(palabra: string): string {
  const minusculas = palabra.toLocaleLowerCase("es-MX");
  return minusculas.charAt(0).toLocaleUpperCase("es-MX") + minusculas.slice(1);
}

/**
 * Nombre para una página pública: primer nombre e inicial del primer apellido ("CARLOS ALBERTO" +
 * "PEREZ RENTERIA" → "Carlos P."). Sin apellidos, solo el primer nombre.
 */
export function nombreParaMostrar(nombre: string | null | undefined, apellidos: string | null | undefined): string {
  const primerNombre = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  const inicial = (apellidos ?? "").trim().charAt(0);
  const visible = primerNombre ? conMayusculaInicial(primerNombre) : "Participante";
  return inicial ? `${visible} ${inicial.toLocaleUpperCase("es-MX")}.` : visible;
}
