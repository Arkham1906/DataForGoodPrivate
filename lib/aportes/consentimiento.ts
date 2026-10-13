// Los dos avisos que la persona acepta antes de enviar un aporte (2026-10-13): el consentimiento
// de uso y la confirmación de que el contenido corresponde a la campaña y no es inadecuado.
// Sin imports de servidor: los usan los formularios (components/ui/AvisosDeAporte) y los route
// handlers (POST /api/aportes, POST /api/c/[token]/aportes), que vuelven a exigirlos.

/** Campos del formulario multipart; llevan "si" cuando la casilla está marcada. */
export const CAMPO_ACEPTA_USO = "aceptaUso";
export const CAMPO_CONFIRMA_CONTENIDO = "confirmaContenido";

export const AVISO_DE_USO =
  "Acepto que DataForGood y quien organiza esta campaña usen mi aporte (la foto, la descripción y lo que marque) " +
  "para los fines de la campaña y que, si se aprueba, se publique como dato abierto con licencia CC BY 4.0 " +
  "cuando la campaña termine, sin mi nombre ni mi correo.";

export const AVISO_DE_CONTENIDO =
  "Confirmo que mi aporte corresponde a la temática y a la descripción de esta campaña, y que no contiene " +
  "contenido inadecuado o sensible (por ejemplo, violencia explícita, desnudos o datos personales de otras personas).";

/** Lo que pasa si no se cumple; se muestra debajo de las casillas. */
export const CONSECUENCIA_DEL_CONTENIDO =
  "Un aporte que no cumpla puede rechazarse o marcarse como inapropiado.";

/** Mensaje de error si falta alguna de las dos casillas, o null si están las dos. */
export function errorDeConsentimiento(formData: FormData): string | null {
  if (formData.get(CAMPO_ACEPTA_USO) !== "si") return "Debes aceptar el uso de tu aporte para enviarlo";
  if (formData.get(CAMPO_CONFIRMA_CONTENIDO) !== "si") {
    return "Debes confirmar que tu aporte corresponde a la campaña y no tiene contenido inadecuado";
  }
  return null;
}
