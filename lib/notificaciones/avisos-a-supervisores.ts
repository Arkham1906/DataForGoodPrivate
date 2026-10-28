// Avisos a los supervisores en la campana de notificaciones (2026-10-15, a pedido del usuario). Antes un
// reporte solo subía un contador junto a "Supervisión" en el menú (ya quitado), sin decir de qué se trataba,
// y una campaña por revisar no avisaba de ninguna forma.
//   - reporte_nuevo: un reporte de campaña o de aporte (reportarCampana y reportarParticipante de
//     lib/reportes/reportes.ts) o "Reportar a supervisión" del revisor (lib/aportes/reporte.ts).
//     Lleva a /supervision/reportes.
//   - campana_por_revisar: una campaña entra a revisión (el creador la envía desde POST, PUT o PATCH de
//     /api/campanas, o el SuperUsuario revierte una decisión y la regresa a la fila con revertirAccion).
//     Lleva a /supervision/[id], donde se toma.
//   - campana_editada (2026-10-22): el creador editó su campaña pausada. Solo al supervisor que la
//     supervisa (si la supervisa el SuperUsuario, queda en la bitácora). Lleva a /supervision/[id].
// A cada usuario con rol de supervisor, verificado, sin bloqueo ni baja pedida, menos las cuentas de
// `excluir` (quien reportó y la persona reportada; el creador de la campaña). El SuperUsuario no tiene
// cuenta de usuario: ve todo en /supervisar. Se envían en segundo plano, de 10 en 10.

import { pool } from "@/lib/db";
import { SQL_SANCION_BLOQUEANTE } from "@/lib/sanciones";
import { notificar, type NuevaNotificacion } from "./notificaciones";

const TAMANO_DE_TANDA = 10;

type Aviso = Omit<NuevaNotificacion, "usuarioId">;

/** Manda `aviso` a los supervisores sin hacer esperar a quien originó el evento. */
function avisarASupervisores(excluir: number[], crearAviso: () => Promise<Aviso | null>): void {
  void enviar(excluir, crearAviso).catch((error) => console.error("Error avisando a los supervisores", error));
}

async function enviar(excluir: number[], crearAviso: () => Promise<Aviso | null>): Promise<void> {
  const supervisores = await pool.query<{ id: number }>(
    `SELECT u.id FROM usuarios u
      WHERE u.role @> '["supervisor"]'::jsonb
        AND u.id <> ALL($1::int[])
        AND u.email_verificado
        AND u.eliminada_en IS NULL AND u.baja_solicitada_en IS NULL
        AND NOT ${SQL_SANCION_BLOQUEANTE}`,
    [excluir.filter((id) => Number.isFinite(id))],
  );
  const ids = supervisores.rows.map((f) => Number(f.id));
  if (ids.length === 0) return;
  const aviso = await crearAviso();
  if (!aviso) return;

  for (let i = 0; i < ids.length; i += TAMANO_DE_TANDA) {
    await Promise.all(ids.slice(i, i + TAMANO_DE_TANDA).map((usuarioId) => notificar({ ...aviso, usuarioId })));
  }
}

async function nombreDeCampana(campanaId: number): Promise<string | null> {
  const { rows } = await pool.query<{ name: string }>(`SELECT name FROM campanas WHERE id = $1`, [campanaId]);
  return rows[0]?.name ?? null;
}

/** Un reporte nuevo de campaña o de aporte. */
export function avisarReporteASupervisores(reporte: {
  tipo: "campana" | "aporte";
  campanaId: number;
  aporteId?: number;
  reportadoId: number;
  reportadoPor: number;
  motivo: string | null;
  /** Otras cuentas que no deben recibirlo (p. ej. el creador de la campaña, si reporta un revisor). */
  excluir?: number[];
}): void {
  avisarASupervisores([reporte.reportadoId, reporte.reportadoPor, ...(reporte.excluir ?? [])], async () => {
    const nombre = (await nombreDeCampana(reporte.campanaId)) ?? "una campaña";
    const motivo = reporte.motivo && reporte.motivo.length > 120 ? `${reporte.motivo.slice(0, 117)}…` : reporte.motivo;
    const porque = motivo ? ` por "${motivo}"` : "";
    return {
      tipo: "reporte_nuevo",
      titulo: reporte.tipo === "campana" ? "Nuevo reporte de una campaña" : "Nuevo reporte de un aporte",
      mensaje:
        reporte.tipo === "campana"
          ? `Reportaron la campaña "${nombre}"${porque}. Revísalo en Reportes de supervisión.`
          : `Reportaron a quien envió un aporte a "${nombre}"${porque}. Revísalo en Reportes de supervisión.`,
      campanaId: reporte.campanaId,
      enlace: "/supervision/reportes",
      metadata: { reporte: reporte.tipo, ...(reporte.aporteId ? { aporteId: reporte.aporteId } : {}) },
    };
  });
}

/**
 * Una campaña entró a revisión. `otraVez`: ya había pasado por revisión (la reenvió tras un rechazo o el
 * SuperUsuario revirtió una decisión). `excluir`: además del creador (p. ej. el supervisor revertido, que
 * ya recibe supervision_revertida).
 */
export function avisarCampanaPorRevisar(campana: { id: number; creadorId: number; otraVez?: boolean; excluir?: number[] }): void {
  avisarASupervisores([campana.creadorId, ...(campana.excluir ?? [])], async () => {
    // Sigue en revisión y sin supervisor (si alguien ya la tomó, no hace falta avisar).
    const { rows } = await pool.query<{ name: string }>(
      `SELECT name FROM campanas WHERE id = $1 AND status = 'en_revision' AND supervisor_id IS NULL AND NOT COALESCE(supervisado_por_root, false)`,
      [campana.id],
    );
    if (!rows[0]) return null;
    return {
      tipo: "campana_por_revisar",
      titulo: campana.otraVez ? "Una campaña vuelve a revisión" : "Nueva campaña por revisar",
      mensaje: `"${rows[0].name}" espera a que un supervisor la tome y la revise.`,
      campanaId: campana.id,
      enlace: `/supervision/${campana.id}`,
    };
  });
}

const NOMBRES_DE_CAMPOS: Record<string, string> = {
  name: "nombre",
  description: "descripción",
  tematica: "temática",
  proposito: "propósito",
  proposito_otro: "propósito",
  etiquetas: "etiquetas",
  data_types: "tipos de dato",
  checklist_secciones: "checklists",
  goal_contributions: "meta",
  quota_per_user: "cuota",
  start_date: "inicio",
  start_time: "inicio",
  end_date: "finalización",
  end_time: "finalización",
  location_state: "ubicación",
  location_city: "ubicación",
  location_colonia: "ubicación",
  todo_el_pais: "ubicación",
};

/** El creador editó su campaña pausada: avisa solo a quien la supervisa (no al creador, si fuera él). */
export function avisarEdicionEnPausa(campana: {
  id: number;
  creadorId: number;
  supervisorId: number | string | null;
  campos: readonly string[];
}): void {
  const supervisorId = Number(campana.supervisorId);
  if (!campana.supervisorId || !Number.isFinite(supervisorId) || supervisorId === campana.creadorId) return;
  void (async () => {
    const nombre = (await nombreDeCampana(campana.id)) ?? "una campaña";
    const cambios = [...new Set(campana.campos.map((c) => NOMBRES_DE_CAMPOS[c] ?? c))];
    const lista = cambios.length > 1 ? `${cambios.slice(0, -1).join(", ")} y ${cambios.at(-1)}` : cambios[0];
    await notificar({
      usuarioId: supervisorId,
      tipo: "campana_editada",
      titulo: "Editaron una campaña pausada",
      mensaje: `Quien organiza "${nombre}" cambió ${lista} mientras está pausada. Revisa que siga en regla.`,
      campanaId: campana.id,
      enlace: `/supervision/${campana.id}`,
      metadata: { campos: cambios },
    });
  })().catch((error) => console.error("Error avisando la edición de una campaña pausada", error));
}
