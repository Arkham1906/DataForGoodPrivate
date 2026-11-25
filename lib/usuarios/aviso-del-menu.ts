// Lo que dice el recuadro azul del menú lateral de la zona de usuario y el número del botón "Pendientes" de la barra superior.
// Desde el 2026-11-24 (a pedido del usuario) los pendientes salen de lib/pendientes/del-usuario.ts, la misma fuente
// de la pantalla /pendientes: el recuadro muestra los 3 más urgentes y "Ver todos (N)" (avisoConPendientes). Sin
// pendientes, la sugerencia de una campaña que cierra pronto o la frase de siempre.
// Historia: del 2026-11-13 al 2026-11-24 el recuadro listaba todo, juntando varias campañas en un renglón ("Dictaminar
// 3 campañas"); del 2026-11-10 al 2026-11-13 mostraba una sola cosa.
// La llama components/layout/ShellDeUsuario en el servidor; se vuelve a calcular con cada router.refresh de
// ActualizacionEnVivo (cambio en la base) y en cada carga completa. En móvil el recuadro no se ve.

import type { SessionUser } from "@/lib/session";
import type { AvisoDelMenu } from "@/components/layout/AvisoDelMenu";
import { pendientesDelUsuario } from "@/lib/pendientes/del-usuario";
import { avisoConPendientes } from "@/lib/pendientes/tipos";

export const FRASE_DEL_MENU: AvisoDelMenu = {
  texto: "Cada aporte transforma datos en impacto para tu comunidad.",
  cierre: "¡Súmate!",
};

/** El aviso del menú lateral y cuántos pendientes hay. Nunca lanza: si algo falla, la frase de siempre y 0. */
export async function avisoDelMenuParaUsuario(usuario: SessionUser): Promise<{ aviso: AvisoDelMenu; pendientes: number }> {
  try {
    const { pendientes, sugerencia } = await pendientesDelUsuario(usuario);
    return {
      aviso: avisoConPendientes(pendientes, { verTodos: "/pendientes", frase: FRASE_DEL_MENU, sugerencia }),
      pendientes: pendientes.length,
    };
  } catch (error) {
    console.error("No se pudo armar el aviso del menú lateral", error);
    return { aviso: FRASE_DEL_MENU, pendientes: 0 };
  }
}
