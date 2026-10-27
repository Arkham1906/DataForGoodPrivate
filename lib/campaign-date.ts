// Fechas de campaña (DATE + TIME separados) y transiciones automáticas de estado, sin cron:
// activateScheduledCampaigns (aceptada → activa) y finalizeExpiredCampaigns (activa → finalizada)
// se ejecutan en cada lectura de /api/campanas y avisan al creador (campana_iniciada, campana_finalizada).
//
// La fecha y hora que escribe el creador son hora de pared de Tepic (sin zona). "Ahora" y
// "hoy" se calculan siempre en ZONA_DE_CAMPANAS, no con la zona del proceso: dentro de
// Docker el proceso corre en UTC, y una campaña de 15:00 a 20:00 se finalizaba al aceptarla
// porque a las 12:00 de Tepic el servidor ya veía las 19:00 (2026-10-07).

import { pool } from "@/lib/db";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { ahoraEnZona, fechaDDMMAAAA } from "@/lib/fecha-de-tepic";

// Viven en lib/fecha-de-tepic.ts para que el navegador también las use.
export { ZONA_DE_CAMPANAS, ahoraEnZona, hoyEnTepic, errorDeInicioPasado, errorDeFinAntesDeInicio } from "@/lib/fecha-de-tepic";

/** Milisegundos de "ahora" como hora de pared de Tepic, comparables con campaignMoment(). */
function ahoraDePared(): number {
  const a = ahoraEnZona();
  return Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute, a.second);
}

/**
 * Convierte fechas de campaña a una fecha de calendario, sin aplicar UTC.
 * PostgreSQL puede entregar una columna DATE como Date; convertirla
 * directamente con `String(value).slice(0, 10)` produce textos como
 * "Tue Sep 22", que no son ISO y terminan mostrando 0 días restantes.
 */
function dateOnlyFromParts(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function normalizeCampaignDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dateOnlyFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return dateOnlyFromParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // Compatibilidad con registros existentes que el driver devolvió como
  // "Tue Sep 22 2026 ...". La respuesta pública siempre vuelve a ser ISO.
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateOnlyFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

const DEFAULT_TIME = "00:00";

/**
 * Normaliza "HH:MM" o "HH:MM:SS[.ffffff]" (Postgres TIME, con fracción de
 * segundo cuando el valor viene de una expresión como CURRENT_TIME) a
 * "HH:MM"; null si falta o es inválida.
 */
export function normalizeCampaignTime(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

/**
 * Fecha + hora de una campaña como milisegundos de hora de pared (Date.UTC con
 * los números tal cual), comparables con ahoraDePared(). Sin hora, se asume
 * "00:00" para que una campaña sin hora definida se comporte exactamente como
 * antes de agregar start_time/end_time: activa o finaliza en cuanto empieza
 * ese día de calendario.
 */
function campaignMoment(dateValue: unknown, timeValue: unknown): number | null {
  const dateOnly = normalizeCampaignDate(dateValue);
  if (!dateOnly) return null;

  const time = normalizeCampaignTime(timeValue) ?? DEFAULT_TIME;
  const [year, month, day] = dateOnly.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * true si la fecha/hora dada ya pasó en Tepic (o no tiene fecha definida). No
 * usa NOW() de Postgres ni la zona del proceso: las dos son UTC en Docker.
 */
function hasMomentPassed(dateValue: unknown, timeValue?: unknown): boolean {
  const moment = campaignMoment(dateValue, timeValue);
  if (moment === null) return true;
  return moment <= ahoraDePared();
}

/** true si la fecha/hora de inicio ya llegó (o no tiene fecha definida). */
export function hasCampaignStarted(dateValue: unknown, timeValue?: unknown): boolean {
  return hasMomentPassed(dateValue, timeValue);
}

/**
 * true si la fecha/hora de fin ya pasó. Se usa al reactivar una campaña
 * finalizada: si la fecha de fin (nueva o la que ya tenía) sigue en el
 * pasado, finalizeExpiredCampaigns la volvería a cerrar en la siguiente
 * lectura de /api/campanas, así que hay que exigir una fecha futura.
 */
export function hasCampaignEnded(dateValue: unknown, timeValue?: unknown): boolean {
  return hasMomentPassed(dateValue, timeValue);
}

/**
 * Mensaje si una campaña pausada todavía no llega a su inicio (2026-10-23): editándola en pausa
 * se puede mover el inicio al futuro, y reanudarla la dejaría activa antes de empezar. Lo usan
 * el creador (PATCH /api/campanas/[id]) y la supervisión (lib/supervision/estado-por-supervision.ts).
 */
export function errorDeReanudarAntesDeInicio(dateValue: unknown, timeValue?: unknown): string | null {
  if (hasCampaignStarted(dateValue, timeValue)) return null;
  const fecha = fechaDDMMAAAA(normalizeCampaignDate(dateValue) ?? "");
  const hora = normalizeCampaignTime(timeValue);
  return `La campaña empieza el ${fecha}${hora ? ` a las ${hora.slice(0, 5)}` : ""}: no se puede reanudar antes de su inicio. Quien la organiza puede adelantar el inicio a hoy`;
}

/** "YYYY-MM-DD HH:MM:SS" en hora de Tepic, para comparar contra columnas DATE+TIME en SQL sin usar NOW()/CURRENT_TIMESTAMP de Postgres. */
function nowLocalTimestampParam(): string {
  const a = ahoraEnZona();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${a.year}-${pad(a.month)}-${pad(a.day)} ${pad(a.hour)}:${pad(a.minute)}:${pad(a.second)}`;
}

/**
 * Activa las campañas "aceptada" (supervisor ya la aprobó, pero con fecha/hora
 * de inicio futura) cuya fecha y hora de inicio ya llegaron. No hay cron ni
 * cola en este proyecto (ver AGENTS.md del repo), así que se ejecuta de forma
 * perezosa en cada lectura de campañas, igual que calculateCampaignDaysRemaining.
 * Sin start_time, COALESCE la deja en 00:00 (mismo comportamiento que antes).
 */
export async function activateScheduledCampaigns(): Promise<void> {
  const { rows } = await pool.query<{ id: number; creator_id: number; name: string; is_special: boolean }>(
    `UPDATE campanas SET status = 'activa', updated_at = NOW()
     WHERE status = 'aceptada'
       AND (start_date::timestamp + COALESCE(start_time, TIME '00:00:00')) <= $1::timestamp
     RETURNING id, creator_id, name, is_special`,
    [nowLocalTimestampParam()]
  );
  if (rows.length === 0) return;
  // Al empezar, cada campaña recibe su enlace público. Import dinámico:
  // lib/campanas/enlaces.ts importa este archivo y un import estático haría un ciclo.
  const { asegurarEnlaceVigente } = await import("@/lib/campanas/enlaces");
  // Mismo motivo: campanas-por-interes importa este archivo.
  const { avisarCampanaNueva, avisarCampanaEspecial } = await import("@/lib/notificaciones/campanas-por-interes");
  for (const { id, creator_id, name, is_special } of rows) {
    await asegurarEnlaceVigente(Number(id));
    // A quien tiene su temática y vive donde se hace (en segundo plano).
    avisarCampanaNueva(Number(id));
    // Programada desde la pausa (2026-10-27) con incentivos que no se avisaron mientras estaba pausada.
    if (is_special) avisarCampanaEspecial(Number(id));
    // El UPDATE solo devuelve la fila a quien la activó, así que se avisa una sola vez.
    await notificar({
      usuarioId: creator_id,
      tipo: "campana_iniciada",
      titulo: "Tu campaña empezó",
      mensaje: `"${name}" llegó a su fecha de inicio y ya recibe aportes.`,
      campanaId: id,
      enlace: `/mis-campanas/${id}/panel`,
    });
  }
}

/**
 * Finaliza las campañas "activa" cuya fecha y hora de fin ya llegaron, con el
 * mismo mecanismo perezoso que activateScheduledCampaigns. Una campaña sin
 * end_date no se toca: forzar el cierre de una campaña sin fecha definida
 * sería un comportamiento inesperado. Sin end_time, COALESCE la deja en
 * 00:00 (mismo comportamiento que antes de agregar la hora).
 */
export async function finalizeExpiredCampaigns(): Promise<void> {
  const { rows } = await pool.query<{ id: number; creator_id: number; name: string }>(
    `UPDATE campanas SET status = 'finalizada', updated_at = NOW()
     WHERE status = 'activa'
       AND end_date IS NOT NULL
       AND (end_date::timestamp + COALESCE(end_time, TIME '00:00:00')) <= $1::timestamp
     RETURNING id, creator_id, name`,
    [nowLocalTimestampParam()]
  );
  for (const { id, creator_id, name } of rows) {
    await notificar({
      usuarioId: creator_id,
      tipo: "campana_finalizada",
      titulo: "Tu campaña terminó",
      mensaje: `"${name}" llegó a su fecha de fin y ya no recibe aportes.`,
      campanaId: id,
      enlace: `/mis-campanas/${id}/panel`,
    });
  }
}

export function calculateCampaignDaysRemaining(value: unknown): number | null {
  const dateOnly = normalizeCampaignDate(value);
  if (!dateOnly) return null;

  const [year, month, day] = dateOnly.split("-").map(Number);
  const end = Date.UTC(year, month - 1, day);
  // "Hoy" es el día de Tepic, no el del servidor (en UTC ya es mañana desde las 17:00 de Tepic).
  const a = ahoraEnZona();
  const today = Date.UTC(a.year, a.month - 1, a.day);

  return Math.max(0, Math.floor((end - today) / 86_400_000));
}
