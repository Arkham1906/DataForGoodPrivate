// Pendientes del SuperUsuario para el recuadro azul del menú lateral del panel y el número junto a "Pendientes".
// Desde el 2026-11-24 (a pedido del usuario) salen de lib/pendientes/del-panel.ts, la misma fuente de la pantalla
// /sistema/pendientes: el recuadro muestra los 3 más urgentes y "Ver todos (N)" (avisoConPendientes).
// Historia: del 2026-11-10 al 2026-11-24 era un renglón por tipo de pendiente ("3 campañas por supervisar"); antes,
// la frase fija de FRASE_DEL_PANEL, que sigue saliendo sin pendientes.

import type { AvisoDelMenu } from "@/components/layout/AvisoDelMenu";
import { pendientesDelPanel } from "@/lib/pendientes/del-panel";
import { avisoConPendientes, plural } from "@/lib/pendientes/tipos";

const FRASE_DEL_PANEL: AvisoDelMenu = {
  texto: "Revisa con criterio: cada validación sostiene la calidad de los datos.",
  cierre: "Gracias por moderar",
};

/** Nunca lanza: si algo falla, la frase de siempre y 0. */
export async function avisoDelMenuParaRoot(): Promise<{ aviso: AvisoDelMenu; pendientes: number }> {
  try {
    const pendientes = await pendientesDelPanel();
    return {
      aviso: avisoConPendientes(pendientes, {
        verTodos: "/sistema/pendientes",
        frase: FRASE_DEL_PANEL,
        encabezado: (n) => `${plural(n, "pendiente", "pendientes")} del panel:`,
      }),
      pendientes: pendientes.length,
    };
  } catch (error) {
    console.error("No se pudo armar el aviso del menú del panel", error);
    return { aviso: FRASE_DEL_PANEL, pendientes: 0 };
  }
}
