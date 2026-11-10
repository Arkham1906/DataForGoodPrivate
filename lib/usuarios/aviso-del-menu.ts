// Lo que dice el recuadro azul del menú lateral de la zona de usuario (2026-11-10, a pedido del usuario; antes era
// la frase fija "Cada aporte transforma datos en impacto para tu comunidad. ¡Súmate!"). Invita a participar con
// UNA sola cosa (regla de Hick), la primera que aplique:
//   1. Cuota pendiente en una campaña (misma regla que el recordatorio semanal, lib/campanas/cuota-pendiente.ts).
//   2. Una campaña activa que cierra pronto y necesita aportes (primero de sus temáticas).
//   3. Si no hay nada de eso (o algo falla): la frase de siempre.
// No repite lo que ya llega como notificación (decisión del usuario, el mismo día): aportes por revisar, invitación
// de revisor, campaña rechazada y pendientes de supervisor van solo a la campana; "sin temáticas", a sus avisos de
// /campanas e /inicio. La gamificación (racha, misiones) tampoco entra: obtenerResumenDeProgreso() escribe al leer
// y es de Andrey.
// La llama components/layout/ShellDeUsuario en el servidor; se vuelve a calcular con cada router.refresh de
// ActualizacionEnVivo (cambio en la base) y en cada carga completa.

import { pool } from "@/lib/db";
import { campanasConCuotaPendiente } from "@/lib/campanas/cuota-pendiente";
import { hoyEnTepic } from "@/lib/fecha-de-tepic";
import type { SessionUser } from "@/lib/session";
import type { AvisoDelMenu } from "@/components/layout/AvisoDelMenu";

/** Días hacia adelante para "cierra pronto" (campaña que necesita aportes y favoritas en la cuota pendiente). */
const DIAS_DE_CIERRE_PRONTO = 7;

export const FRASE_DEL_MENU: AvisoDelMenu = {
  texto: "Cada aporte transforma datos en impacto para tu comunidad.",
  cierre: "¡Súmate!",
};

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function sumarDias(dia: string, dias: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

function cuandoCierra(dias: number): string {
  if (dias <= 0) return "Cierra hoy";
  if (dias === 1) return "Cierra mañana";
  return `Quedan ${dias} días`;
}

async function cuotaPendiente(usuarioId: number, hoy: string): Promise<AvisoDelMenu | null> {
  const [campana] = await campanasConCuotaPendiente(usuarioId, {
    favoritasQueCierranAntesDe: sumarDias(hoy, DIAS_DE_CIERRE_PRONTO),
    limite: 1,
  });
  if (!campana) return null;
  return {
    texto: `Te ${campana.faltan === 1 ? "falta" : "faltan"} ${plural(campana.faltan, "aporte", "aportes")} en «${campana.name}».`,
    enlace: { href: `/campanas/${campana.id}`, etiqueta: "Ir a aportar" },
  };
}

async function campanaQueNecesitaAportes(usuario: SessionUser, hoy: string): Promise<AvisoDelMenu | null> {
  const { rows } = await pool.query<{ id: number; name: string; faltan: number; dias: number }>(
    `SELECT c.id, c.name, (c.goal_contributions - e.approved_contributions)::int AS faltan,
            (c.end_date - $2::date)::int AS dias
       FROM campanas c
       JOIN campana_estadisticas e ON e.campana_id = c.id
      WHERE c.status = 'activa' AND c.creator_id <> $1
        AND c.end_date BETWEEN $2::date AND $3::date
        AND e.approved_contributions < c.goal_contributions
        AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = c.id AND b.usuario_id = $1)
      ORDER BY (c.tematica = ANY($4::text[])) DESC, c.end_date ASC, c.id
      LIMIT 1`,
    [usuario.id, hoy, sumarDias(hoy, DIAS_DE_CIERRE_PRONTO), usuario.intereses ?? []],
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    texto: `${cuandoCierra(fila.dias)}: «${fila.name}» necesita ${plural(fila.faltan, "aporte", "aportes")} más.`,
    enlace: { href: `/campanas/${fila.id}`, etiqueta: "Ver campaña" },
  };
}

/** El aviso del menú lateral para esta persona. Nunca lanza: si algo falla, la frase de siempre. */
export async function avisoDelMenuParaUsuario(usuario: SessionUser): Promise<AvisoDelMenu> {
  try {
    const hoy = hoyEnTepic();
    return (await cuotaPendiente(usuario.id, hoy)) ?? (await campanaQueNecesitaAportes(usuario, hoy)) ?? FRASE_DEL_MENU;
  } catch (error) {
    console.error("No se pudo armar el aviso del menú lateral", error);
    return FRASE_DEL_MENU;
  }
}
