// Avisos para participar (2026-10-14, decisiones del usuario en references/dominio.md § 11):
//   - campana_nueva: al activarse una campaña, a quien tiene su temática en sus intereses y vive en
//     su estado (y en su municipio, si la campaña tiene uno). Máximo 3 al día por persona.
//   - campana_especial: al publicarse los incentivos de una campaña activa (o al reanudarla), a
//     quien ya participa (aportó o la guardó) y a quien cumple lo mismo que en campana_nueva.
// Quien apaga "Campañas nuevas" en Preferencias (usuarios.avisos_campanas_nuevas) no recibe los
// avisos por interés; quien participa recibe el de especial igual. Nunca al creador, a cuentas
// bloqueadas o dadas de baja, ni a quien está baneado de la campaña; una vez por campaña y tipo.
//
// Se envían en segundo plano y de 10 en 10, sin hacer esperar a quien activó la campaña.

import { pool } from "@/lib/db";
import { SQL_SANCION_BLOQUEANTE } from "@/lib/sanciones";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { especialDesdeFila } from "@/lib/campanas/especial";
import { fechaCorta } from "@/lib/campanas/especial-reglas";
import { ZONA_DE_CAMPANAS } from "@/lib/campaign-date";
import { notificar } from "./notificaciones";
import type { TipoDeNotificacion } from "./tipos";

/** Tope de avisos de campañas nuevas por persona y día (hora de Tepic). */
export const MAXIMO_DE_CAMPANAS_NUEVAS_AL_DIA = 3;
const TAMANO_DE_TANDA = 10;

type Campana = Record<string, unknown> & {
  id: number;
  name: string;
  tematica: string | null;
  location_state: string | null;
  location_city: string | null;
  creator_id: number;
  status: string;
};

type Candidato = {
  id: number;
  intereses: unknown;
  state: string | null;
  city: string | null;
  participa: boolean;
  /** usuarios.avisos_campanas_nuevas (Preferencias de /cuenta). */
  acepta: boolean;
};

/** Avisa de una campaña recién activada. No espera ni lanza. */
export function avisarCampanaNueva(campanaId: number): void {
  void enviarCampanaNueva(campanaId).catch((error) => console.error(`Error avisando la campaña nueva ${campanaId}`, error));
}

/** Avisa de los incentivos de una campaña especial activa. No espera ni lanza. */
export function avisarCampanaEspecial(campanaId: number): void {
  void enviarCampanaEspecial(campanaId).catch((error) => console.error(`Error avisando la campaña especial ${campanaId}`, error));
}

async function leerCampana(campanaId: number): Promise<Campana | null> {
  const r = await pool.query<Campana>(`SELECT * FROM campanas WHERE id = $1`, [campanaId]);
  return r.rows[0] ?? null;
}

/**
 * Personas que pueden recibir el aviso `tipo` de la campaña: sin bloqueo, sin baja, verificadas,
 * no baneadas de la campaña y sin ese aviso todavía. `participa` = aportó con su cuenta o la guardó.
 */
async function candidatos(campana: Campana, tipo: TipoDeNotificacion): Promise<Candidato[]> {
  const r = await pool.query<Candidato>(
    `SELECT u.id, u.intereses, u.state, u.city,
            (EXISTS (SELECT 1 FROM aportes a WHERE a.campaign_id = $1 AND a.user_id = u.id)
             OR EXISTS (SELECT 1 FROM campanas_guardadas g WHERE g.campana_id = $1 AND g.usuario_id = u.id)) AS participa,
            u.avisos_campanas_nuevas AS acepta
       FROM usuarios u
      WHERE u.id <> $2
        AND u.email_verificado
        AND u.eliminada_en IS NULL AND u.baja_solicitada_en IS NULL
        AND NOT ${SQL_SANCION_BLOQUEANTE}
        AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = $1 AND b.usuario_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM notificaciones n WHERE n.usuario_id = u.id AND n.campana_id = $1 AND n.tipo = $3)`,
    [campana.id, campana.creator_id, tipo],
  );
  return r.rows.map((fila) => ({ ...fila, participa: Boolean(fila.participa), acepta: Boolean(fila.acepta) }));
}

/** Tiene la temática en sus intereses y vive donde se hace la campaña (y quiere estos avisos). */
function leInteresa(campana: Campana, persona: Candidato): boolean {
  return persona.acepta && coincideConPersona(campana, persona);
}

/**
 * La temática de la campaña está en los intereses de la persona y vive en su estado (y en su
 * municipio, si la campaña tiene uno). También la usa el resumen mensual (./periodicas.ts).
 */
export function coincideConPersona(
  campana: { tematica?: unknown; location_state?: unknown; location_city?: unknown },
  persona: { intereses: unknown; state: string | null; city: string | null },
): boolean {
  const tematica = claveDeTematica(String(campana.tematica ?? ""));
  const intereses = Array.isArray(persona.intereses) ? persona.intereses.map((t) => claveDeTematica(String(t))) : [];
  if (!tematica || !intereses.includes(tematica)) return false;
  const estado = claveDeTematica(String(campana.location_state ?? ""));
  if (!estado || claveDeTematica(String(persona.state ?? "")) !== estado) return false;
  // Sin municipio, la campaña abarca todo el estado (dominio.md § 3).
  const municipio = claveDeTematica(String(campana.location_city ?? ""));
  return !municipio || claveDeTematica(String(persona.city ?? "")) === municipio;
}

function lugar(campana: Campana): string {
  return [campana.location_city, campana.location_state].filter((v) => v && String(v).trim()).join(", ");
}

async function enTandas(ids: number[], aviso: (usuarioId: number) => Promise<void>): Promise<void> {
  for (let i = 0; i < ids.length; i += TAMANO_DE_TANDA) {
    await Promise.all(ids.slice(i, i + TAMANO_DE_TANDA).map(aviso));
  }
}

async function enviarCampanaNueva(campanaId: number): Promise<void> {
  const campana = await leerCampana(campanaId);
  if (!campana || campana.status !== "activa") return;
  const interesados = (await candidatos(campana, "campana_nueva")).filter((p) => leInteresa(campana, p)).map((p) => p.id);
  if (interesados.length === 0) return;

  // Tope diario: cuántos avisos de campañas nuevas lleva hoy (en Tepic) cada persona.
  const hoy = await pool.query<{ usuario_id: number; n: number }>(
    `SELECT usuario_id, COUNT(*)::int AS n FROM notificaciones
      WHERE tipo = 'campana_nueva' AND usuario_id = ANY($1::int[])
        AND created_at >= (date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)
      GROUP BY usuario_id`,
    [interesados, ZONA_DE_CAMPANAS],
  );
  const llevaHoy = new Map(hoy.rows.map((f) => [Number(f.usuario_id), f.n]));
  const destinatarios = interesados.filter((id) => (llevaHoy.get(id) ?? 0) < MAXIMO_DE_CAMPANAS_NUEVAS_AL_DIA);

  const donde = lugar(campana);
  await enTandas(destinatarios, (usuarioId) =>
    notificar({
      usuarioId,
      tipo: "campana_nueva",
      titulo: `Campaña nueva de ${campana.tematica}`,
      mensaje: `"${campana.name}" ya recibe aportes${donde ? ` en ${donde}` : ""}.`,
      campanaId: campana.id,
      enlace: `/campanas/${campana.id}`,
    }),
  );
}

async function enviarCampanaEspecial(campanaId: number): Promise<void> {
  const campana = await leerCampana(campanaId);
  if (!campana || campana.status !== "activa") return;
  const especial = especialDesdeFila(campana);
  if (!especial || especial.etapa === "terminada") return;

  const destinatarios = (await candidatos(campana, "campana_especial"))
    .filter((p) => p.participa || leInteresa(campana, p))
    .map((p) => p.id);

  const periodo = especial.etapa === "vigente"
    ? `hasta el ${fechaCorta(especial.fin)}`
    : `del ${fechaCorta(especial.inicio)} al ${fechaCorta(especial.fin)}`;
  const insignia = especial.insignia ? ` y la insignia "${especial.insignia}" al completar tu cuota` : "";
  await enTandas(destinatarios, (usuarioId) =>
    notificar({
      usuarioId,
      tipo: "campana_especial",
      titulo: `Campaña especial: experiencia ×${especial.multiplicador}`,
      mensaje: `"${campana.name}" da ×${especial.multiplicador} de experiencia por aporte aprobado ${periodo}${insignia}.`,
      campanaId: campana.id,
      enlace: `/campanas/${campana.id}`,
    }),
  );
}
