// Avisos para participar (2026-10-14, decisiones del usuario en references/dominio.md § 11):
//   - campana_nueva: al activarse una campaña, a quien tiene su temática en sus intereses y vive en
//     su estado (y en su municipio, si la campaña tiene uno). Si es para todo el país (2026-10-21),
//     a quien tiene la temática, viva donde viva. Máximo 3 al día por persona.
//   - campana_especial: al publicarse los incentivos de una campaña activa (o al reanudarla), a
//     quien ya participa (aportó o la guardó) y a quien cumple lo mismo que en campana_nueva.
// Subtemáticas (etiquetas, 2026-10-27, decisión del usuario): si la persona marcó alguna de la
// temática de la campaña, no le llegan los avisos por interés de campañas que solo tengan otras
// etiquetas; las campañas sin etiquetas sí le llegan (son generales de la temática).
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
import { avisarCampanaRelacionada } from "./socializacion";
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
  todo_el_pais: boolean;
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
  /** Etiquetas (ids) que marcó dentro de la temática de la campaña. */
  etiquetas_del_tema: number[];
};

/**
 * Avisa de una campaña recién activada. No espera ni lanza. Después invita a quien participa en
 * campañas con sus etiquetas (campana_relacionada, ./socializacion.ts): va detrás para no repetírselo
 * a quien ya recibió el de campaña nueva.
 */
export function avisarCampanaNueva(campanaId: number): void {
  void enviarCampanaNueva(campanaId)
    .catch((error) => console.error(`Error avisando la campaña nueva ${campanaId}`, error))
    .finally(() => avisarCampanaRelacionada(campanaId));
}

/** Avisa de los incentivos de una campaña especial activa. No espera ni lanza. */
export function avisarCampanaEspecial(campanaId: number): void {
  void enviarCampanaEspecial(campanaId).catch((error) => console.error(`Error avisando la campaña especial ${campanaId}`, error));
}

async function leerCampana(campanaId: number): Promise<Campana | null> {
  const r = await pool.query<Campana>(
    `SELECT c.*,
            ARRAY(SELECT ce.etiqueta_id FROM campana_etiquetas ce JOIN etiquetas e ON e.id = ce.etiqueta_id
                  WHERE ce.campana_id = c.id AND e.aprobada) AS etiquetas_ids
       FROM campanas c WHERE c.id = $1`,
    [campanaId],
  );
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
            u.avisos_campanas_nuevas AS acepta,
            ARRAY(SELECT ue.etiqueta_id FROM usuario_etiquetas ue
                    JOIN etiquetas e ON e.id = ue.etiqueta_id
                    JOIN tematicas t ON t.id = e.tematica_id
                   WHERE ue.usuario_id = u.id AND t.clave = $4) AS etiquetas_del_tema
       FROM usuarios u
      WHERE u.id <> $2
        AND u.email_verificado
        AND u.eliminada_en IS NULL AND u.baja_solicitada_en IS NULL
        AND NOT ${SQL_SANCION_BLOQUEANTE}
        AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = $1 AND b.usuario_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM notificaciones n WHERE n.usuario_id = u.id AND n.campana_id = $1 AND n.tipo = $3)`,
    [campana.id, campana.creator_id, tipo, claveDeTematica(String(campana.tematica ?? ""))],
  );
  return r.rows.map((fila) => ({
    ...fila,
    participa: Boolean(fila.participa),
    acepta: Boolean(fila.acepta),
    etiquetas_del_tema: (fila.etiquetas_del_tema ?? []).map(Number),
  }));
}

/**
 * Tiene la temática en sus intereses y vive donde se hace la campaña (y quiere estos avisos). Si
 * marcó subtemáticas de esa temática y la campaña tiene etiquetas, alguna debe ser de las suyas.
 * Una campaña sin etiquetas le llega igual (decisión del usuario, 2026-10-27): las etiquetas son
 * opcionales y quien marcó subtemáticas no debe perderse las campañas generales de su temática.
 */
function leInteresa(campana: Campana, persona: Candidato): boolean {
  if (!persona.acepta || !coincideConPersona(campana, persona)) return false;
  if (persona.etiquetas_del_tema.length === 0) return true;
  const deLaCampana = new Set((Array.isArray(campana.etiquetas_ids) ? campana.etiquetas_ids : []).map(Number));
  if (deLaCampana.size === 0) return true;
  return persona.etiquetas_del_tema.some((id) => deLaCampana.has(id));
}

/**
 * La temática de la campaña está en los intereses de la persona y vive en su estado (y en su
 * municipio, si la campaña tiene uno); si es para todo el país, basta la temática. También la usa
 * el resumen mensual (./periodicas.ts).
 */
export function coincideConPersona(
  campana: { tematica?: unknown; location_state?: unknown; location_city?: unknown; todo_el_pais?: unknown },
  persona: { intereses: unknown; state: string | null; city: string | null },
): boolean {
  const tematica = claveDeTematica(String(campana.tematica ?? ""));
  const intereses = Array.isArray(persona.intereses) ? persona.intereses.map((t) => claveDeTematica(String(t))) : [];
  if (!tematica || !intereses.includes(tematica)) return false;
  if (campana.todo_el_pais === true) return true;
  const estado = claveDeTematica(String(campana.location_state ?? ""));
  if (!estado || claveDeTematica(String(persona.state ?? "")) !== estado) return false;
  // Sin municipio, la campaña abarca todo el estado (dominio.md § 3).
  const municipio = claveDeTematica(String(campana.location_city ?? ""));
  return !municipio || claveDeTematica(String(persona.city ?? "")) === municipio;
}

function lugar(campana: Campana): string {
  if (campana.todo_el_pais) return "todo el país";
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
