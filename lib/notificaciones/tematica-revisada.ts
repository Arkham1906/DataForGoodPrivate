// Avisos cuando el SuperUsuario revisa una temática propuesta (2026-10-29, a pedido del usuario) en
// /sistema/tematicas. Lo llama revisarTematica (lib/tematicas/acciones-tematicas.ts) después de
// decidir, con los datos que leyó antes (propuestaDeTematica: rechazar la borra).
//   - A quien la propuso: aprobada o no aceptada (y de dónde se quitó).
//   - Al creador de cada campaña que la usaba, si se rechazó: a qué temática pasó su campaña.

import type { CampanaReasignada } from "@/lib/tematicas/catalogo";
import { notificar } from "./notificaciones";

export async function avisarTematicaRevisada(
  propuesta: { usuarioId: number; nombre: string; enPerfil: boolean; enCampana: boolean } | null,
  aprobada: boolean,
  rechazo?: { campanas: CampanaReasignada[]; reemplazo: string | null },
): Promise<void> {
  const nombre = propuesta?.nombre;
  if (propuesta && nombre) {
    const enlace = propuesta.enPerfil || !propuesta.enCampana ? "/cuenta" : "/mis-campanas";
    if (aprobada) {
      await notificar({
        usuarioId: propuesta.usuarioId,
        tipo: "tematica_aprobada",
        titulo: "Temática aprobada",
        mensaje: `Aprobamos «${nombre}»: ya se ofrece a todos en los perfiles y al crear campañas.`,
        enlace,
      });
    } else if (propuesta.enPerfil || !propuesta.enCampana) {
      // Si solo la usaba en campañas, el aviso de su campaña ya lo dice.
      await notificar({
        usuarioId: propuesta.usuarioId,
        tipo: "tematica_rechazada",
        titulo: "Temática no aceptada",
        mensaje: `No aceptamos «${nombre}»${propuesta.enPerfil ? " y se quitó de tus intereses" : ""}. Puedes elegir otra de las que ya existen o proponer una distinta.`,
        enlace: "/cuenta",
      });
    }
  }

  if (aprobada || !rechazo?.reemplazo) return;
  for (const campana of rechazo.campanas) {
    await notificar({
      usuarioId: campana.creadorId,
      tipo: "tematica_rechazada",
      titulo: "Cambió la temática de tu campaña",
      mensaje: `No aceptamos la temática propuesta para «${campana.nombre}»: ahora está en «${rechazo.reemplazo}». Puedes cambiarla al editar la campaña.`,
      enlace: "/mis-campanas",
    });
  }
}
