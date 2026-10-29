// Aviso a quien propuso una etiqueta (en su perfil o en su campaña) cuando el SuperUsuario la revisa
// en /sistema/tematicas (2026-10-28, a pedido del usuario). Lo llama revisarEtiqueta
// (lib/etiquetas/acciones-etiquetas.ts) después de aprobar o rechazar, con los datos que leyó antes
// (propuestaDeEtiqueta: rechazar borra la etiqueta).

import { notificar } from "./notificaciones";

export async function avisarEtiquetaRevisada(
  propuesta: { usuarioId: number; nombre: string; tematica: string; enPerfil: boolean; enCampana: boolean },
  aprobada: boolean,
): Promise<void> {
  // Dónde la tenía: lleva ahí al abrir el aviso.
  const donde = propuesta.enPerfil && propuesta.enCampana ? "de tu perfil y de tu campaña" : propuesta.enCampana ? "de tu campaña" : "de tu perfil";
  const enlace = propuesta.enPerfil || !propuesta.enCampana ? "/cuenta" : "/mis-campanas";
  await notificar(
    aprobada
      ? {
          usuarioId: propuesta.usuarioId,
          tipo: "etiqueta_aprobada",
          titulo: "Etiqueta aprobada",
          mensaje: `Aprobamos «${propuesta.nombre}» en ${propuesta.tematica}: ya se ofrece a todos y sigue ${donde.replaceAll("de tu", "en tu")}.`,
          enlace,
        }
      : {
          usuarioId: propuesta.usuarioId,
          tipo: "etiqueta_rechazada",
          titulo: "Etiqueta no aceptada",
          mensaje: `No aceptamos «${propuesta.nombre}» en ${propuesta.tematica} y se quitó ${donde}. Puedes elegir otra de las que ya existen o proponer una distinta.`,
          enlace,
        },
  );
}
