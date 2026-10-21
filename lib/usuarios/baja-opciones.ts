// Constantes de la baja voluntaria de cuenta (SCR-WEB-31). Sin imports de servidor:
// las usan la pantalla /cuenta/eliminar, DELETE /api/usuarios/[id] y lib/usuarios/baja.ts.

/**
 * Minutos entre pedir la baja y el borrado definitivo. Iniciar sesión antes la cancela.
 * Eran 30 días; el 2026-10-19 el usuario lo bajó a 3 minutos "por practicidad" (para probar el flujo).
 * TODO(dominio): decidir el plazo para producción.
 */
export const MINUTOS_DE_GRACIA: number = 3;

/** "3 minutos", para los textos (eliminar cuenta, términos y aviso de privacidad). */
export const PLAZO_DE_GRACIA = MINUTOS_DE_GRACIA === 1 ? "1 minuto" : `${MINUTOS_DE_GRACIA} minutos`;

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
