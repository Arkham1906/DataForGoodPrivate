// Avisos de socialización (2026-10-28, decisiones del usuario): a quien participa en una campaña
// (aportó con su cuenta o la guardó) se le cuenta cómo avanza y se le invita a otras parecidas.
//   - campana_avance: la campaña llegó al 25, 50, 75 o 100 % de su meta (aportes aceptados entre
//     goal_contributions). Una vez por hito; si un aporte salta dos hitos, solo se avisa el mayor.
//     campanas.ultimo_hito_avisado guarda el último y se marca con un UPDATE ... RETURNING antes de
//     enviar, así dos aceptaciones simultáneas no lo repiten. Solo campañas activas.
//   - campana_relacionada: se activó una campaña con alguna etiqueta (subcategoría) de otra campaña
//     activa o pausada donde la persona participa. Cuenta la etiqueta de las campañas, no la del
//     perfil (decisión del usuario). Además debe vivir donde se hace (o ser para todo el país), no
//     participar ya en ella ni haber recibido su campana_nueva, y querer avisos de "Campañas nuevas".
// Tope: MAXIMO_DE_SOCIALIZACION_AL_DIA entre los dos tipos por persona y día (hora de Tepic); los que
// pasan del tope no se envían. Nunca al creador de la campaña, a cuentas bloqueadas o dadas de baja,
// ni a quien está baneado de ella. Todo en segundo plano y de 10 en 10; nunca lanza.

import { pool } from "@/lib/db";
import { SQL_SANCION_BLOQUEANTE } from "@/lib/sanciones";
import { ZONA_DE_CAMPANAS } from "@/lib/campaign-date";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { notificar } from "./notificaciones";

/** Tope de avisos de socialización (avance + relacionadas) por persona y día. */
export const MAXIMO_DE_SOCIALIZACION_AL_DIA = 2;
export const HITOS_DE_AVANCE = [25, 50, 75, 100] as const;
const TAMANO_DE_TANDA = 10;

/** Cuentas que pueden recibir avisos, no baneadas de la campaña $1 (alias `u`). */
const PUEDE_RECIBIR = `u.email_verificado AND u.eliminada_en IS NULL AND u.baja_solicitada_en IS NULL
  AND NOT ${SQL_SANCION_BLOQUEANTE}
  AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = $1 AND b.usuario_id = u.id)`;

/** Participantes con cuenta de cada campaña: aportaron o la guardaron. */
const PARTICIPANTES = `(SELECT campaign_id AS campana_id, user_id AS usuario_id FROM aportes WHERE user_id IS NOT NULL
   UNION SELECT campana_id, usuario_id FROM campanas_guardadas)`;

/** Mayor hito alcanzado con `aceptados` de `meta` (0 si ninguno o sin meta). */
export function hitoAlcanzado(aceptados: number, meta: number): number {
  if (meta <= 0) return 0;
  const porcentaje = (aceptados * 100) / meta;
  return [...HITOS_DE_AVANCE].reverse().find((h) => porcentaje >= h) ?? 0;
}

/** Tras aceptar un aporte: avisa si la campaña pasó un hito de su meta. No espera ni lanza. */
export function avisarAvanceDeCampana(campanaId: number | string): void {
  void enviarAvance(Number(campanaId)).catch((error) => console.error(`Error avisando el avance de la campaña ${campanaId}`, error));
}

/** Al activarse una campaña: invita a quien participa en otras con sus etiquetas. No espera ni lanza. */
export function avisarCampanaRelacionada(campanaId: number | string): void {
  void enviarRelacionada(Number(campanaId)).catch((error) => console.error(`Error avisando la campaña relacionada ${campanaId}`, error));
}

/** Deja solo a quien no ha llegado hoy al tope de socialización. */
async function dentroDelTope(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const hoy = await pool.query<{ usuario_id: number; n: number }>(
    `SELECT usuario_id, COUNT(*)::int AS n FROM notificaciones
      WHERE tipo IN ('campana_avance', 'campana_relacionada') AND usuario_id = ANY($1::int[])
        AND created_at >= (date_trunc('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)
      GROUP BY usuario_id`,
    [ids, ZONA_DE_CAMPANAS],
  );
  const llevaHoy = new Map(hoy.rows.map((f) => [Number(f.usuario_id), f.n]));
  return ids.filter((id) => (llevaHoy.get(id) ?? 0) < MAXIMO_DE_SOCIALIZACION_AL_DIA);
}

async function enTandas<T>(lista: T[], aviso: (elemento: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < lista.length; i += TAMANO_DE_TANDA) {
    await Promise.all(lista.slice(i, i + TAMANO_DE_TANDA).map(aviso));
  }
}

async function enviarAvance(campanaId: number): Promise<void> {
  const leida = await pool.query<{ aceptados: number; meta: number }>(
    `SELECT approved_contributions AS aceptados, goal_contributions AS meta FROM campanas WHERE id = $1 AND status = 'activa'`,
    [campanaId],
  );
  const fila = leida.rows[0];
  if (!fila) return;
  const hito = hitoAlcanzado(Number(fila.aceptados), Number(fila.meta));
  if (hito === 0) return;

  // Se marca antes de enviar: solo quien lo cambia avisa.
  const marcada = await pool.query<{ name: string; creator_id: number }>(
    `UPDATE campanas SET ultimo_hito_avisado = $2 WHERE id = $1 AND ultimo_hito_avisado < $2 RETURNING name, creator_id`,
    [campanaId, hito],
  );
  const campana = marcada.rows[0];
  if (!campana) return;

  const participantes = await pool.query<{ id: number }>(
    `SELECT DISTINCT u.id FROM ${PARTICIPANTES} p JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.campana_id = $1 AND u.id <> $2 AND ${PUEDE_RECIBIR}`,
    [campanaId, campana.creator_id],
  );
  const destinatarios = await dentroDelTope(participantes.rows.map((f) => Number(f.id)));
  const meta = Number(fila.meta);
  const aceptados = Number(fila.aceptados);
  await enTandas(destinatarios, (usuarioId) =>
    notificar({
      usuarioId,
      tipo: "campana_avance",
      titulo: hito === 100 ? "¡Meta cumplida!" : `Campaña al ${hito} %`,
      mensaje:
        hito === 100
          ? `"${campana.name}" completó su meta de ${meta} aportes aceptados. Gracias por participar.`
          : `"${campana.name}" ya lleva ${aceptados} de ${meta} aportes aceptados. Gracias por participar; compártela para llegar a la meta.`,
      campanaId,
      enlace: `/campanas/${campanaId}`,
      metadata: { hito },
    }),
  );
}

type Invitado = { id: number; state: string | null; city: string | null; participa_en: string; etiqueta: string };

async function enviarRelacionada(campanaId: number): Promise<void> {
  const leida = await pool.query<{
    name: string;
    creator_id: number;
    location_state: string | null;
    location_city: string | null;
    todo_el_pais: boolean;
  }>(
    `SELECT name, creator_id, location_state, location_city, todo_el_pais FROM campanas WHERE id = $1 AND status = 'activa'`,
    [campanaId],
  );
  const campana = leida.rows[0];
  if (!campana) return;

  // Una fila por persona: la campaña más reciente donde participa con una etiqueta en común.
  const r = await pool.query<Invitado>(
    `SELECT DISTINCT ON (u.id) u.id, u.state, u.city, x.name AS participa_en, e.nombre AS etiqueta
       FROM campana_etiquetas cy
       JOIN etiquetas e ON e.id = cy.etiqueta_id AND e.aprobada
       JOIN campana_etiquetas cx ON cx.etiqueta_id = cy.etiqueta_id AND cx.campana_id <> $1
       JOIN campanas x ON x.id = cx.campana_id AND x.status IN ('activa', 'pausada')
       JOIN ${PARTICIPANTES} p ON p.campana_id = x.id
       JOIN usuarios u ON u.id = p.usuario_id
      WHERE cy.campana_id = $1
        AND u.id <> $2
        AND u.avisos_campanas_nuevas
        AND ${PUEDE_RECIBIR}
        AND NOT EXISTS (SELECT 1 FROM ${PARTICIPANTES} ya WHERE ya.campana_id = $1 AND ya.usuario_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM notificaciones n WHERE n.usuario_id = u.id AND n.campana_id = $1
                          AND n.tipo IN ('campana_nueva', 'campana_relacionada'))
      ORDER BY u.id, x.updated_at DESC`,
    [campanaId, campana.creator_id],
  );

  // Vive donde se hace la campaña (como en campana_nueva), salvo que sea para todo el país.
  const estado = claveDeTematica(String(campana.location_state ?? ""));
  const municipio = claveDeTematica(String(campana.location_city ?? ""));
  const cerca = r.rows.filter((p) => {
    if (campana.todo_el_pais) return true;
    if (!estado || claveDeTematica(String(p.state ?? "")) !== estado) return false;
    return !municipio || claveDeTematica(String(p.city ?? "")) === municipio;
  });
  const permitidos = new Set(await dentroDelTope(cerca.map((p) => Number(p.id))));
  const lugar = campana.todo_el_pais
    ? "todo el país"
    : [campana.location_city, campana.location_state].filter((v) => v && String(v).trim()).join(", ");

  await enTandas(
    cerca.filter((p) => permitidos.has(Number(p.id))),
    (p) =>
      notificar({
        usuarioId: Number(p.id),
        tipo: "campana_relacionada",
        titulo: `Otra campaña de ${p.etiqueta}`,
        mensaje: `Como participas en "${p.participa_en}", te puede interesar "${campana.name}"${lugar ? `, que ya recibe aportes en ${lugar}` : ""}.`,
        campanaId,
        enlace: `/campanas/${campanaId}`,
        metadata: { etiqueta: p.etiqueta },
      }),
  );
}
