// Compartir una campaña en redes sociales (2026-10-19): el mensaje que se propone y las direcciones
// de cada red. Sin imports de servidor: lo usa app/(dashboard)/campanas/[id]/redes-sociales.tsx.
// Ninguna red recibe datos de la persona: solo se abre su página de compartir con el texto y el enlace.

import { TEXTO_TODO_EL_PAIS } from "@/lib/campanas/ubicacion";

/** Datos de la campaña que van en el mensaje; lo que falte se omite sin dejar huecos. */
export type DatosDelMensaje = {
  nombre: string;
  tematica?: string | null;
  /** Como lo da textoDeUbicacion (lib/campanas/ubicacion.ts): "Tepic, Nayarit" o "Todo el país". */
  lugar?: string | null;
  /** Fecha de cierre, "AAAA-MM-DD" (o con hora: se toma solo el día). */
  fechaFin?: string | null;
};

const fechaLarga = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Mensaje que se propone al compartir; la persona puede cambiarlo antes de enviarlo. Desde el 2026-11-13 (a pedido
 * del usuario) es más llamativo, con emojis, y además del nombre y la temática lleva el lugar y hasta cuándo recibe
 * aportes. Corto a propósito: con un nombre común y el enlace cabe en los 280 caracteres de X. Antes decía
 * "¡Súmate a la campaña «X» en DataForGood! Con tu aporte ayudas a reunir datos sobre Y para la comunidad."
 */
export function mensajeParaCompartir({ nombre, tematica, lugar, fechaFin }: DatosDelMensaje): string {
  const tema = tematica?.trim() ? ` sobre ${tematica.trim().toLocaleLowerCase("es-MX")}` : "";
  const donde = lugar?.trim() ? (lugar.trim() === TEXTO_TODO_EL_PAIS ? " en todo el país" : ` en ${lugar.trim()}`) : "";
  const dia = fechaFin && /^\d{4}-\d{2}-\d{2}/.test(fechaFin) ? new Date(`${fechaFin.slice(0, 10)}T00:00:00Z`) : null;
  const cierre = dia && !Number.isNaN(dia.getTime()) ? ` ⏳ Abierta hasta el ${fechaLarga.format(dia)}.` : "";
  return (
    `📣 ¡Tu aporte cuenta! «${nombre}» reúne datos${tema}${donde}. ` +
    `✨ Comparte lo que ves y ayuda a tu comunidad con DataForGood.${cierre} 👉 Súmate aquí:`
  );
}

export type RedSocial = { clave: string; nombre: string; url: (mensaje: string, enlace: string) => string };

const c = encodeURIComponent;

/**
 * Páginas de compartir de cada red. Facebook y LinkedIn solo aceptan el enlace (el texto lo toman de
 * la vista previa de /c/[token]); las demás llevan el mensaje.
 */
export const REDES_SOCIALES: RedSocial[] = [
  { clave: "whatsapp", nombre: "WhatsApp", url: (m, e) => `https://wa.me/?text=${c(`${m} ${e}`)}` },
  { clave: "facebook", nombre: "Facebook", url: (m, e) => `https://www.facebook.com/sharer/sharer.php?u=${c(e)}&quote=${c(m)}` },
  { clave: "x", nombre: "X (Twitter)", url: (m, e) => `https://x.com/intent/post?text=${c(m)}&url=${c(e)}` },
  { clave: "telegram", nombre: "Telegram", url: (m, e) => `https://t.me/share/url?url=${c(e)}&text=${c(m)}` },
  { clave: "linkedin", nombre: "LinkedIn", url: (_m, e) => `https://www.linkedin.com/sharing/share-offsite/?url=${c(e)}` },
  { clave: "correo", nombre: "Correo", url: (m, e) => `mailto:?subject=${c("Te invito a participar en DataForGood")}&body=${c(`${m} ${e}`)}` },
];
