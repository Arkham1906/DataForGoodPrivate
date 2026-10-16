// Quién pausó una campaña y por qué (columnas campanas.pausa_por, pausa_motivo y pausada_en).
// Sin imports de servidor: lo usan los route handlers y las pantallas cliente.
// El creador pausa sin motivo desde /mis-campanas; la supervisión (el supervisor de la campaña o
// el SuperUsuario) pausa con motivo obligatorio desde /supervision o /supervisar (2026-10-15).
// Reglas en lib/supervision/estado-por-supervision.ts.

export type PausaDeCampana = {
  por: "creador" | "supervision";
  motivo: string | null;
  /** ISO, o null en campañas pausadas antes del 2026-10-15. */
  en: string | null;
};

/** Hasta cuántos caracteres admite el motivo de pausar o finalizar desde la supervisión. */
export const MAXIMO_MOTIVO_DE_SUPERVISION = 500;

/** La pausa de una fila de `campanas`, o null si no está pausada. */
export function pausaDesdeFila(row: Record<string, unknown>): PausaDeCampana | null {
  if (String(row.status ?? "") !== "pausada") return null;
  const en = row.pausada_en ? new Date(row.pausada_en as string) : null;
  return {
    por: row.pausa_por === "supervision" ? "supervision" : "creador",
    motivo: row.pausa_motivo ? String(row.pausa_motivo) : null,
    en: en && !Number.isNaN(en.getTime()) ? en.toISOString() : null,
  };
}

/** Aviso para quien quiere aportar a una campaña pausada. */
export function avisoDePausa(pausa: PausaDeCampana | null | undefined, despues: string): string {
  if (pausa?.por === "supervision") {
    // Sin el punto final del motivo, para no repetirlo ("corregirla.. Podrás").
    const motivo = pausa.motivo?.trim().replace(/[.\s]+$/, "");
    return `La supervisión de DataForGood pausó esta campaña${motivo ? `: ${motivo}` : ""}. ${despues}`;
  }
  return `Quien organiza esta campaña la pausó. ${despues}`;
}
