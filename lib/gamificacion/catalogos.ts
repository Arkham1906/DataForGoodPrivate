// Catálogos en JSON (2026-11-04): lib/datos/rangos.json, lib/datos/misiones.json y, desde el 2026-11-09,
// lib/datos/medallas.json son la fuente de los rangos, las misiones y las medallas. Para cambiarlos basta editar el
// JSON y volver a construir la app: al arrancar, ensureGamificacion() los valida y los copia a sus tablas. Con un
// error, se registra en el log y las tablas se quedan como estaban. Aquí solo se valida; no hay imports de servidor.

import datosDeMedallas from "@/lib/datos/medallas.json";
import datosDeMisiones from "@/lib/datos/misiones.json";
import datosDeRangos from "@/lib/datos/rangos.json";
import { GRUPOS_DE_MEDALLA, MEDIDAS_DE_MEDALLA, type GrupoDeMedalla, type MedidaDeMedalla } from "./medallas";
import {
  MEDIDAS_DE_MISION,
  TIPOS_DE_APORTE,
  type CondicionDeMision,
  type Periodicidad,
  type RecompensaDeMision,
} from "./misiones-reglas";

export type RangoDelCatalogo = {
  numero: number;
  nombre: string;
  descripcion: string | null;
  requisitos: { exp: number; aportes: number; sobresalientes: number; excepcionales: number; racha: number; misiones: number };
};

export type MisionDelCatalogo = {
  clave: string;
  nombre: string;
  descripcion?: string;
  periodicidad: Periodicidad;
  /** Dos misiones del mismo grupo no salen juntas si se puede evitar. */
  grupo: string;
  activa: boolean;
  condicion: CondicionDeMision;
  recompensa?: RecompensaDeMision;
};

export type SeleccionDelCatalogo = Record<Periodicidad, number>;

export type MedallaDelCatalogo = {
  /** Identifica la medalla para siempre: el historial de quien la ganó cuelga de ella. No se cambia. */
  clave: string;
  nombre: string;
  grupo: GrupoDeMedalla;
  mide: MedidaDeMedalla;
  activa: boolean;
  descripcion: string;
  /** En orden: el primero es el nivel 1. Cada umbral, mayor que el anterior. */
  niveles: { nombre: string; umbral: number }[];
};

const esEntero = (v: unknown, minimo: number): v is number => Number.isInteger(v) && (v as number) >= minimo;
const esTexto = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function erroresDeRangos(rangos: RangoDelCatalogo[]): string[] {
  const errores: string[] = [];
  if (!Array.isArray(rangos) || rangos.length === 0) return ["La lista de rangos está vacía."];
  rangos.forEach((r, i) => {
    const q = r.requisitos;
    if (r.numero !== i + 1) errores.push(`Posición ${i + 1}: los rangos deben ir numerados del 1 en adelante, sin saltos.`);
    if (!esTexto(r.nombre)) errores.push(`Rango ${r.numero}: falta el nombre.`);
    if (!q || !Object.values(q).every((v) => esEntero(v, 0)) || Object.keys(q).length !== 6) {
      errores.push(`Rango ${r.numero}: los seis requisitos deben ser enteros de 0 en adelante.`);
    } else if (q.excepcionales > q.sobresalientes || q.sobresalientes > q.aportes) {
      errores.push(`Rango ${r.numero}: debe cumplirse excepcionales ≤ sobresalientes ≤ aportes.`);
    }
  });
  return errores;
}

export function erroresDeMisiones(misiones: MisionDelCatalogo[], seleccion: SeleccionDelCatalogo = SELECCION_DE_MISIONES): string[] {
  const errores: string[] = [];
  if (!Array.isArray(misiones)) return ["«misiones» debe ser una lista."];
  for (const periodicidad of ["diaria", "semanal"] as const) {
    const activas = misiones.filter((m) => m.periodicidad === periodicidad && m.activa).length;
    if (!esEntero(seleccion?.[periodicidad], 1)) errores.push(`seleccion.${periodicidad} debe ser un entero mayor que 0.`);
    else if (activas < seleccion[periodicidad]) errores.push(`Hay ${activas} misiones de periodicidad ${periodicidad} activas y la selección pide ${seleccion[periodicidad]}.`);
  }
  const claves = new Set<string>();
  for (const m of misiones) {
    const quien = `Misión ${m.clave ?? "sin clave"}`;
    if (!esTexto(m.clave) || !/^[a-z0-9_]+$/.test(m.clave)) errores.push(`${quien}: la clave usa minúsculas, números y _.`);
    if (claves.has(m.clave)) errores.push(`${quien}: clave repetida.`);
    claves.add(m.clave);
    if (!esTexto(m.nombre)) errores.push(`${quien}: falta el nombre.`);
    if (m.periodicidad !== "diaria" && m.periodicidad !== "semanal") errores.push(`${quien}: periodicidad debe ser diaria o semanal.`);
    if (!esTexto(m.grupo)) errores.push(`${quien}: falta el grupo.`);
    if (typeof m.activa !== "boolean") errores.push(`${quien}: activa debe ser true o false.`);
    const c = m.condicion;
    if (!c || !MEDIDAS_DE_MISION.includes(c.mide)) errores.push(`${quien}: «mide» debe ser ${MEDIDAS_DE_MISION.join(", ")}.`);
    if (!esEntero(c?.objetivo, 1)) errores.push(`${quien}: el objetivo debe ser un entero mayor que 0.`);
    if (c?.tipos && !c.tipos.every((t) => (TIPOS_DE_APORTE as readonly string[]).includes(t))) {
      errores.push(`${quien}: los tipos válidos son ${TIPOS_DE_APORTE.join(", ")}.`);
    }
    if (c?.minEstrellas !== undefined && (!esEntero(c.minEstrellas, 1) || c.minEstrellas > 5 || !c.soloAceptados)) {
      errores.push(`${quien}: minEstrellas va de 1 a 5 y requiere soloAceptados.`);
    }
    if (c?.minCaracteres !== undefined && !esEntero(c.minCaracteres, 1)) errores.push(`${quien}: minCaracteres debe ser un entero mayor que 0.`);
    if (m.recompensa && (m.recompensa.tipo !== "exp" || !esEntero(m.recompensa.cantidad, 1))) {
      errores.push(`${quien}: por ahora la recompensa se omite o es { "tipo": "exp", "cantidad": entero mayor que 0 }.`);
    }
  }
  return errores;
}

export function erroresDeMedallas(medallas: MedallaDelCatalogo[]): string[] {
  const errores: string[] = [];
  if (!Array.isArray(medallas) || medallas.length === 0) return ["La lista de medallas está vacía."];
  const claves = new Set<string>();
  const nombres = new Set<string>();
  for (const m of medallas) {
    const quien = `Medalla ${m.clave ?? "sin clave"}`;
    if (!esTexto(m.clave) || !/^[a-z0-9_]+$/.test(m.clave)) errores.push(`${quien}: la clave usa minúsculas, números y _.`);
    if (claves.has(m.clave)) errores.push(`${quien}: clave repetida.`);
    claves.add(m.clave);
    // medallas.nombre es UNIQUE en la base.
    if (!esTexto(m.nombre)) errores.push(`${quien}: falta el nombre.`);
    else if (nombres.has(m.nombre)) errores.push(`${quien}: el nombre «${m.nombre}» ya lo usa otra medalla.`);
    nombres.add(m.nombre);
    if (!GRUPOS_DE_MEDALLA.includes(m.grupo)) errores.push(`${quien}: «grupo» debe ser ${GRUPOS_DE_MEDALLA.join(" o ")}.`);
    if (!MEDIDAS_DE_MEDALLA.includes(m.mide)) {
      errores.push(`${quien}: «mide» debe ser ${MEDIDAS_DE_MEDALLA.join(", ")}. Una medida nueva necesita su cálculo en el código.`);
    }
    if (typeof m.activa !== "boolean") errores.push(`${quien}: activa debe ser true o false.`);
    if (!esTexto(m.descripcion)) errores.push(`${quien}: falta la descripción.`);
    if (!Array.isArray(m.niveles) || m.niveles.length === 0) {
      errores.push(`${quien}: necesita al menos un nivel.`);
      continue;
    }
    m.niveles.forEach((n, i) => {
      if (!esTexto(n?.nombre)) errores.push(`${quien}, nivel ${i + 1}: falta el nombre.`);
      if (!esEntero(n?.umbral, 1)) errores.push(`${quien}, nivel ${i + 1}: el umbral debe ser un entero mayor que 0.`);
      else if (i > 0 && n.umbral <= m.niveles[i - 1].umbral) {
        errores.push(`${quien}, nivel ${i + 1}: el umbral debe ser mayor que el del nivel ${i}.`);
      }
    });
  }
  return errores;
}

export const MEDALLAS_DEL_CATALOGO = datosDeMedallas.medallas as MedallaDelCatalogo[];
export const RANGOS_DEL_CATALOGO = datosDeRangos.rangos as RangoDelCatalogo[];
export const MISIONES_DEL_CATALOGO = datosDeMisiones.misiones as MisionDelCatalogo[];
/** Cuántas misiones salen al azar en cada periodo. */
export const SELECCION_DE_MISIONES = datosDeMisiones.seleccion as SeleccionDelCatalogo;
