// Datos internos de una campaña que no viajan a quien no tiene sesión (2026-11-20, hallazgo #5
// de las pruebas de seguridad): el id de cuenta del creador y del supervisor, y si la supervisa el
// SuperUsuario. Las pantallas públicas no los usan (muestran creatorName y quienOrganiza()); con
// sesión siguen yendo, porque la supervisión y "Mis campañas" comparan esos ids.
// Lo usan GET /api/campanas y GET /api/campanas/[id]. Sin imports de servidor.

interface ConDatosInternos {
  creatorId: string;
  supervisorId: string | null;
  supervisedByRoot: boolean;
  latestSupervisionAction?: string | null;
}

/** Copia de la campaña con esos campos vacíos (mismos tipos, para no romper el contrato). */
export function sinDatosInternos<T extends ConDatosInternos>(campana: T): T {
  return {
    ...campana,
    creatorId: "",
    supervisorId: null,
    supervisedByRoot: false,
    ...("latestSupervisionAction" in campana ? { latestSupervisionAction: null } : {}),
  };
}
