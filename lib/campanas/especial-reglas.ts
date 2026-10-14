// Reglas de la campaña especial que también usa el navegador (sin imports de servidor):
// tope del multiplicador, XP base por tipo de dato, bono por cuota y la forma de los datos.
// La lógica de servidor está en ./especial.ts. Decisiones del usuario del 2026-10-14 en
// references/dominio.md § 7.

import type { DataType } from "@/types";

/** Tope del sistema (dominio.md § 7): de ×1 a ×3. */
export const MULTIPLICADOR_MAXIMO = 3;

/** Bonificación por completar la cuota (fija; dominio.md § 7). */
export const BONO_POR_CUOTA = 300;

export const LARGO_MAXIMO_DE_INSIGNIA = 40;

/**
 * XP base por tipo de dato del aporte aprobado (prototipo SCR-WEB-13 y SCR-WEB-21). Es lo que
 * muestra la pantalla de especial; quien haga la gamificación decide si es lo que se otorga
 * (punto abierto 4 de dominio.md).
 */
export const XP_BASE_POR_TIPO: Record<DataType, number> = {
  texto: 10,
  foto: 25,
  documento: 25,
  audio: 50,
  video: 50,
};

/** Incentivos de una campaña especial, como los entrega la API. */
export type CampanaEspecial = {
  inicio: string; // YYYY-MM-DD
  fin: string; // YYYY-MM-DD
  multiplicador: number;
  insignia: string | null;
  bono: number;
  /** "vigente" si hoy está dentro del periodo, "proxima" si aún no empieza, "terminada" si ya pasó. */
  etapa: "proxima" | "vigente" | "terminada";
};

/** "15 ago" (o "15 ago 2027" si no es de este año) para un "YYYY-MM-DD". */
export function fechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const valor = new Date(y, m - 1, d);
  const opciones: Intl.DateTimeFormatOptions =
    y === new Date().getFullYear() ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" };
  return valor.toLocaleDateString("es-MX", opciones).replace(".", "");
}

/** Línea de resumen: "Multiplicador ×2 · insignia “Guardián verde” · bono de 300 XP". */
export function resumenDeIncentivos(especial: CampanaEspecial): string {
  const partes = [`Multiplicador ×${especial.multiplicador}`];
  if (especial.insignia) partes.push(`insignia “${especial.insignia}”`);
  partes.push(`bono de ${especial.bono} XP`);
  return partes.join(" · ");
}

/** "incentivos activos hasta el 22 ago", "incentivos desde el 15 ago" o "incentivos terminados el 22 ago". */
export function textoDelPeriodo(especial: CampanaEspecial): string {
  if (especial.etapa === "proxima") return `incentivos del ${fechaCorta(especial.inicio)} al ${fechaCorta(especial.fin)}`;
  if (especial.etapa === "vigente") return `incentivos activos hasta el ${fechaCorta(especial.fin)}`;
  return `incentivos terminados el ${fechaCorta(especial.fin)}`;
}
