// Reglas de supervisión de campañas, en un solo lugar: tomar una campaña y dictaminarla
// (aceptada o rechazada, con sanción opcional al creador; "reportada" ya no se puede dar desde el
// 2026-10-16, solo queda en el historial). Las usan PATCH /api/campanas/[id] (supervisor) y
// lib/supervision/acciones-root.ts (SuperUsuario). Notifican al creador y escriben en audit_log.

import { revalidatePath } from "next/cache";

import { pool } from "@/lib/db";
import { hasCampaignStarted } from "@/lib/campaign-date";
import { registrarAuditoria, type ActorDeAuditoria } from "@/lib/auditoria";
import { asegurarEnlaceVigente } from "@/lib/campanas/enlaces";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { avisarCampanaNueva } from "@/lib/notificaciones/campanas-por-interes";
import {
  avisarSancion,
  detalleDeAuditoria,
  errorDeSancionPedida,
  sancionarEnTransaccion,
  type SancionAplicada,
  type SancionPedida,
} from "@/lib/moderacion/sancionar";
import {
  MAXIMO_EXPLICACION_DE_RECHAZO,
  MOTIVOS_DE_RECHAZO_DE_CAMPANA,
  OTRO_MOTIVO,
  textoDelMotivoDeRechazo,
} from "@/lib/reportes/motivos";

export type AccionDeSupervision = "aceptada" | "rechazada";

export const ACCIONES_DE_SUPERVISION = new Set<string>(["aceptada", "rechazada"]);

/**
 * Quién dictamina: un usuario con rol de supervisor (fila de `usuarios`) o el
 * SuperUsuario desde /supervisar, que no tiene fila en `usuarios` (ver
 * lib/rootSession.ts). Por eso lo del SuperUsuario se marca con
 * `campanas.supervisado_por_root` / `campana_supervisores.por_superusuario`
 * en vez de un `supervisor_id`.
 */
export type AutorDeDecision = { tipo: "usuario"; usuarioId: number } | { tipo: "root" };

function actorDeAuditoria(autor: AutorDeDecision): ActorDeAuditoria {
  return autor.tipo === "root" ? { tipo: "superusuario" } : { tipo: "usuario", id: autor.usuarioId };
}

export type ResultadoDeDecision =
  | { ok: true; nextStatus: string; mensaje: string }
  | { ok: false; status: 400 | 403 | 404 | 409 | 500; error: string };

/**
 * Una campaña la supervisa un solo supervisor: quien la toma primero con el
 * botón "Supervisar esta campaña". El UPDATE es atómico (solo pasa si sigue en
 * revisión y sin supervisor), así que si dos la toman a la vez, gana uno.
 * Una vez tomada se queda con ese supervisor, también si el creador la
 * corrige y la reenvía tras un rechazo.
 */
export async function tomarCampanaParaSupervisar(
  campanaId: string | number,
  autor: AutorDeDecision,
): Promise<{ ok: true } | { ok: false; status: 403 | 404 | 409; error: string }> {
  const supervisorId = autor.tipo === "usuario" ? autor.usuarioId : null;
  const porRoot = autor.tipo === "root";

  const tomada = await pool.query(
    `UPDATE campanas
     SET supervisor_id = $2, supervisado_por_root = $3, updated_at = NOW()
     WHERE id = $1
       AND status = 'en_revision'
       AND supervisor_id IS NULL
       AND NOT supervisado_por_root
       AND ($2::int IS NULL OR creator_id <> $2::int)
     RETURNING id`,
    [campanaId, supervisorId, porRoot],
  );
  if (tomada.rowCount !== 0) {
    await registrarAuditoria({
      actor: actorDeAuditoria(autor),
      accion: "supervision.tomar",
      objetivo: { tipo: "campana", id: campanaId },
    });
    return { ok: true };
  }

  // No se pudo: averiguar por qué para dar un mensaje útil.
  const actual = await pool.query(
    `SELECT status, creator_id, supervisor_id, supervisado_por_root FROM campanas WHERE id = $1 LIMIT 1`,
    [campanaId],
  );
  if (actual.rowCount === 0) return { ok: false, status: 404, error: "Campaña no encontrada" };
  const fila = actual.rows[0];

  if (esSuSupervisor(fila, autor)) return { ok: true };
  if (autor.tipo === "usuario" && Number(fila.creator_id) === autor.usuarioId) {
    return { ok: false, status: 403, error: "No puedes supervisar una campaña que creaste" };
  }
  if (fila.supervisor_id != null || fila.supervisado_por_root) {
    return { ok: false, status: 409, error: "Otro supervisor ya está supervisando esta campaña" };
  }
  return { ok: false, status: 409, error: "Solo se pueden tomar campañas en revisión" };
}

function esSuSupervisor(
  fila: { supervisor_id: unknown; supervisado_por_root: unknown },
  autor: AutorDeDecision,
): boolean {
  return autor.tipo === "root"
    ? Boolean(fila.supervisado_por_root)
    : fila.supervisor_id != null && Number(fila.supervisor_id) === autor.usuarioId;
}

/** Lo que llega con el dictamen. Al aceptar no se usa nada; al rechazar, el motivo y la sanción opcional. */
export type EntradaDeDecision = {
  /** Motivo elegido de MOTIVOS_DE_RECHAZO_DE_CAMPANA (lib/reportes/motivos.ts). */
  motivoDeLista?: unknown;
  /** Explicación con palabras propias (antes era el único motivo). */
  motivo?: unknown;
  /** Sanción al creador al rechazar: { tipo: "STRIKE" | "SUSPENSION_TEMPORAL" | "BANEO_DE_CAMPANA", dias? }. */
  sancion?: unknown;
};

/** La sanción pedida, o null si no se pidió. Lo inválido lo rechaza errorDeSancionPedida. */
function leerSancionPedida(valor: unknown): SancionPedida | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as { tipo?: unknown; dias?: unknown };
  if (typeof v.tipo !== "string" || !v.tipo) return null;
  return { tipo: v.tipo as SancionPedida["tipo"], dias: v.dias === undefined ? undefined : Number(v.dias) };
}

/**
 * Aceptar o rechazar una campaña en revisión. "Reportar" ya no existe (2026-10-16, a pedido del usuario):
 * quien supervisa ya puede sancionar, así que al rechazar puede sancionar al creador ahí mismo con un aviso,
 * una suspensión o el baneo. Esa sanción deja un reporte ya resuelto (`origen = 'rechazo'`) que se ve en
 * reportes y sanciones de la supervisión, la del SuperUsuario y la de los supervisores.
 */
export async function registrarDecisionDeCampana(
  campanaId: string | number,
  accion: AccionDeSupervision,
  entrada: EntradaDeDecision,
  autor: AutorDeDecision,
  /**
   * El SuperUsuario no tiene "Supervisar esta campaña" (2026-10-22): si nadie la supervisa, la toma
   * al decidir. La toma va después de validar todo (2026-10-23): antes, un rechazo sin motivo la
   * dejaba tomada por él y ningún supervisor podía tomarla.
   */
  opciones: { tomarSiEstaLibre?: boolean } = {},
): Promise<ResultadoDeDecision> {
  const existing = await pool.query(
    `SELECT id, status, creator_id, name, start_date, start_time, supervisor_id, supervisado_por_root
     FROM campanas WHERE id = $1 LIMIT 1`,
    [campanaId],
  );
  if (existing.rowCount === 0) {
    return { ok: false, status: 404, error: "Campaña no encontrada" };
  }
  const campana = existing.rows[0];

  // Un supervisor puede crear campañas, pero no dictaminar las suyas.
  if (autor.tipo === "usuario" && Number(campana.creator_id) === autor.usuarioId) {
    return { ok: false, status: 403, error: "No puedes supervisar una campaña que creaste" };
  }
  if (!ACCIONES_DE_SUPERVISION.has(accion)) {
    return { ok: false, status: 400, error: "Acción de supervisión inválida" };
  }
  // Aceptar o rechazar solo en revisión (antes no se comprobaba: por la API se podía "rechazar" una activa).
  if (String(campana.status) !== "en_revision") {
    return { ok: false, status: 400, error: "Solo se aceptan o rechazan campañas en revisión" };
  }
  // Solo el supervisor que la tomó dictamina (o quien la toma al decidir, si está libre).
  const tomarAlDecidir =
    opciones.tomarSiEstaLibre === true && campana.supervisor_id == null && !campana.supervisado_por_root;
  if (!esSuSupervisor(campana, autor) && !tomarAlDecidir) {
    return {
      ok: false,
      status: 403,
      error: campana.supervisor_id != null || campana.supervisado_por_root
        ? "Esta campaña la supervisa otro supervisor"
        : "Primero toma la campaña con \"Supervisar esta campaña\"",
    };
  }

  if (accion === "rechazada") return rechazar(campana, entrada, autor, tomarAlDecidir);

  if (tomarAlDecidir) {
    const tomada = await tomarCampanaParaSupervisar(campanaId, autor);
    if (!tomada.ok) return tomada;
  }

  // Aceptada con fecha/hora de inicio futura: el estado de la campaña
  // queda "aceptada" (en_revision -> aceptada -> activa) y se activa sola
  // cuando lleguen (activateScheduledCampaigns); sin fecha definida se
  // activa de inmediato igual que antes.
  const nextStatus = hasCampaignStarted(campana.start_date, campana.start_time) ? "activa" : "aceptada";
  const supervisorId = autor.tipo === "usuario" ? autor.usuarioId : null;
  const porRoot = autor.tipo === "root";

  await pool.query(`UPDATE campanas SET status = $2, updated_at = NOW() WHERE id = $1`, [campanaId, nextStatus]);
  // Aceptada y ya empezó: queda activa con su enlace público listo para compartir.
  // Si queda "aceptada" (inicio futuro), el enlace se crea al activarse (lib/campaign-date.ts).
  if (nextStatus === "activa") {
    await asegurarEnlaceVigente(Number(campanaId));
    // A quien tiene su temática y vive donde se hace (en segundo plano).
    avisarCampanaNueva(Number(campanaId));
  }

  await pool.query(
    `INSERT INTO campana_supervisores (campana_id, supervisor_id, por_superusuario, accion, motivo, created_at)
     VALUES ($1, $2, $3, 'aceptada', NULL, NOW())`,
    [campanaId, supervisorId, porRoot],
  );

  await registrarAuditoria({
    actor: actorDeAuditoria(autor),
    accion: "supervision.dictaminar",
    objetivo: { tipo: "campana", id: campanaId },
    detalle: { accion, motivo: null, estadoAnterior: "en_revision", estadoNuevo: nextStatus },
  });

  await notificar({
    usuarioId: campana.creator_id,
    campanaId,
    metadata: {},
    tipo: "campana_aceptada",
    titulo: "Campaña aceptada",
    mensaje: nextStatus === "activa"
      ? `Tu campaña "${campana.name}" fue aceptada y ya está activa.`
      : `Tu campaña "${campana.name}" fue aceptada. Se activará en su fecha de inicio.`,
    enlace: nextStatus === "activa" ? `/mis-campanas/${campanaId}/panel` : "/mis-campanas",
  });

  return {
    ok: true,
    nextStatus,
    mensaje: nextStatus === "activa"
      ? "Campaña aceptada y puesta en activo"
      : "Campaña aceptada; se activará el día de su fecha de inicio",
  };
}

/**
 * Rechazo, con sanción opcional al creador, en una sola transacción: estado, historial de dictámenes,
 * la sanción (lib/moderacion/sancionar.ts) y su reporte ya resuelto. Si algo falla, no queda nada a medias.
 */
async function rechazar(
  campana: { id: number; creator_id: number; name: string },
  entrada: EntradaDeDecision,
  autor: AutorDeDecision,
  tomarAlDecidir: boolean,
): Promise<ResultadoDeDecision> {
  const lista =String(entrada.motivoDeLista ?? "").trim() || null;
  const explicacion = String(entrada.motivo ?? "").trim() || null;
  if (lista && !MOTIVOS_DE_RECHAZO_DE_CAMPANA.includes(lista)) {
    return { ok: false, status: 400, error: "Motivo de rechazo inválido" };
  }
  if (!lista && !explicacion) {
    return { ok: false, status: 400, error: "El motivo es obligatorio al rechazar una campaña" };
  }
  if (lista === OTRO_MOTIVO && !explicacion) {
    return { ok: false, status: 400, error: "Con «Otro», explica el motivo del rechazo" };
  }
  if (explicacion && explicacion.length > MAXIMO_EXPLICACION_DE_RECHAZO) {
    return { ok: false, status: 400, error: `La explicación no puede pasar de ${MAXIMO_EXPLICACION_DE_RECHAZO} caracteres` };
  }
  const motivo = textoDelMotivoDeRechazo(lista, explicacion);

  const pedida = leerSancionPedida(entrada.sancion);
  const detalleDeSancion = `Campaña "${campana.name}" rechazada por la supervisión. Motivo: ${motivo}`;
  if (pedida) {
    const error = errorDeSancionPedida(pedida, detalleDeSancion);
    if (error) return { ok: false, status: 400, error };
  }

  // Ya validado todo: si se toma al decidir, ahora.
  if (tomarAlDecidir) {
    const tomada = await tomarCampanaParaSupervisar(campana.id, autor);
    if (!tomada.ok) return tomada;
  }

  const supervisorId = autor.tipo === "usuario" ? autor.usuarioId : null;
  const porRoot = autor.tipo === "root";
  let sancion: SancionAplicada | null = null;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Condicional al estado: si otro la cambió mientras tanto, no se rechaza encima.
    const cambiada = await client.query(
      `UPDATE campanas SET status = 'rechazada', updated_at = NOW() WHERE id = $1 AND status = 'en_revision' RETURNING id`,
      [campana.id],
    );
    if (cambiada.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, status: 409, error: "La campaña cambió mientras tanto. Vuelve a cargar la página" };
    }

    await client.query(
      `INSERT INTO campana_supervisores (campana_id, supervisor_id, por_superusuario, accion, motivo, created_at)
       VALUES ($1, $2, $3, 'rechazada', $4, NOW())`,
      [campana.id, supervisorId, porRoot, motivo],
    );

    if (pedida) {
      let firma = "SuperUsuario";
      if (autor.tipo === "usuario") {
        const { rows } = await client.query<{ nombre: string }>(
          `SELECT TRIM(nombre || ' ' || apellidos) AS nombre FROM usuarios WHERE id = $1`,
          [autor.usuarioId],
        );
        firma = `Supervisor: ${rows[0]?.nombre || "Supervisor"}`.slice(0, 120);
      }
      const r = await sancionarEnTransaccion(client, {
        usuarioId: Number(campana.creator_id),
        pedida,
        detalle: detalleDeSancion,
        firma,
      });
      if (!r.ok) {
        await client.query("ROLLBACK");
        return { ok: false, status: 400, error: r.error };
      }
      sancion = r.sancion;

      // El reporte queda resuelto con la sanción: así se ve en reportes (resueltos) y en sanciones de
      // las dos zonas de moderación. Si ese supervisor ya la había reportado, se reutiliza su reporte.
      await client.query(
        `INSERT INTO reportes (tipo, campana_id, reportado_id, reportado_por, por_superusuario, origen,
                               motivo, descripcion, estado, nota_de_resolucion, sancion_id, resuelto_en)
         VALUES ('campana', $1, $2, $3, $4, 'rechazo', $5, $6, 'sancionado', $7, $8, NOW())
         ON CONFLICT (campana_id, reportado_por) WHERE tipo = 'campana'
         DO UPDATE SET estado = 'sancionado', origen = 'rechazo', nota_de_resolucion = EXCLUDED.nota_de_resolucion,
                       sancion_id = EXCLUDED.sancion_id, resuelto_en = NOW()`,
        [
          campana.id,
          campana.creator_id,
          supervisorId,
          porRoot,
          lista && lista !== OTRO_MOTIVO ? lista : null,
          explicacion,
          `Campaña rechazada con sanción. ${motivo}`,
          sancion.sancionId,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error rechazando la campaña", error);
    return { ok: false, status: 500, error: "No se pudo rechazar la campaña" };
  } finally {
    client.release();
  }

  await registrarAuditoria({
    actor: actorDeAuditoria(autor),
    accion: "supervision.dictaminar",
    objetivo: { tipo: "campana", id: campana.id },
    detalle: {
      accion: "rechazada",
      motivo,
      estadoAnterior: "en_revision",
      estadoNuevo: "rechazada",
      ...(sancion ? { sancion: { tipo: sancion.tipo, sancionId: sancion.sancionId } } : {}),
    },
  });

  await notificar({
    usuarioId: campana.creator_id,
    campanaId: campana.id,
    metadata: { motivo },
    tipo: "campana_rechazada",
    titulo: "Campaña rechazada",
    mensaje: `Tu campaña "${campana.name}" fue rechazada. Motivo: ${motivo}`,
    enlace: "/mis-campanas",
  });

  if (sancion) {
    await registrarAuditoria({
      actor: actorDeAuditoria(autor),
      accion: "sancion.aplicar",
      objetivo: { tipo: "usuario", id: Number(campana.creator_id) },
      detalle: { ...detalleDeAuditoria(sancion, detalleDeSancion), campana: Number(campana.id), origen: "rechazo" },
    });
    await avisarSancion(Number(campana.creator_id), sancion, detalleDeSancion);
    // Reportes y sanciones de las dos zonas, y el estado de la cuenta en el directorio del panel.
    revalidatePath("/supervisar", "layout");
    revalidatePath("/supervision", "layout");
    revalidatePath("/usuarios", "layout");
  }

  return {
    ok: true,
    nextStatus: "rechazada",
    mensaje: sancion ? "Campaña rechazada y creador sancionado" : "Campaña rechazada",
  };
}
