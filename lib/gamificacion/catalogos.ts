// Catálogos en JSON (2026-11-04): lib/datos/rangos.json, lib/datos/misiones.json, lib/datos/medallas.json y
// lib/datos/enfoques.json son la fuente de los rangos, las misiones, las medallas y los enfoques. Para cambiarlos basta editar el
// JSON y volver a construir la app: al arrancar, ensureGamificacion() los valida y los copia a sus tablas. Con un
// error, se registra en el log y las tablas se quedan como estaban. Aquí solo se valida; no hay imports de servidor.

import datosDeEnfoques from "@/lib/datos/enfoques.json";
import datosDeMedallas from "@/lib/datos/medallas.json";
import datosDeMisiones from "@/lib/datos/misiones.json";
import datosDeRangos from "@/lib/datos/rangos.json";
import { GRUPOS_DE_MEDALLA, MEDIDAS_DE_MEDALLA, type GrupoDeMedalla, type MedidaDeMedalla } from "./medallas";
import {
  MEDIDAS_DE_MISION,
  OBJETOS_DE_MISION,
  TIPOS_DE_APORTE,
  cuandoCuenta,
  type CondicionDeMision,
  type Dificultad,
  type ObjetoDeMision,
  type Periodicidad,
  type PeriodicidadSorteada,
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
  /** Sin el campo: normal. Las difíciles son semanales y su recompensa es «sorteo» (RF-GAM-44, decisión del 19 nov). */
  dificultad?: Dificultad;
};

/** Reglas de las misiones difíciles (misiones.json, «dificiles»). */
export type DificilesDelCatalogo = { maximoPorPeriodo: number; pesosDelSorteo: Record<ObjetoDeMision, number> };

/** Las de inicio no se sortean: salen todas (RF-GAM-103). */
export type SeleccionDelCatalogo = Record<PeriodicidadSorteada, number>;

export type MedallaDelCatalogo = {
  /** Identifica la medalla para siempre: el historial de quien la ganó cuelga de ella. No se cambia. */
  clave: string;
  nombre: string;
  grupo: GrupoDeMedalla;
  mide: MedidaDeMedalla;
  activa: boolean;
  descripcion: string;
  niveles: { nombre: string; umbral: number; ilustracion?: string }[];
};

/** Un enfoque (RF-GAM-121). Su orden en pantalla es el del JSON. */
export type EnfoqueDelCatalogo = {
  /** Identifica el enfoque para siempre: usuarios.enfoque y su historial cuelgan de ella. No se cambia. */
  clave: string;
  nombre: string;
  subtitulo: string;
  descripcion: string;
  /** Uno inactivo no se puede elegir; quien ya lo tiene lo conserva hasta elegir otro. */
  activo: boolean;
};

export type EnfoquesDelCatalogo = { esperaParaCambiarDias: number; enfoques: EnfoqueDelCatalogo[] };

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

export function erroresDeMisiones(
  misiones: MisionDelCatalogo[],
  seleccion: SeleccionDelCatalogo = SELECCION_DE_MISIONES,
  dificiles: DificilesDelCatalogo = DIFICILES_DEL_CATALOGO,
): string[] {
  const errores: string[] = [];
  if (!Array.isArray(misiones)) return ["«misiones» debe ser una lista."];
  if (!esEntero(dificiles?.maximoPorPeriodo, 0)) errores.push("dificiles.maximoPorPeriodo debe ser un entero de 0 en adelante.");
  const pesos = dificiles?.pesosDelSorteo;
  if (!pesos || !OBJETOS_DE_MISION.every((o) => esEntero(pesos[o], 0)) || OBJETOS_DE_MISION.every((o) => pesos[o] === 0)) {
    errores.push(`dificiles.pesosDelSorteo lleva un entero de 0 en adelante para ${OBJETOS_DE_MISION.join(" y ")}, y no todos en 0.`);
  }
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
    if (!["diaria", "semanal", "inicio"].includes(m.periodicidad)) errores.push(`${quien}: periodicidad debe ser diaria, semanal o inicio.`);
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
    const r = m.recompensa;
    const recompensaValida =
      !r ||
      (r.tipo === "exp" && esEntero(r.cantidad, 1)) ||
      r.tipo === "sorteo" ||
      (OBJETOS_DE_MISION as readonly string[]).includes(r.tipo);
    if (!recompensaValida) {
      errores.push(`${quien}: la recompensa se omite o es { "tipo": "exp", "cantidad": entero mayor que 0 }, { "tipo": "sorteo" }, o un objeto (${OBJETOS_DE_MISION.join(", ")}).`);
    }
    if (m.dificultad !== undefined && m.dificultad !== "normal" && m.dificultad !== "dificil") {
      errores.push(`${quien}: dificultad debe ser normal o dificil.`);
    }
    if (m.dificultad === "dificil" && m.periodicidad !== "semanal") errores.push(`${quien}: solo las semanales pueden ser difíciles.`);
    if ((m.dificultad === "dificil") !== (r?.tipo === "sorteo")) {
      errores.push(`${quien}: una misión difícil tiene recompensa { "tipo": "sorteo" }, y solo ella.`);
    }
    // El nombre dice cuándo cuenta (RF-GAM-43, RN-GAM-40): no puede contradecir la condición.
    if (c && MEDIDAS_DE_MISION.includes(c.mide)) {
      const cuenta = cuandoCuenta(c);
      if (cuenta === "envio" && /^Logra\b/.test(m.nombre)) errores.push(`${quien}: empieza con «Logra» pero cuenta al enviar.`);
      if (cuenta === "aceptacion" && /^Env[ií]a\b/.test(m.nombre)) errores.push(`${quien}: empieza con «Envía» pero cuenta al aceptarse.`);
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
      if (n?.ilustracion !== undefined && !/^[a-z0-9-]+$/.test(String(n.ilustracion))) {
        errores.push(`${quien}, nivel ${i + 1}: «ilustracion» es el nombre del archivo sin «@lado.webp» (minúsculas, números y -).`);
      }
    });
  }
  return errores;
}

export function erroresDeEnfoques(datos: EnfoquesDelCatalogo): string[] {
  const errores: string[] = [];
  if (!esEntero(datos?.esperaParaCambiarDias, 0)) errores.push("esperaParaCambiarDias debe ser un entero de 0 en adelante.");
  const enfoques = datos?.enfoques;
  if (!Array.isArray(enfoques) || enfoques.length === 0) return [...errores, "La lista de enfoques está vacía."];
  const claves = new Set<string>();
  for (const e of enfoques) {
    const quien = `Enfoque ${e.clave ?? "sin clave"}`;
    // enfoques.clave es VARCHAR(30).
    if (!esTexto(e.clave) || !/^[a-z0-9_]{1,30}$/.test(e.clave)) errores.push(`${quien}: la clave usa minúsculas, números y _ (hasta 30).`);
    if (claves.has(e.clave)) errores.push(`${quien}: clave repetida.`);
    claves.add(e.clave);
    if (!esTexto(e.nombre)) errores.push(`${quien}: falta el nombre.`);
    if (!esTexto(e.subtitulo)) errores.push(`${quien}: falta el subtítulo.`);
    if (!esTexto(e.descripcion)) errores.push(`${quien}: falta la descripción.`);
    if (typeof e.activo !== "boolean") errores.push(`${quien}: activo debe ser true o false.`);
  }
  if (!enfoques.some((e) => e.activo === true)) errores.push("Debe quedar al menos un enfoque activo.");
  return errores;
}

export const ENFOQUES_DEL_CATALOGO = datosDeEnfoques as EnfoquesDelCatalogo;
export const MEDALLAS_DEL_CATALOGO = datosDeMedallas.medallas as MedallaDelCatalogo[];
export const RANGOS_DEL_CATALOGO = datosDeRangos.rangos as RangoDelCatalogo[];
export const MISIONES_DEL_CATALOGO = datosDeMisiones.misiones as MisionDelCatalogo[];
/** Cuántas misiones salen al azar en cada periodo. */
export const SELECCION_DE_MISIONES = datosDeMisiones.seleccion as SeleccionDelCatalogo;
/** Cuántas difíciles caben en un periodo y cómo se sortea su objeto. */
export const DIFICILES_DEL_CATALOGO = datosDeMisiones.dificiles as DificilesDelCatalogo;
