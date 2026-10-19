// Compartir una campaña en redes sociales (2026-10-19): el mensaje que se propone y las direcciones
// de cada red. Sin imports de servidor: lo usa app/(dashboard)/campanas/[id]/redes-sociales.tsx.
// Ninguna red recibe datos de la persona: solo se abre su página de compartir con el texto y el enlace.

/** Mensaje que se propone al compartir; la persona puede cambiarlo antes de enviarlo. */
export function mensajeParaCompartir(nombre: string, tematica?: string | null): string {
  const tema = tematica?.trim() ? ` sobre ${tematica.trim().toLowerCase()}` : "";
  return (
    `¡Súmate a la campaña «${nombre}» en DataForGood! ` +
    `Con tu aporte ayudas a reunir datos${tema} para la comunidad. Participa aquí:`
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
