// Rutas de la moderación (reportes y sanciones) según la zona desde la que se modera (2026-10-13):
// el SuperUsuario en modo supervisor (/supervisar/...) o un usuario con rol de supervisor
// (/supervision/...). Sin imports de servidor: lo usan las pantallas y los componentes cliente
// de components/moderacion. Las mismas pantallas se muestran en las dos zonas.

export type ZonaDeModeracion = "supervisar" | "supervision";

export const ZONAS_DE_MODERACION = new Set<string>(["supervisar", "supervision"]);

export function rutasDeModeracion(zona: ZonaDeModeracion) {
  const base = `/${zona}`;
  return {
    /** La primera pestaña: en /supervision el dashboard (2026-11-13); en /supervisar, las campañas. */
    inicio: base,
    /** Las listas de campañas (por supervisar, supervisadas...): en /supervision su propia pestaña desde el 2026-11-13. */
    campanas: zona === "supervision" ? `${base}/campanas` : base,
    reportes: `${base}/reportes`,
    reportesResueltos: `${base}/reportes?estado=resueltos`,
    sanciones: `${base}/sanciones`,
    /** Dar un aviso o banear; con `reportes` confirma los reportes de esa clave. */
    sancionar: (usuarioId: string, reportes?: string) =>
      `${base}/sanciones/${usuarioId}${reportes ? `?reportes=${encodeURIComponent(reportes)}` : ""}`,
    /** Ficha de una campaña: la del panel para el SuperUsuario, la pública de la app para un supervisor. */
    campana: (campanaId: string) => (zona === "supervisar" ? `/sistema/campanas/${campanaId}` : `/campanas/${campanaId}`),
    /** Ficha de supervisión de una campaña reportada, conservando el caso para sancionarlo desde ahí. */
    campanaReportada: (campanaId: string, reportes?: string) =>
      `/${zona}/${campanaId}${reportes ? `?reportes=${encodeURIComponent(reportes)}` : ""}`,
  };
}

/**
 * Pestañas de arriba. /supervisar: Campañas / Reportes / Sanciones. /supervision (2026-11-13, a pedido del usuario):
 * Dashboard / Campañas / Reportes / Sanciones; el dashboard es lo primero que se abre.
 */
export function pestanasDeModeracion(zona: ZonaDeModeracion) {
  const r = rutasDeModeracion(zona);
  if (zona === "supervision") {
    return [
      { href: r.inicio, etiqueta: "Dashboard" },
      { href: r.campanas, etiqueta: "Campañas" },
      { href: r.reportes, etiqueta: "Reportes" },
      { href: r.sanciones, etiqueta: "Sanciones" },
    ];
  }
  return [
    { href: r.campanas, etiqueta: "Campañas" },
    { href: r.reportes, etiqueta: "Reportes" },
    { href: r.sanciones, etiqueta: "Sanciones" },
  ];
}
