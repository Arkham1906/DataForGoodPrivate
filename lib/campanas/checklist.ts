// Checklists de una campaña: lo que el participante marca además de la
// descripción (que siempre es obligatoria y es el "texto libre"). Lo usan el
// formulario de campaña, la pantalla de aportar y la API, así que no
// importa nada de servidor.
//
// Checklists por tipo de dato (2026-10-28, a pedido del usuario): cada checklist pertenece a uno de
// los tipos que pide la campaña (foto, video...) y un tipo puede tener varios. Quien aporta solo ve
// los del tipo de su archivo. Los de campañas anteriores no tienen `tipo` y valen para todos.

import { tipoPorNombre, type TipoDeArchivo } from "@/lib/aportes/archivo";

const TIPOS_DE_CHECKLIST: readonly TipoDeArchivo[] = ["foto", "video", "audio", "documento", "texto"];

export type SeccionDeChecklist = {
  titulo: string;
  opciones: string[];
  /** Tipo de dato al que pertenece; sin él (campañas anteriores al 2026-10-28) vale para todos. */
  tipo?: TipoDeArchivo;
};

function tipoDeSeccion(valor: unknown): TipoDeArchivo | undefined {
  return TIPOS_DE_CHECKLIST.find((t) => t === valor);
}

/** Los checklists que ve quien manda un aporte de `tipo`: los de ese tipo y los generales. */
export function seccionesDelTipo(secciones: SeccionDeChecklist[], tipo: string | null | undefined): SeccionDeChecklist[] {
  return secciones.filter((s) => !s.tipo || s.tipo === tipo);
}

// Topes técnicos para que un cuerpo malicioso no guarde miles de filas; en
// la práctica el creador agrega los que necesite.
export const MAX_SECCIONES = 50;
export const MAX_OPCIONES_POR_SECCION = 50;
export const MAX_LARGO_TEXTO = 120;

/**
 * Valida lo que manda el formulario. Quita espacios, opciones vacías o
 * repetidas y secciones sin opciones. Devuelve un error si un checklist con
 * opciones no tiene título, o si dos checklists que ve el mismo aporte tienen
 * el mismo título (las respuestas se guardan como "Título: opción"): en el mismo
 * tipo, o uno general y otro de cualquier tipo. Con `tiposDeLaCampana`, quita los
 * checklists de tipos que la campaña ya no pide.
 */
export function normalizarSecciones(
  input: unknown,
  tiposDeLaCampana?: unknown
): { ok: true; secciones: SeccionDeChecklist[] } | { ok: false; error: string } {
  if (input == null) return { ok: true, secciones: [] };
  if (!Array.isArray(input)) return { ok: false, error: "checklistSecciones debe ser una lista" };
  if (input.length > MAX_SECCIONES) {
    return { ok: false, error: `Puedes agregar hasta ${MAX_SECCIONES} checklists` };
  }

  const pedidos = Array.isArray(tiposDeLaCampana) ? tiposDeLaCampana.map(String) : null;
  const secciones: SeccionDeChecklist[] = [];
  for (const raw of input) {
    const tipoCrudo = (raw as { tipo?: unknown })?.tipo;
    const tipo = tipoDeSeccion(tipoCrudo);
    if (tipoCrudo != null && tipoCrudo !== "" && !tipo) return { ok: false, error: "Un checklist tiene un tipo de dato que no existe" };
    if (tipo && pedidos && !pedidos.includes(tipo)) continue;
    const titulo = String((raw as { titulo?: unknown })?.titulo ?? "").trim();
    const crudas = (raw as { opciones?: unknown })?.opciones;
    const opciones = Array.from(
      new Set((Array.isArray(crudas) ? crudas : []).map((o) => String(o ?? "").trim()).filter(Boolean))
    );
    if (opciones.length === 0) continue;

    if (!titulo) return { ok: false, error: "Cada checklist necesita un título" };
    if (titulo.length > MAX_LARGO_TEXTO || opciones.some((o) => o.length > MAX_LARGO_TEXTO)) {
      return { ok: false, error: `Títulos y opciones pueden tener hasta ${MAX_LARGO_TEXTO} caracteres` };
    }
    if (opciones.length > MAX_OPCIONES_POR_SECCION) {
      return { ok: false, error: `Cada checklist puede tener hasta ${MAX_OPCIONES_POR_SECCION} opciones` };
    }
    const clave = titulo.toLowerCase();
    const choca = secciones.some((s) => s.titulo.toLowerCase() === clave && (!s.tipo || !tipo || s.tipo === tipo));
    if (choca) return { ok: false, error: `Hay dos checklists con el título "${titulo}"` };

    secciones.push(tipo ? { titulo, opciones, tipo } : { titulo, opciones });
  }
  return { ok: true, secciones };
}

/**
 * Checklists guardados en una fila de `campanas`. Las campañas anteriores a
 * las secciones solo tienen `checklist_opciones` (una lista plana): se leen
 * como un único checklist sin título. Con `data_types` en la fila, los checklists
 * de un tipo que la campaña ya no pide no salen.
 */
export function seccionesDesdeFila(row: {
  checklist_secciones?: unknown;
  checklist_opciones?: unknown;
  collection_mode?: unknown;
  data_types?: unknown;
}): SeccionDeChecklist[] {
  if (Array.isArray(row.checklist_secciones) && row.checklist_secciones.length > 0) {
    const pedidos = Array.isArray(row.data_types) && row.data_types.length > 0 ? row.data_types.map(String) : null;
    return row.checklist_secciones
      .map((s) => {
        const tipo = tipoDeSeccion((s as SeccionDeChecklist)?.tipo);
        const seccion: SeccionDeChecklist = {
          titulo: String((s as SeccionDeChecklist)?.titulo ?? ""),
          opciones: Array.isArray((s as SeccionDeChecklist)?.opciones) ? (s as SeccionDeChecklist).opciones.map(String) : [],
        };
        return tipo ? { ...seccion, tipo } : seccion;
      })
      .filter((s) => s.opciones.length > 0 && (!s.tipo || !pedidos || pedidos.includes(s.tipo)));
  }
  const legado = Array.isArray(row.checklist_opciones) ? row.checklist_opciones.map(String) : [];
  if (String(row.collection_mode ?? "checklist") === "texto_libre" || legado.length === 0) return [];
  return [{ titulo: "", opciones: legado }];
}

/** Cómo se guarda una respuesta en `aportes.caracteristicas`: "Estado del árbol: Sano". */
export function etiquetaDeRespuesta(titulo: string, opcion: string): string {
  return titulo ? `${titulo}: ${opcion}` : opcion;
}

/** Filtra lo que mandó el participante a las opciones que existen en la campaña. */
export function respuestasValidas(valores: string[], secciones: SeccionDeChecklist[]): string[] {
  const permitidas = new Set(secciones.flatMap((s) => s.opciones.map((o) => etiquetaDeRespuesta(s.titulo, o))));
  return Array.from(new Set(valores.filter((v) => permitidas.has(v))));
}

/**
 * Checklists que se muestran en el formulario de aportar según lo elegido (2026-10-28). Con archivo,
 * los del tipo que dice su nombre; sin archivo, los de "texto" si la campaña lo acepta (va sin
 * archivo) o los del único tipo que pide. Si aún no se sabe el tipo, solo los generales, y
 * `faltaArchivo` dice que al elegirlo aparecerán más. El servidor vuelve a filtrar con el tipo real.
 */
export function seccionesParaElAporte(
  secciones: SeccionDeChecklist[],
  tipos: TipoDeArchivo[],
  archivo: { name: string; type: string } | null,
): { visibles: SeccionDeChecklist[]; faltaArchivo: boolean } {
  const tipo = archivo ? tipoPorNombre(archivo) : tipos.includes("texto") ? "texto" : tipos.length === 1 ? tipos[0] : null;
  if (tipo) return { visibles: seccionesDelTipo(secciones, tipo), faltaArchivo: false };
  return { visibles: secciones.filter((s) => !s.tipo), faltaArchivo: secciones.some((s) => s.tipo) };
}
