// "Ahora" y "hoy" en la zona de las campañas (Tepic), sin imports de servidor: lo usan
// lib/campaign-date.ts y también el navegador (fecha mínima del formulario de campaña).
// Con la zona del proceso no sirve: dentro de Docker es UTC (ver lib/campaign-date.ts).

/** Zona de las fechas y horas de campaña (Tepic, Nayarit; la misma del resto de la app). */
export const ZONA_DE_CAMPANAS = "America/Mazatlan";

const PARTES_DE_AHORA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_DE_CAMPANAS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Fecha y hora de pared de Tepic en este momento. */
export function ahoraEnZona(): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const partes = Object.fromEntries(
    PARTES_DE_AHORA.formatToParts(new Date())
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)])
  );
  return {
    year: partes.year,
    month: partes.month,
    day: partes.day,
    hour: partes.hour,
    minute: partes.minute,
    second: partes.second,
  };
}

/** "Hoy" en Tepic como "YYYY-MM-DD" (comparable como texto con las columnas DATE normalizadas). */
export function hoyEnTepic(): string {
  const a = ahoraEnZona();
  return `${a.year}-${String(a.month).padStart(2, "0")}-${String(a.day).padStart(2, "0")}`;
}

/**
 * true si la fecha ("YYYY-MM-DD") y hora ("HH:MM", opcional) de inicio todavía no llegan en Tepic.
 * Versión para el navegador de hasCampaignStarted (lib/campaign-date.ts): el formulario decide
 * entre "Guardar y reanudar" y "Guardar y programar" con ella (2026-10-27).
 */
export function inicioEnElFuturo(fecha: string | null | undefined, hora?: string | null): boolean {
  if (!fecha) return false;
  const a = ahoraEnZona();
  const dos = (n: number) => String(n).padStart(2, "0");
  const ahora = `${hoyEnTepic()} ${dos(a.hour)}:${dos(a.minute)}:${dos(a.second)}`;
  const inicio = `${fecha.slice(0, 10)} ${(hora || "00:00").slice(0, 5)}:00`;
  return inicio > ahora;
}

/** "YYYY-MM-DD" → "DD/MM/AAAA", como se escriben en el formulario (ui/CampoDeFecha). Otro texto queda igual. */
export function fechaDDMMAAAA(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

/** Mensaje si la fecha de fin queda antes de la de inicio ("YYYY-MM-DD"); el mismo día sí se permite. */
export function errorDeFinAntesDeInicio(fechaDeInicio: string | null | undefined, fechaDeFin: string | null | undefined): string | null {
  if (!fechaDeInicio || !fechaDeFin || fechaDeFin >= fechaDeInicio) return null;
  return "La fecha de finalización no puede ser anterior a la de inicio";
}

/** Mensaje si la fecha de inicio ("YYYY-MM-DD") ya pasó; hoy sí se permite. */
export function errorDeInicioPasado(fechaDeInicio: string | null | undefined): string | null {
  if (!fechaDeInicio || fechaDeInicio >= hoyEnTepic()) return null;
  return "La fecha de inicio no puede ser anterior a hoy";
}
