// Rangos de la trayectoria (2026-11-02; SRS v1.1: RF-GAM-16, 22, 78 a 81; tabla 4.3). Tipos y ayudantes
// puros que comparten el servidor (lib/gamificacion/progreso.ts) y los componentes de components/gamificacion.
// Sin imports de servidor (nada de `pg`): lo importa un componente cliente.
//
// Los requisitos de cada rango NO se escriben aquí: salen de la tabla `rangos` (RNF-GAM-05) y esto solo los
// interpreta. Lo que la persona ve de cada rango lo decide el servidor al armar las fichas (RF-GAM-78,
// RNF-GAM-14): los tipos de ficha hacen imposible que un rango «avistado» lleve nombre, descripción o etapa.

import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";

export type ClaveDeRequisito = "exp" | "aportes" | "excelentes" | "excepcionales" | "racha" | "misiones";

/** Los seis requisitos, en el orden de la tabla 4.3. */
export const CLAVES_DE_REQUISITO: readonly ClaveDeRequisito[] = [
  "exp",
  "aportes",
  "excelentes",
  "excepcionales",
  "racha",
  "misiones",
];

export type ValoresPorRequisito = Record<ClaveDeRequisito, number>;

/** Textos de cada requisito: etiqueta de tabla, plural para la pista y «uno nuevo» para su primera aparición. */
const TEXTOS: Record<ClaveDeRequisito, { etiqueta: string; plural: string; nuevo: string }> = {
  exp: { etiqueta: "EXP", plural: "EXP", nuevo: "EXP" },
  aportes: { etiqueta: "Aportes aceptados", plural: "aportes aceptados", nuevo: "un aporte aceptado" },
  // Nombres de la v1.2 (2026-11-04: RF-GAM-99). La clave y la columna siguen siendo `excelentes` hasta su migración.
  excelentes: {
    etiqueta: "Sobresalientes o superiores (4★ o más)",
    plural: "aportes de 4★ o más",
    nuevo: "un aporte de 4★ o más",
  },
  excepcionales: {
    etiqueta: "Excepcionales (5★)",
    plural: "aportes excepcionales (5★)",
    nuevo: "un aporte excepcional (5★)",
  },
  racha: { etiqueta: "Racha actual", plural: "días de racha", nuevo: "una racha de días seguidos" },
  misiones: { etiqueta: "Misiones completadas", plural: "misiones completadas", nuevo: "una misión completada" },
};

/** Etiquetas cortas de cada requisito, para el bloque de rango de /progreso. */
export const ETIQUETAS_CORTAS: Record<ClaveDeRequisito, string> = {
  exp: "EXP",
  aportes: "Aportes",
  excelentes: "4★ o más",
  excepcionales: "5★",
  racha: "Racha",
  misiones: "Misiones",
};

const nf = new Intl.NumberFormat("es-MX");

/** «Aplicado» de «Investigador Aplicado»: la parte que cabe en el camino de rangos. */
export function nombreCortoDeRango(nombre: string): string {
  return nombre.replace(/^Investigador\s+/, "");
}

/** Estado de un rango respecto al rango actual de la persona (RF-GAM-78). */
export type EstadoDeRango = "alcanzado" | "actual" | "siguiente" | "avistado" | "oculto";

export function estadoDeRango(numero: number, actual: number): EstadoDeRango {
  if (numero < actual) return "alcanzado";
  if (numero === actual) return "actual";
  if (numero === actual + 1) return "siguiente";
  if (numero === actual + 2) return "avistado";
  return "oculto";
}

/** «210 EXP», «4 días», «17». */
export function textoDeMeta(clave: ClaveDeRequisito, valor: number): string {
  if (clave === "exp") return `${nf.format(valor)} EXP`;
  if (clave === "racha") return `${nf.format(valor)} ${valor === 1 ? "día" : "días"}`;
  return nf.format(valor);
}

/** Lo que pide un rango en un requisito (sin avance: para el rango que se alcanzó y para el avistado). */
export type RequisitoDeRango = {
  clave: ClaveDeRequisito;
  etiqueta: string;
  meta: number;
  textoMeta: string;
};

/** Lo que pide el rango siguiente, con lo que la persona lleva. */
export type AvanceDeRequisito = RequisitoDeRango & {
  actual: number;
  cumplido: boolean;
  faltan: number;
  /** 0 a 100. */
  porcentaje: number;
  /** «Cumplido» o «120 de 210 EXP». */
  textoAvance: string;
};

/** Solo los requisitos que el rango pide (los de valor 0 no cuentan: RF-GAM-18). */
export function requisitosDeRango(requisitos: ValoresPorRequisito): RequisitoDeRango[] {
  return CLAVES_DE_REQUISITO.filter((clave) => requisitos[clave] > 0).map((clave) => ({
    clave,
    etiqueta: TEXTOS[clave].etiqueta,
    meta: requisitos[clave],
    textoMeta: textoDeMeta(clave, requisitos[clave]),
  }));
}

export function avanceDeRequisitos(requisitos: ValoresPorRequisito, progreso: ValoresPorRequisito): AvanceDeRequisito[] {
  return requisitosDeRango(requisitos).map((r) => {
    const actual = progreso[r.clave];
    const cumplido = actual >= r.meta;
    return {
      ...r,
      actual,
      cumplido,
      faltan: Math.max(0, r.meta - actual),
      porcentaje: Math.min(100, Math.round((actual / r.meta) * 100)),
      textoAvance: cumplido ? "Cumplido" : `${nf.format(actual)} de ${textoDeMeta(r.clave, r.meta)}`,
    };
  });
}

/** «a», «a y b», «a, b y c». */
function unirConY(lista: string[]): string {
  if (lista.length <= 1) return lista.join("");
  return `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
}

/** Lo que falta en un requisito, con su plural: «1 aporte aceptado», «3 aportes de 4★ o más», «2 días de racha». */
function frase(clave: ClaveDeRequisito, faltan: number): string {
  const uno = faltan === 1;
  switch (clave) {
    case "exp":
      return `${nf.format(faltan)} EXP`;
    case "aportes":
      return `${faltan} ${uno ? "aporte aceptado" : "aportes aceptados"}`;
    case "excelentes":
      return `${faltan} ${uno ? "aporte" : "aportes"} de 4★ o más`;
    case "excepcionales":
      return `${faltan} ${uno ? "aporte" : "aportes"} de 5★`;
    case "racha":
      return `${faltan} ${uno ? "día de racha" : "días de racha"}`;
    case "misiones":
      return `${faltan} ${uno ? "misión" : "misiones"}`;
  }
}

/** «Te faltan 33 EXP y 2 aportes de 4★ o más.» (RF-GAM-22). Con todo cumplido, avisa que el ascenso se registra solo. */
export function textoQueFalta(avances: AvanceDeRequisito[]): string {
  const pendientes = avances.filter((a) => !a.cumplido);
  if (pendientes.length === 0) {
    return "Ya cumples todo: el ascenso se registra en cuanto el sistema lo compruebe.";
  }
  const plural = pendientes.length > 1 || pendientes[0].faltan !== 1;
  return `${plural ? "Te faltan" : "Te falta"} ${unirConY(pendientes.map((a) => frase(a.clave, a.faltan)))}.`;
}

/**
 * Pista del rango avistado (RF-GAM-79): el requisito que más crece, en proporción, respecto al rango anterior.
 * Si ese requisito aparece por primera vez, lo dice. Solo el rango avistado tiene pista; ningún otro rango oculto.
 */
export function pistaDelRango(rango: ValoresPorRequisito, anterior: ValoresPorRequisito): string {
  let mejor: ClaveDeRequisito | null = null;
  let crecimiento = 0;
  for (const clave of CLAVES_DE_REQUISITO) {
    const antes = anterior[clave];
    const ahora = rango[clave];
    const puntaje = antes === 0 ? (ahora > 0 ? Number.POSITIVE_INFINITY : 0) : ahora / antes;
    if (puntaje > crecimiento && puntaje > 1) {
      crecimiento = puntaje;
      mejor = clave;
    }
  }
  if (!mejor) return "Pedirá lo mismo que el rango anterior.";
  if (crecimiento === Number.POSITIVE_INFINITY) return `Es el primero que pide ${TEXTOS[mejor].nuevo}.`;
  return `Pedirá ${nf.format(rango[mejor])} ${TEXTOS[mejor].plural}.`;
}

// ---------------------------------------------------------------------------------------------------
// Fichas de rango (RF-GAM-78): lo que el servidor envía de cada rango según su posición.
// ---------------------------------------------------------------------------------------------------

/** Rango actual: se ve todo, incluido lo que pidió y cuándo se alcanzó. */
export type FichaDeRangoActual = {
  estado: "actual";
  numero: number;
  nombre: string;
  descripcion: string | null;
  etapaDelAvatar: number;
  requisitos: RequisitoDeRango[];
  /** «Alcanzado el 21 oct, 11 días después del rango 8.» */
  textoDeAscenso: string;
};

/** Rango ya alcanzado: lo mismo que el actual (RF-GAM-78 a, 83). */
export type FichaDeRangoAlcanzado = Omit<FichaDeRangoActual, "estado"> & { estado: "alcanzado" };

/** Rango siguiente: nombre y descripción visibles; requisitos con avance y lo que se recibirá. */
export type FichaDeRangoSiguiente = {
  estado: "siguiente";
  numero: number;
  nombre: string;
  descripcion: string | null;
  etapaDelAvatar: number;
  requisitos: AvanceDeRequisito[];
  cumplidos: number;
  textoQueFalta: string;
};

/**
 * Rango avistado: solo número, pista y requisitos. Sin nombre, descripción, etapa ni recompensas (RF-GAM-78 c,
 * RNF-GAM-14): esos datos no salen del servidor.
 */
export type FichaDeRangoAvistado = {
  estado: "avistado";
  numero: number;
  pista: string;
  requisitos: RequisitoDeRango[];
};

/** Rango por descubrir: solo número y requisitos (RF-GAM-78 d, 80). Los demás datos no salen del servidor. */
export type FichaDeRangoOculto = {
  estado: "oculto";
  numero: number;
  requisitos: RequisitoDeRango[];
};

export type FichaDeRango =
  | FichaDeRangoAlcanzado
  | FichaDeRangoActual
  | FichaDeRangoSiguiente
  | FichaDeRangoAvistado
  | FichaDeRangoOculto;

// ---------------------------------------------------------------------------------------------------
// Fecha del ascenso (RF-GAM-83), en la zona de las campañas (Tepic).
// ---------------------------------------------------------------------------------------------------

const FECHA_CORTA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: ZONA_DE_CAMPANAS });
const DIA_EN_ZONA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_DE_CAMPANAS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

/** «21 oct»; texto vacío sin fecha registrada: no se inventa. */
export function fechaCortaDeAscenso(fecha: Date | null): string {
  return fecha ? FECHA_CORTA.format(fecha) : "";
}

/**
 * «Alcanzado el 21 oct, 11 días después del rango 8.» El rango 1 se tiene desde que se crea la cuenta (RF-GAM-17).
 * Sin fecha registrada devuelve un texto vacío: no se inventa.
 */
export function textoDeAscenso(
  numero: number,
  alcanzadoEn: Date | null,
  anteriorEn: Date | null,
  ahora: Date = new Date(),
): string {
  if (numero <= 1) return "Alcanzado al crear tu cuenta.";
  if (!alcanzadoEn) return "";
  const dia = DIA_EN_ZONA.format(alcanzadoEn);
  const cuando = dia === DIA_EN_ZONA.format(ahora) ? "hoy" : `el ${FECHA_CORTA.format(alcanzadoEn)}`;
  if (!anteriorEn) return `Alcanzado ${cuando}.`;
  const dias = diasEntre(DIA_EN_ZONA.format(anteriorEn), dia);
  const despues =
    dias <= 0 ? `el mismo día que el rango ${numero - 1}` : `${dias} ${dias === 1 ? "día" : "días"} después del rango ${numero - 1}`;
  return `Alcanzado ${cuando}, ${despues}.`;
}
