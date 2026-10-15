// Los dos acuerdos que la persona acepta para aportar (2026-10-13): el de uso del aporte y el de
// confirmación (el contenido corresponde a la campaña y no es inadecuado).
// Desde el 2026-10-15 (a pedido del usuario) se aceptan una vez, al inscribirse a la campaña
// (POST /api/campanas/[id]/inscripcion), con dos casillas cortas; el texto completo se lee en una
// ventana ("Leer los acuerdos"). Sin cuenta (/c/[token]) no hay inscripción: las casillas van en el
// formulario y se aceptan en cada aporte. Sin imports de servidor: los usan components/ui/AcuerdosDeAporte
// y los route handlers, que vuelven a exigirlos.

/** Textos cortos de las casillas. */
export const CASILLA_DE_CONFIRMACION = "Acepto el acuerdo de confirmación";
export const CASILLA_DE_USO = "Acepto el acuerdo de uso del aporte";

/** Campos del formulario multipart; llevan "si" cuando la casilla está marcada. */
export const CAMPO_ACEPTA_USO = "aceptaUso";
export const CAMPO_CONFIRMA_CONTENIDO = "confirmaContenido";

export const AVISO_DE_USO =
  "Acepto que DataForGood y quien organiza esta campaña usen mi aporte (el archivo, la descripción y lo que marque) " +
  "para los fines de la campaña y que, si se aprueba, se publique como dato abierto con licencia CC BY 4.0 " +
  "cuando la campaña termine, sin mi nombre ni mi correo.";

export const AVISO_DE_CONTENIDO =
  "Confirmo que mi aporte corresponde a la temática y a la descripción de esta campaña, y que no contiene " +
  "contenido inadecuado o sensible (por ejemplo, violencia explícita, desnudos o datos personales de otras personas).";

/** Lo que pasa si no se cumple; se muestra debajo de las casillas. */
export const CONSECUENCIA_DEL_CONTENIDO =
  "Un aporte que no cumpla puede rechazarse o marcarse como inapropiado.";

/**
 * Mensaje de error si falta alguna de las dos casillas, o null si están las dos. Acepta el FormData
 * de un aporte sin cuenta o el JSON de la inscripción ({ aceptaUso: "si", confirmaContenido: "si" }).
 */
export function errorDeConsentimiento(datos: FormData | Record<string, unknown>): string | null {
  const valor = (campo: string) => (datos instanceof FormData ? datos.get(campo) : datos[campo]);
  if (valor(CAMPO_CONFIRMA_CONTENIDO) !== "si") return "Debes aceptar el acuerdo de confirmación";
  if (valor(CAMPO_ACEPTA_USO) !== "si") return "Debes aceptar el acuerdo de uso del aporte";
  return null;
}
