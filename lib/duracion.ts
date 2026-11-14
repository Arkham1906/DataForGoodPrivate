// Duraciones cortas para leer de un vistazo (2026-11-13): "35 min", "5 h", "3 días". Sin imports de servidor:
// la usan los dashboards de /revisiones y /supervision.

/** "35 min", "5 h", "3 días" (mínimo 1 min). */
export function duracion(segundos: number): string {
  const minutos = Math.max(1, Math.round(segundos / 60));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.round(horas / 24);
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

/** Cuánto ha pasado desde `iso` hasta `ahora` (milisegundos), con duracion(). */
export function esperaDesde(iso: string, ahora: number): string {
  return duracion(Math.max(0, (ahora - new Date(iso).getTime()) / 1000));
}
