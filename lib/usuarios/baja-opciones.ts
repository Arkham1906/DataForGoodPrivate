// Constantes de la baja voluntaria de cuenta (SCR-WEB-31). Sin imports de servidor:
// las usan la pantalla /cuenta/eliminar, DELETE /api/usuarios/[id] y lib/usuarios/baja.ts.

/**
 * Minutos entre pedir la baja y el borrado definitivo. Iniciar sesión antes la cancela.
 * 30 días (decisión del responsable del 2026-11-13, A5). Del 2026-10-19 al 2026-11-13 fueron 3 minutos para
 * probar el flujo; para volver a probarlo en local basta con bajar este valor.
 */
export const MINUTOS_DE_GRACIA: number = 30 * 24 * 60;

/** "30 días" (o "N minutos" / "N horas" si se baja para pruebas), para los textos (eliminar cuenta, términos y aviso de privacidad). */
export const PLAZO_DE_GRACIA = textoDePlazo(MINUTOS_DE_GRACIA);

function textoDePlazo(minutos: number): string {
  const [valor, unidad] =
    minutos % (24 * 60) === 0 ? [minutos / (24 * 60), "día"] : minutos % 60 === 0 ? [minutos / 60, "hora"] : [minutos, "minuto"];
  return `${valor} ${unidad}${valor === 1 ? "" : "s"}`;
}

/** Palabra que hay que escribir para confirmar. */
export const PALABRA_DE_CONFIRMACION = "ELIMINAR";

export type DestinoDeAportes = "eliminar" | "anonimizar" | "autoria";

export const DESTINOS_DE_APORTES: { valor: DestinoDeAportes; titulo: string; descripcion: string }[] = [
  {
    valor: "eliminar",
    titulo: "Eliminarlos junto con mi cuenta",
    descripcion: "Se borran de forma permanente del servidor y dejan de contar en las métricas de cada campaña.",
  },
  {
    valor: "anonimizar",
    titulo: "Conservarlos de forma anónima",
    descripcion: "Se eliminan tu nombre y tu correo. Los datos siguen sosteniendo las métricas de las campañas.",
  },
  {
    valor: "autoria",
    titulo: "Conservarlos con mi autoría",
    descripcion: "Tu nombre seguirá visible junto a cada aporte en el historial de la campaña. Tu correo sí se borra.",
  },
];

export function esDestinoDeAportes(valor: unknown): valor is DestinoDeAportes {
  return DESTINOS_DE_APORTES.some((d) => d.valor === valor);
}

/** "19 de octubre de 2026, 13:05", en la hora de Tepic (como el resto de la app). Con hora: el plazo es de minutos. */
export function formatearFechaDeBaja(fecha: Date): string {
  return fecha.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", hourCycle: "h23", timeZone: "America/Mazatlan" });
}
