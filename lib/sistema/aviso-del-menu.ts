// Pendientes del SuperUsuario para el recuadro azul del menú lateral del panel (2026-11-10, a pedido del usuario;
// antes era la frase fija "Revisa con criterio: cada validación sostiene la calidad de los datos. Gracias por moderar").
// Un renglón con enlace por cada tipo de pendiente: campañas por supervisar (libres o ya tomadas por él, como
// /supervisar), decisiones de datos abiertos que solo él puede tomar, temáticas y subtemáticas por revisar y reportes. Sin pendientes,
// la frase de siempre. Lo arma el layout de (panel), que ya cuenta reportes y temáticas para el menú.

import { pool } from "@/lib/db";
import type { AvisoDelMenu } from "@/components/layout/AvisoDelMenu";

const FRASE_DEL_PANEL: AvisoDelMenu = {
  texto: "Revisa con criterio: cada validación sostiene la calidad de los datos.",
  cierre: "Gracias por moderar",
};

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Nunca lanza: si algo falla, la frase de siempre. */
export async function avisoDelMenuParaRoot(contados: { reportes: number; tematicas: number }): Promise<AvisoDelMenu> {
  try {
    const { rows } = await pool.query<{ por_supervisar: number; datos: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM campanas
           WHERE status = 'en_revision' AND (supervisado_por_root OR supervisor_id IS NULL)) AS por_supervisar,
         -- Las mismas que avisa /supervisar (pestanas.tsx): las supervisa él o no tienen supervisor.
         (SELECT COUNT(*)::int FROM campana_datos_abiertos d JOIN campanas c ON c.id = d.campana_id
           WHERE d.estado = 'pendiente' AND (c.supervisado_por_root OR c.supervisor_id IS NULL)) AS datos`,
    );
    const { por_supervisar: porSupervisar = 0, datos = 0 } = rows[0] ?? {};
    const renglones: { texto: string; href: string }[] = [];
    if (porSupervisar > 0) {
      renglones.push({ texto: `${plural(porSupervisar, "campaña", "campañas")} por supervisar`, href: "/supervisar" });
    }
    if (datos > 0) {
      renglones.push({
        texto: `${plural(datos, "decisión", "decisiones")} de datos abiertos`,
        href: "/supervisar",
      });
    }
    if (contados.tematicas > 0) {
      renglones.push({ texto: `${plural(contados.tematicas, "temática", "temáticas")} por revisar`, href: "/sistema/tematicas" });
    }
    if (contados.reportes > 0) {
      renglones.push({
        texto: plural(contados.reportes, "reporte pendiente", "reportes pendientes"),
        href: "/supervisar/reportes",
      });
    }
    if (renglones.length > 0) return { texto: "Pendientes del panel:", renglones };
  } catch (error) {
    console.error("No se pudo armar el aviso del menú del panel", error);
  }
  return FRASE_DEL_PANEL;
}
