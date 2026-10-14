// Contrato de la tabla de líderes de la landing (2026-10-13): tipos y ayudantes que comparten el
// servidor (lib/gamificacion/clasificacion.ts) y los componentes cliente de components/gamificacion.
// Sin imports de servidor (nada de `pg`): lo importa un componente cliente.
//
// Decisiones del usuario (2026-10-13): la landing es pública, así que el nombre va como "Carlos P."
// (nombreParaMostrar) y nunca la foto de perfil (solo la ve la propia persona); cuentan solo los
// aportes aprobados; el periodo es desde siempre; 6 personas por categoría (3 en el podio y 3 en lista).

import type { IconoPredefinido } from "@/lib/usuarios/avatar-opciones";

export type CategoriaDeClasificacion = "aportes" | "nivel" | "tematica";

export const CATEGORIAS_DE_CLASIFICACION: { valor: CategoriaDeClasificacion; etiqueta: string }[] = [
  { valor: "aportes", etiqueta: "Por aportes" },
  { valor: "nivel", etiqueta: "Por nivel" },
  { valor: "tematica", etiqueta: "Por temática" },
];

/** Personas por categoría: las 3 primeras van en el podio y el resto en la lista. */
export const LIDERES_POR_CATEGORIA = 6;
export const LUGARES_DEL_PODIO = 3;

export type Lider = {
  usuarioId: number;
  /** Ya listo para una página pública: "Carlos P." (usa nombreParaMostrar). */
  nombre: string;
  /** Ícono predefinido del perfil, o null para las iniciales. Nunca "foto": la foto es privada. */
  avatar: IconoPredefinido | null;
  /** Aportes aprobados (aportes y tematica) o nivel (nivel). Ordena la lista, de mayor a menor. */
  valor: number;
  /** Texto chico opcional bajo el valor, p. ej. "1,240 XP" en la categoría nivel. */
  detalle?: string;
};

export type ClasificacionPorTematica = {
  /** Nombre de la temática, tal como sale en el catálogo ("Medio ambiente"). */
  tematica: string;
  lideres: Lider[];
};

export type TablaDeLideres = {
  aportes: Lider[];
  nivel: Lider[];
  /** Una entrada por temática con al menos un aporte aprobado; la primera es la que se muestra al abrir. */
  tematicas: ClasificacionPorTematica[];
};

/** Texto del valor de un líder en cada categoría ("12 aportes", "Nivel 5"). */
export function textoDelValor(categoria: CategoriaDeClasificacion, valor: number): string {
  const n = new Intl.NumberFormat("es-MX").format(valor);
  if (categoria === "nivel") return `Nivel ${n}`;
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
