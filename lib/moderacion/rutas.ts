// Rutas de la moderación (reportes y sanciones) según la zona desde la que se modera (2026-10-13):
// el SuperUsuario en modo supervisor (/supervisar/...) o un usuario con rol de supervisor
// (/supervision/...). Sin imports de servidor: lo usan las pantallas y los componentes cliente
// de components/moderacion. Las mismas pantallas se muestran en las dos zonas.

export type ZonaDeModeracion = "supervisar" | "supervision";

export const ZONAS_DE_MODERACION = new Set<string>(["supervisar", "supervision"]);

export function rutasDeModeracion(zona: ZonaDeModeracion) {
  const base = `/${zona}`;
  return {
    /** Campañas por supervisar: la primera pestaña. */
    campanas: base,
    reportes: `${base}/reportes`,
    reportesResueltos: `${base}/reportes?estado=resueltos`,
    sanciones: `${base}/sanciones`,
    /** Dar un aviso o banear; con `reportes` confirma los reportes de esa clave. */
    sancionar: (usuarioId: string, reportes?: string) =>
      `${base}/sanciones/${usuarioId}${reportes ? `?reportes=${encodeURIComponent(reportes)}` : ""}`,
    /** Ficha de una campaña: la del panel para el SuperUsuario, la pública de la app para un supervisor. */
    campana: (campanaId: string) => (zona === "supervisar" ? `/sistema/campanas/${campanaId}` : `/campanas/${campanaId}`),
  };
}

/** Pestañas de arriba en las dos zonas: Campañas / Reportes / Sanciones. */
export function pestanasDeModeracion(zona: ZonaDeModeracion) {
  const r = rutasDeModeracion(zona);
  return [
    { href: r.campanas, etiqueta: "Campañas" },
    { href: r.reportes, etiqueta: "Reportes" },
    { href: r.sanciones, etiqueta: "Sanciones" },
  ];
}
