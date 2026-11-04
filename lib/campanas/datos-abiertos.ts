// Decisión de datos abiertos de una campaña terminada (2026-11-04, a pedido del usuario): ninguna se publica
// sola; su supervisor o el SuperUsuario deciden según los aportes que juntó. Tabla campana_datos_abiertos; sin fila cuenta como pendiente. Una campaña que se reactiva
// pierde la decisión y se vuelve a decidir al terminar. Reglas en lib/supervision/datos-abiertos.ts.
// Sin imports de servidor: lo usan los route handlers y las pantallas cliente.

import { estaTerminada } from "@/lib/campanas/terminada";

export type EstadoDeDatosAbiertos = "pendiente" | "publicada" | "no_publicada";

export type DatosAbiertosDeCampana = {
  estado: EstadoDeDatosAbiertos;
  /** Por qué no se publicó. */
  motivo: string | null;
  /** ISO: cuándo se decidió; null si sigue pendiente. */
  en: string | null;
};

/** Largo máximo del motivo de no publicar. */
export const MAXIMO_MOTIVO_DE_DATOS_ABIERTOS = 500;

/** Condición SQL de "esta campaña está publicada en datos abiertos" (alias de la tabla campanas). */
export function sqlDatosPublicados(alias = "c"): string {
  return `(${alias}.status = 'finalizada' AND EXISTS (
            SELECT 1 FROM campana_datos_abiertos d_a WHERE d_a.campana_id = ${alias}.id AND d_a.estado = 'publicada'))`;
}

/** La decisión de una fila de `campanas` (columnasCalculadas), o null si la campaña no ha terminado. */
export function datosAbiertosDesdeFila(row: Record<string, unknown>): DatosAbiertosDeCampana | null {
  if (!estaTerminada(String(row.status ?? ""))) return null;
  const estado = row.datos_abiertos_estado;
  const en = row.datos_abiertos_en ? new Date(row.datos_abiertos_en as string) : null;
  return {
    estado: estado === "publicada" || estado === "no_publicada" ? estado : "pendiente",
    motivo: row.datos_abiertos_motivo ? String(row.datos_abiertos_motivo) : null,
    en: en && !Number.isNaN(en.getTime()) ? en.toISOString() : null,
  };
}

/** Lo que ve el creador en su tarjeta. */
export function textoDeDatosAbiertos(datos: DatosAbiertosDeCampana): string {
  if (datos.estado === "publicada") return "Datos abiertos: publicados.";
  if (datos.estado === "no_publicada") return `Datos abiertos: no se publicaron. Motivo: ${datos.motivo || "sin motivo registrado"}`;
  return "Datos abiertos: la supervisión está por decidir si se publican.";
}
