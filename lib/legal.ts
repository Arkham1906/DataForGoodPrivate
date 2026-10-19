// Datos que comparten los Términos de uso (/terminos) y el Aviso de privacidad (/privacidad).
// Sin imports de servidor. Los valores null se muestran en la página como "[Pendiente: ...]"
// (components/layout/PaginaLegal): al llenarlos aquí, cambian en los dos textos.

/**
 * Quién responde por los datos personales y por el servicio.
 * TODO(dominio): el equipo no ha definido el responsable ni el correo de contacto (2026-10-19).
 */
export const RESPONSABLE: { nombre: string | null; domicilio: string | null; correo: string | null } = {
  nombre: null,
  domicilio: null,
  correo: null,
};

/** Fecha de la versión vigente de los dos textos. Cámbiala cada vez que se modifiquen. */
export const FECHA_DE_ACTUALIZACION = "19 de octubre de 2026";
