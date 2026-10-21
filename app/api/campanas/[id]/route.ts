// /api/campanas/[id] — detalle, edición y supervisión de una campaña.
// El PATCH tiene cuatro usos según el body: { action: "tomar" }, dictamen del supervisor
// ({ action: "aceptada" | "rechazada", motivoDeLista, motivo, sancion }; "reportada" ya no, desde el
// 2026-10-16), cambio de estado del supervisor
// ({ action: "pausar" | "reanudar" | "finalizar", motivo }) o edición del creador.

import { NextResponse } from "next/server";
import { especialDesdeFila } from "@/lib/campanas/especial";
import { avisarCampanaEspecial } from "@/lib/notificaciones/campanas-por-interes";
import { avisarCampanaPorRevisar } from "@/lib/notificaciones/avisos-a-supervisores";
import {
  ESTADOS_CON_EDICION_COMPLETA,
  MAX_CAMPANAS_ACTIVAS as MAX_ACTIVE_CAMPAIGNS,
  errorDeEstadoPedido,
} from "@/lib/campanas/estado-del-creador";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { ACCIONES_DE_SUPERVISION, registrarDecisionDeCampana, tomarCampanaParaSupervisar, type AccionDeSupervision } from "@/lib/supervision/decision";
import { CAMBIOS_DE_ESTADO_POR_SUPERVISION, cambiarEstadoPorSupervision, type CambioDeEstadoPorSupervision } from "@/lib/supervision/estado-por-supervision";
import { pausaDesdeFila } from "@/lib/campanas/pausa";
import { condicionDeVisibilidad } from "@/lib/campanas/visibilidad";
import { normalizarSecciones, seccionesDesdeFila } from "@/lib/campanas/checklist";
import { asegurarEnlaceVigente } from "@/lib/campanas/enlaces";
import { errorDeOrganizacion } from "@/lib/campanas/organizacion";
import { activateScheduledCampaigns, calculateCampaignDaysRemaining, errorDeFinAntesDeInicio, errorDeInicioPasado, finalizeExpiredCampaigns, hasCampaignEnded, normalizeCampaignDate, normalizeCampaignTime } from "@/lib/campaign-date";

function normalizeDataTypes(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const allowed = new Set(["texto", "foto", "video", "audio", "documento"]);
  return input
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter((item) => allowed.has(item));
}

const ALLOWED_STATUS = new Set([
  "borrador",
  "en_revision",
  "aceptada",
  "activa",
  "pausada",
  "finalizada",
  "rechazada",
]);


function normalizeCampaignStatus(input: unknown): string | null {
  const value = String(input ?? "").trim().toLowerCase();
  return ALLOWED_STATUS.has(value) ? value : null;
}

function normalizeChecklistOpciones(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((item) => String(item ?? "").trim())
        .filter((item) => item.length > 0 && item.length <= 120)
    )
  ).slice(0, 20);
}

function mapCampaign(row: Record<string, unknown>) {
  const dataTypes = Array.isArray(row.data_types) ? row.data_types : [];
  const checklistOpciones = Array.isArray(row.checklist_opciones) ? row.checklist_opciones : [];
  const aportes = Array.isArray(row.aportes) ? row.aportes : [];

  return {
    id: String(row.id ?? ""),
    creatorId: String(row.creator_id ?? ""),
    creatorName: String(row.creator_name ?? ""),
    supervisorId: row.supervisor_id != null ? String(row.supervisor_id) : null,
    supervisedByRoot: Boolean(row.supervisado_por_root),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    tematica: String(row.tematica ?? row.tag ?? ""),
    tag: String(row.tag ?? String(row.tematica ?? "")),
    status: String(row.status ?? "borrador"),
    dataTypes,
    collectionMode: String(row.collection_mode ?? "checklist"),
    checklistOpciones,
    checklistSecciones: seccionesDesdeFila(row),
    goalContributions: Number(row.goal_contributions ?? 0),
    quotaPerUser: Number(row.quota_per_user ?? 0),
    currentContributions: Number(row.current_contributions ?? 0),
    approvedContributions: Number(row.approved_contributions ?? 0),
    pendingContributions: Number(row.pending_contributions ?? 0),
    rejectedContributions: Number(row.rejected_contributions ?? 0),
    participants: Number(row.participants ?? 0),
    startDate: normalizeCampaignDate(row.start_date),
    startTime: normalizeCampaignTime(row.start_time),
    endDate: normalizeCampaignDate(row.end_date),
    endTime: normalizeCampaignTime(row.end_time),
    locationCity: String(row.location_city ?? ""),
    locationState: String(row.location_state ?? ""),
    locationColonia: String(row.location_colonia ?? ""),
    organizer: String(row.organizer ?? ""),
    xpPerContribution: Number(row.xp_per_contribution ?? 0),
    isSpecial: Boolean(row.is_special),
    especial: especialDesdeFila(row),
    pausa: pausaDesdeFila(row),
    daysRemaining: calculateCampaignDaysRemaining(row.end_date ?? row.endDate),
    hasReviewerAssigned: Boolean(row.has_reviewer_assigned),
    shareToken: String(row.share_token ?? ""),
    shareTokenExpiresAt: row.share_token_expires_at ? new Date(row.share_token_expires_at as string).toISOString() : undefined,
    contributions: aportes,
  };
}

// GET: detalle de una campaña + viewer.isCreator. Pública solo si está activa, pausada o
// finalizada; en otro estado, solo para quien puede verla (lib/campanas/visibilidad.ts) y 404 al resto.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();

    await activateScheduledCampaigns();
    await finalizeExpiredCampaigns();

    const visible = await condicionDeVisibilidad(user, "campanas", 2);
    const result = await pool.query(`SELECT * FROM campanas WHERE id = $1 AND ${visible.sql} LIMIT 1`, [id, ...visible.params]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    const campaign = mapCampaign(result.rows[0]);
    return NextResponse.json({ data: campaign, viewer: { isCreator: user ? campaign.creatorId === String(user.id) : false } });
  } catch (error) {
    console.error("Error obteniendo campaña", error);
    return NextResponse.json({ error: "No se pudo obtener la campaña" }, { status: 500 });
  }
}

// Actualización parcial (Insomnia: PATCH { "status": "activa" }, o cualquier subconjunto de campos editables)
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const accion = String(body.action ?? body.accion ?? "").trim().toLowerCase();

    // "Supervisar esta campaña": la toma en exclusiva para este supervisor.
    if (accion === "tomar") {
      const roles = Array.isArray(user.role) ? user.role : typeof user.role === "string" ? [user.role] : [];
      if (!roles.includes("supervisor")) {
        return NextResponse.json({ error: "Solo un supervisor puede supervisar campañas" }, { status: 403 });
      }

      const resultado = await tomarCampanaParaSupervisar(id, { tipo: "usuario", usuarioId: Number(user.id) });
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.error }, { status: resultado.status });
      }

      const updated = await pool.query(`SELECT * FROM campanas WHERE id = $1 LIMIT 1`, [id]);
      return NextResponse.json({ message: "Ahora supervisas esta campaña", data: mapCampaign(updated.rows[0]) });
    }

    // "Reportar" se quitó de la supervisión (2026-10-16): sin esto caería en la edición del creador (403 confuso).
    if (accion === "reportada") {
      return NextResponse.json(
        { error: "Reportar ya no existe en la supervisión: al rechazar puedes sancionar al creador" },
        { status: 400 },
      );
    }

    if (ACCIONES_DE_SUPERVISION.has(accion)) {
      const roles = Array.isArray(user.role) ? user.role : typeof user.role === "string" ? [user.role] : [];
      if (!roles.includes("supervisor")) {
        return NextResponse.json({ error: "Solo un supervisor puede decidir esta campaña" }, { status: 403 });
      }

      // Al rechazar: motivoDeLista y/o motivo (explicación), y sancion opcional al creador (2026-10-16).
      const resultado = await registrarDecisionDeCampana(
        id,
        accion as AccionDeSupervision,
        { motivoDeLista: body.motivoDeLista, motivo: body.motivo ?? body.reason, sancion: body.sancion },
        { tipo: "usuario", usuarioId: Number(user.id) },
      );
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.error }, { status: resultado.status });
      }

      const updated = await pool.query(`SELECT * FROM campanas WHERE id = $1 LIMIT 1`, [id]);
      return NextResponse.json({ message: resultado.mensaje, data: mapCampaign(updated.rows[0]) });
    }

    // Pausar (con motivo), reanudar o finalizar (con motivo) desde /supervision: solo quien la supervisa.
    if (CAMBIOS_DE_ESTADO_POR_SUPERVISION.has(accion)) {
      const roles = Array.isArray(user.role) ? user.role : typeof user.role === "string" ? [user.role] : [];
      if (!roles.includes("supervisor")) {
        return NextResponse.json({ error: "Solo un supervisor puede cambiar el estado de esta campaña" }, { status: 403 });
      }

      const resultado = await cambiarEstadoPorSupervision(id, accion as CambioDeEstadoPorSupervision, body.motivo ?? body.reason, {
        tipo: "usuario",
        usuarioId: Number(user.id),
      });
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.error }, { status: resultado.status });
      }

      const updated = await pool.query(`SELECT * FROM campanas WHERE id = $1 LIMIT 1`, [id]);
      return NextResponse.json({ message: resultado.mensaje, data: mapCampaign(updated.rows[0]) });
    }

    const existing = await pool.query(
      `SELECT creator_id, status, start_date, end_date, end_time, pausa_por FROM campanas WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (existing.rowCount === 0) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    if (Number(existing.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo quien creó la campaña puede editarla" }, { status: 403 });
    }

    const currentStatus = String(existing.rows[0].status ?? "borrador");

    // Reglas de edición por estado: una finalizada es de solo lectura salvo
    // para reactivarla (status: "activa", con cupo libre de campañas activas);
    // activa, pausada y aceptada solo dejan tocar meta y fecha de fin (sin
    // cambiar su estado); borrador, en_revision y rechazada se editan por
    // completo.
    if (currentStatus === "finalizada") {
      const reactiva = normalizeCampaignStatus(body.status) === "activa";
      if (!reactiva) {
        return NextResponse.json({ error: "Una campaña finalizada es de solo lectura y no se puede editar" }, { status: 403 });
      }

      const camposPermitidos = new Set(["status", "endDate", "end_date", "endTime", "end_time"]);
      const camposNoPermitidos = Object.keys(body).filter((key) => !camposPermitidos.has(key));
      if (camposNoPermitidos.length > 0) {
        return NextResponse.json(
          { error: "Al reactivar una campaña solo puedes ajustar su fecha/hora de finalización" },
          { status: 400 }
        );
      }

      const activas = await pool.query(
        `SELECT COUNT(*)::int AS count FROM campanas WHERE creator_id = $1 AND status = 'activa'`,
        [user.id]
      );
      if (Number(activas.rows[0].count) >= MAX_ACTIVE_CAMPAIGNS) {
        return NextResponse.json(
          { error: `Ya tienes ${MAX_ACTIVE_CAMPAIGNS} campañas activas; pausa o finaliza otra antes de reactivar esta` },
          { status: 400 }
        );
      }

      // Una campaña llega aquí finalizada casi siempre porque su fecha/hora
      // de fin ya se cumplió (finalizeExpiredCampaigns). Si se reactiva sin
      // mover esa fecha, la siguiente lectura de /api/campanas la vuelve a
      // finalizar de inmediato: hay que exigir una fecha de fin nueva y
      // futura (o dejarla pasar solo si la que ya tenía no cambia por otro
      // motivo, ej. se finalizó a mano antes de tiempo).
      const nuevaEndDate =
        "endDate" in body || "end_date" in body
          ? normalizeCampaignDate(body.endDate ?? body.end_date)
          : normalizeCampaignDate(existing.rows[0].end_date);
      if (("endDate" in body || "end_date" in body) && !nuevaEndDate) {
        return NextResponse.json({ error: "La fecha de finalización no es válida" }, { status: 400 });
      }

      const nuevaEndTime =
        "endTime" in body || "end_time" in body
          ? normalizeCampaignTime(body.endTime ?? body.end_time)
          : normalizeCampaignTime(existing.rows[0].end_time);

      const startDateExistente = normalizeCampaignDate(existing.rows[0].start_date);
      if (startDateExistente && nuevaEndDate && nuevaEndDate < startDateExistente) {
        return NextResponse.json({ error: "La fecha de finalización no puede ser anterior a la de inicio" }, { status: 400 });
      }

      if (hasCampaignEnded(nuevaEndDate, nuevaEndTime)) {
        return NextResponse.json(
          { error: "Para reactivar la campaña, indica una nueva fecha/hora de finalización posterior a ahora" },
          { status: 400 }
        );
      }
      // Cae al UPDATE genérico de abajo, que aplica status = "activa" y,
      // si llegaron, endDate/endTime.
    }

    if (currentStatus === "activa" || currentStatus === "pausada") {
      // El creador puede finalizarla, pausarla (activa) o reanudarla (pausada)
      // desde /mis-campanas, sin tocar ningún otro campo a la vez.
      const pedido = Object.keys(body).length === 1 ? normalizeCampaignStatus(body.status) : null;
      const cambiaEstado =
        pedido === "finalizada" ||
        (currentStatus === "activa" && pedido === "pausada") ||
        (currentStatus === "pausada" && pedido === "activa");
      if (pedido === "activa" && cambiaEstado) {
        // La que pausó la supervisión (2026-10-15) solo la reanuda la supervisión.
        if (existing.rows[0].pausa_por === "supervision") {
          return NextResponse.json(
            { error: "La supervisión pausó esta campaña; solo la supervisión puede reanudarla" },
            { status: 403 }
          );
        }
        // Reanudar: vuelve a contar para el tope de activas, y si su cierre ya
        // pasó mientras estaba pausada, finalizeExpiredCampaigns la cerraría
        // en la siguiente lectura.
        if (hasCampaignEnded(normalizeCampaignDate(existing.rows[0].end_date), normalizeCampaignTime(existing.rows[0].end_time))) {
          return NextResponse.json(
            { error: "La fecha de cierre ya pasó. Edita la campaña y pon una nueva antes de reanudarla" },
            { status: 400 }
          );
        }
        const activas = await pool.query(
          `SELECT COUNT(*)::int AS count FROM campanas WHERE creator_id = $1 AND status = 'activa'`,
          [user.id]
        );
        if (Number(activas.rows[0].count) >= MAX_ACTIVE_CAMPAIGNS) {
          return NextResponse.json(
            { error: `Ya tienes ${MAX_ACTIVE_CAMPAIGNS} campañas activas; pausa o finaliza otra antes de reanudar esta` },
            { status: 400 }
          );
        }
      }
      if (!cambiaEstado) {
        if (pedido) {
          return NextResponse.json({ error: "Ese cambio de estado no está permitido para esta campaña" }, { status: 400 });
        }
        const camposPermitidos = new Set(["goalContributions", "goal_contributions", "endDate", "end_date", "endTime", "end_time"]);
        const camposNoPermitidos = Object.keys(body).filter((key) => !camposPermitidos.has(key));
        if (camposNoPermitidos.length > 0) {
          return NextResponse.json(
            { error: "Con la campaña activa o pausada solo puedes editar la meta de aportes y la fecha/hora de finalización" },
            { status: 400 }
          );
        }
      }
    }

    if (currentStatus === "aceptada") {
      // Ya la aprobó el supervisor pero todavía no empieza: igual que activa
      // o pausada, solo se ajusta la meta de aportes y la fecha/hora de fin.
      // No tiene el atajo de "finalizar" porque aún no arrancó a recolectar.
      const camposPermitidos = new Set(["goalContributions", "goal_contributions", "endDate", "end_date", "endTime", "end_time"]);
      const camposNoPermitidos = Object.keys(body).filter((key) => !camposPermitidos.has(key));
      if (camposNoPermitidos.length > 0) {
        return NextResponse.json(
          { error: "Con la campaña aceptada solo puedes editar la meta de aportes y la fecha/hora de finalización" },
          { status: 400 }
        );
      }
    }

    if ("status" in body && normalizeCampaignStatus(body.status) === null) {
      return NextResponse.json({ error: `status debe ser uno de: ${Array.from(ALLOWED_STATUS).join(", ")}` }, { status: 400 });
    }
    // Borrador, en revisión o rechazada: el creador solo la guarda o la (re)envía a revisión.
    // Antes aceptaba cualquier estado, y un PATCH { status: "activa" } se saltaba al supervisor.
    if ("status" in body && ESTADOS_CON_EDICION_COMPLETA.has(currentStatus)) {
      const errorDeEstado = await errorDeEstadoPedido(String(normalizeCampaignStatus(body.status)), user.id);
      if (errorDeEstado) return NextResponse.json({ error: errorDeEstado }, { status: 400 });
    }

    const name = "name" in body ? String(body.name ?? "").trim() : null;
    const description = "description" in body ? String(body.description ?? "").trim() : null;
    const tematica = "tematica" in body || "tag" in body ? String(body.tematica ?? body.tag ?? "").trim() : null;
    const status = "status" in body ? normalizeCampaignStatus(body.status) : null;
    const dataTypes = "dataTypes" in body || "data_types" in body ? normalizeDataTypes(body.dataTypes ?? body.data_types) : null;
    // Checklists con título. Un cliente viejo que manda la lista plana
    // checklistOpciones la guarda como un solo checklist titulado "Checklist".
    const traeSecciones = "checklistSecciones" in body || "checklist_secciones" in body;
    const traeLegado = "checklistOpciones" in body || "checklist_opciones" in body;
    let checklistSecciones: ReturnType<typeof normalizarSecciones> | null = null;
    if (traeSecciones || traeLegado) {
      checklistSecciones = normalizarSecciones(
        traeSecciones
          ? body.checklistSecciones ?? body.checklist_secciones
          : [{ titulo: "Checklist", opciones: normalizeChecklistOpciones(body.checklistOpciones ?? body.checklist_opciones) }]
      );
      if (!checklistSecciones.ok) {
        return NextResponse.json({ error: checklistSecciones.error }, { status: 400 });
      }
    }
    const seccionesNuevas = checklistSecciones?.ok ? checklistSecciones.secciones : null;
    // Columnas anteriores a las secciones: se dejan coherentes para quien aún las lea.
    const collectionMode = seccionesNuevas ? (seccionesNuevas.length > 0 ? "checklist" : "texto_libre") : null;
    const checklistOpciones = seccionesNuevas ? [] : null;
    const goalContributions = "goalContributions" in body || "goal_contributions" in body ? Number(body.goalContributions ?? body.goal_contributions) : null;
    const quotaPerUser = "quotaPerUser" in body || "quota_per_user" in body ? Number(body.quotaPerUser ?? body.quota_per_user) : null;
    const startDate = "startDate" in body || "start_date" in body ? normalizeCampaignDate(body.startDate ?? body.start_date) : undefined;
    const startTime = "startTime" in body || "start_time" in body ? normalizeCampaignTime(body.startTime ?? body.start_time) : undefined;
    const endDate = "endDate" in body || "end_date" in body ? normalizeCampaignDate(body.endDate ?? body.end_date) : undefined;
    const endTime = "endTime" in body || "end_time" in body ? normalizeCampaignTime(body.endTime ?? body.end_time) : undefined;
    const locationCity = "locationCity" in body || "location_city" in body ? String(body.locationCity ?? body.location_city ?? "").trim() : null;
    const locationState = "locationState" in body || "location_state" in body ? String(body.locationState ?? body.location_state ?? "").trim() : null;
    // Sin municipio la campaña abarca todo el estado, y la colonia no aplica.
    const locationColonia = locationCity === ""
      ? ""
      : "locationColonia" in body || "location_colonia" in body ? String(body.locationColonia ?? body.location_colonia ?? "").trim() : null;
    const organizer = "organizer" in body ? String(body.organizer ?? "").trim() : null;
    const errorOrganizacion = errorDeOrganizacion(organizer);
    if (errorOrganizacion) return NextResponse.json({ error: errorOrganizacion }, { status: 400 });
    // El XP y "revisor asignado" no los cambia el creador (lib/campanas/estado-del-creador.ts):
    // has_reviewer_assigned lo pone aceptar la invitación de revisor.
    const xpPerContribution = null;
    const hasReviewerAssigned = null;

    // Igual que en POST/PUT: un borrador puede quedar incompleto, pero si
    // esta edición manda (o deja) la campaña en cualquier otro estado, cada
    // campo importante que sí llegó en el body debe ser válido. No revisamos
    // los campos que no llegaron: ya deberían ser válidos desde que se creó.
    const effectiveStatus = status ?? currentStatus;
    // La fecha de inicio no puede quedar antes de hoy (día de Tepic): ni la que llega,
    // ni la que ya tenía si se envía a revisión. Solo donde se edita todo: activa,
    // pausada y aceptada ya no cambian el inicio.
    if (ESTADOS_CON_EDICION_COMPLETA.has(currentStatus)) {
      const inicioQueQueda =
        startDate !== undefined ? startDate : effectiveStatus !== "borrador" ? normalizeCampaignDate(existing.rows[0].start_date) : null;
      const errorDeInicio = errorDeInicioPasado(inicioQueQueda);
      if (errorDeInicio) {
        return NextResponse.json({ error: errorDeInicio }, { status: 400 });
      }
    }
    // En cualquier estado y también en borrador, la campaña no termina antes de empezar.
    // Si solo llega una de las fechas, se compara con la que ya tenía guardada. Sin fechas
    // no se revisa: pausar o finalizar una campaña vieja con datos raros no debe fallar.
    const traeFechas = startDate !== undefined || endDate !== undefined;
    const errorDeVigencia = traeFechas && errorDeFinAntesDeInicio(
      startDate !== undefined ? startDate : normalizeCampaignDate(existing.rows[0].start_date),
      endDate !== undefined ? endDate : normalizeCampaignDate(existing.rows[0].end_date)
    );
    if (errorDeVigencia) {
      return NextResponse.json({ error: errorDeVigencia }, { status: 400 });
    }
    if (effectiveStatus !== "borrador") {
      if (dataTypes !== null && dataTypes.length === 0) {
        return NextResponse.json({ error: "Selecciona al menos un tipo de dato" }, { status: 400 });
      }
      if (goalContributions !== null && (!goalContributions || goalContributions <= 0)) {
        return NextResponse.json({ error: "La meta de aportes debe ser mayor a 0" }, { status: 400 });
      }
      if (quotaPerUser !== null && (!quotaPerUser || quotaPerUser <= 0)) {
        return NextResponse.json({ error: "La cuota por persona debe ser mayor a 0" }, { status: 400 });
      }
      if (startDate !== undefined && !startDate) {
        return NextResponse.json({ error: "La fecha de inicio es obligatoria" }, { status: 400 });
      }
      if (endDate !== undefined && !endDate) {
        return NextResponse.json({ error: "La fecha de finalización es obligatoria" }, { status: 400 });
      }
      if (locationState !== null && !locationState) {
        return NextResponse.json({ error: "Selecciona un estado" }, { status: 400 });
      }
    }

    const result = await pool.query(
      `UPDATE campanas SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        tematica = COALESCE($4, tematica),
        tag = COALESCE($4, tag),
        status = COALESCE($5, status),
        data_types = COALESCE($6::jsonb, data_types),
        goal_contributions = COALESCE($7, goal_contributions),
        quota_per_user = COALESCE($8, quota_per_user),
        start_date = COALESCE($9, start_date),
        end_date = COALESCE($10, end_date),
        location_city = COALESCE($11, location_city),
        location_state = COALESCE($12, location_state),
        location_colonia = COALESCE($13, location_colonia),
        organizer = COALESCE($14, organizer),
        xp_per_contribution = COALESCE($15, xp_per_contribution),
        has_reviewer_assigned = COALESCE($16, has_reviewer_assigned),
        collection_mode = COALESCE($17, collection_mode),
        checklist_opciones = COALESCE($18::jsonb, checklist_opciones),
        start_time = COALESCE($19, start_time),
        end_time = COALESCE($20, end_time),
        checklist_secciones = COALESCE($21::jsonb, checklist_secciones),
        -- La pausó el creador (sin motivo). "status" a la derecha es el estado anterior.
        pausa_por = CASE WHEN $5 = 'pausada' AND status <> 'pausada' THEN 'creador' ELSE pausa_por END,
        pausa_motivo = CASE WHEN $5 = 'pausada' AND status <> 'pausada' THEN NULL ELSE pausa_motivo END,
        pausada_en = CASE WHEN $5 = 'pausada' AND status <> 'pausada' THEN NOW() ELSE pausada_en END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        name || null,
        description || null,
        tematica || null,
        status,
        dataTypes ? JSON.stringify(dataTypes) : null,
        goalContributions,
        quotaPerUser,
        startDate === undefined ? null : startDate,
        endDate === undefined ? null : endDate,
        locationCity,
        locationState,
        locationColonia,
        organizer,
        xpPerContribution,
        hasReviewerAssigned,
        collectionMode,
        checklistOpciones ? JSON.stringify(checklistOpciones) : null,
        startTime === undefined ? null : startTime,
        endTime === undefined ? null : endTime,
        seccionesNuevas ? JSON.stringify(seccionesNuevas) : null,
      ]
    );

    // Pasó a activa (p. ej. se reactivó una finalizada): genera su enlace público.
    if (result.rows[0].status === "activa" && currentStatus !== "activa") {
      await asegurarEnlaceVigente(Number(id));
      // Se reanudó con incentivos que no se avisaron mientras estaba pausada.
      if (result.rows[0].is_special) avisarCampanaEspecial(Number(id));
    }
    // Entró a revisión (desde borrador o rechazada): avisa a los supervisores.
    if (result.rows[0].status === "en_revision" && currentStatus !== "en_revision") {
      avisarCampanaPorRevisar({ id: Number(id), creadorId: Number(user.id), otraVez: currentStatus === "rechazada" });
    }

    return NextResponse.json({ message: "Campaña actualizada", data: mapCampaign(result.rows[0]) });
  } catch (error) {
    console.error("Error actualizando campaña", error);
    return NextResponse.json({ error: "No se pudo actualizar la campaña" }, { status: 500 });
  }
}

// Reemplazo completo de los campos editables (Insomnia: PUT con el mismo shape que POST /api/campanas)
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const existing = await pool.query(`SELECT creator_id, status FROM campanas WHERE id = $1 LIMIT 1`, [id]);
    if (existing.rowCount === 0) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    if (Number(existing.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo quien creó la campaña puede editarla" }, { status: 403 });
    }
    const estadoAnterior = String(existing.rows[0].status ?? "");
    // El reemplazo completo solo vale donde el PATCH también deja editar todo; si no,
    // un PUT se saltaba las reglas por estado (activa, aceptada, finalizada...).
    if (!ESTADOS_CON_EDICION_COMPLETA.has(estadoAnterior)) {
      return NextResponse.json(
        { error: "Solo se reemplaza por completo una campaña en borrador, en revisión o rechazada" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const tematica = String(body.tematica ?? body.theme ?? body.tag ?? "").trim();
    if (!name || !description || !tematica) {
      return NextResponse.json({ error: "name, description y tematica son obligatorios" }, { status: 400 });
    }

    const status = normalizeCampaignStatus(body.status ?? "borrador");
    if (status === null) {
      return NextResponse.json({ error: `status debe ser uno de: ${Array.from(ALLOWED_STATUS).join(", ")}` }, { status: 400 });
    }
    const errorDeEstado = await errorDeEstadoPedido(status, user.id);
    if (errorDeEstado) return NextResponse.json({ error: errorDeEstado }, { status: 400 });

    const dataTypes = normalizeDataTypes(body.dataTypes ?? body.data_types ?? []);
    const secciones = normalizarSecciones(
      body.checklistSecciones ?? body.checklist_secciones ??
        (Array.isArray(body.checklistOpciones ?? body.checklist_opciones)
          ? [{ titulo: "Checklist", opciones: normalizeChecklistOpciones(body.checklistOpciones ?? body.checklist_opciones) }]
          : [])
    );
    if (!secciones.ok) {
      return NextResponse.json({ error: secciones.error }, { status: 400 });
    }
    const checklistSecciones = secciones.secciones;
    const collectionMode = checklistSecciones.length > 0 ? "checklist" : "texto_libre";
    const checklistOpciones: string[] = [];
    const goalContributions = Number(body.goalContributions ?? body.goal_contributions ?? 0);
    const quotaPerUser = Number(body.quotaPerUser ?? body.quota_per_user ?? 1);
    const startDate = normalizeCampaignDate(body.startDate ?? body.start_date);
    const startTime = normalizeCampaignTime(body.startTime ?? body.start_time);
    const endDate = normalizeCampaignDate(body.endDate ?? body.end_date);
    const endTime = normalizeCampaignTime(body.endTime ?? body.end_time);
    const locationCity = String(body.locationCity ?? body.location_city ?? "").trim();
    const locationState = String(body.locationState ?? body.location_state ?? "").trim();
    // Sin municipio la campaña abarca todo el estado, y la colonia no aplica.
    const locationColonia = locationCity ? String(body.locationColonia ?? body.location_colonia ?? "").trim() : "";
    const organizer = String(body.organizer ?? "").trim();
    const errorOrganizacion = errorDeOrganizacion(organizer);
    if (errorOrganizacion) return NextResponse.json({ error: errorOrganizacion }, { status: 400 });
    // El XP y "revisor asignado" se conservan: no los decide el creador.
    const xpPerContribution = null;
    const hasReviewerAssigned = null;

    const errorDeInicio = errorDeInicioPasado(startDate) ?? errorDeFinAntesDeInicio(startDate, endDate);
    if (errorDeInicio) {
      return NextResponse.json({ error: errorDeInicio }, { status: 400 });
    }

    // Un borrador puede quedar incompleto a propósito; para cualquier otro
    // estado sí se exigen los campos importantes, igual que en POST /api/campanas.
    if (status !== "borrador") {
      if (dataTypes.length === 0) {
        return NextResponse.json({ error: "Selecciona al menos un tipo de dato" }, { status: 400 });
      }
      if (!goalContributions || goalContributions <= 0) {
        return NextResponse.json({ error: "La meta de aportes debe ser mayor a 0" }, { status: 400 });
      }
      if (!quotaPerUser || quotaPerUser <= 0) {
        return NextResponse.json({ error: "La cuota por persona debe ser mayor a 0" }, { status: 400 });
      }
      if (!startDate) {
        return NextResponse.json({ error: "La fecha de inicio es obligatoria" }, { status: 400 });
      }
      if (!endDate) {
        return NextResponse.json({ error: "La fecha de finalización es obligatoria" }, { status: 400 });
      }
      if (!locationState) {
        return NextResponse.json({ error: "Selecciona un estado" }, { status: 400 });
      }
    }

    const result = await pool.query(
      `UPDATE campanas SET
        name = $2,
        description = $3,
        tematica = $4,
        tag = $4,
        status = $5,
        data_types = $6::jsonb,
        goal_contributions = $7,
        quota_per_user = $8,
        start_date = $9,
        end_date = $10,
        location_city = $11,
        location_state = $12,
        location_colonia = $13,
        organizer = $14,
        xp_per_contribution = COALESCE($15::int, xp_per_contribution),
        has_reviewer_assigned = COALESCE($16::boolean, has_reviewer_assigned),
        collection_mode = $17,
        checklist_opciones = $18::jsonb,
        start_time = $19,
        end_time = $20,
        checklist_secciones = $21::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        name,
        description,
        tematica,
        status,
        JSON.stringify(dataTypes),
        goalContributions,
        quotaPerUser,
        startDate,
        endDate,
        locationCity,
        locationState,
        locationColonia,
        organizer,
        xpPerContribution,
        hasReviewerAssigned,
        collectionMode,
        JSON.stringify(checklistOpciones),
        startTime,
        endTime,
        JSON.stringify(checklistSecciones),
      ]
    );

    if (result.rows[0].status === "activa" && estadoAnterior !== "activa") {
      await asegurarEnlaceVigente(Number(id));
    }
    if (result.rows[0].status === "en_revision" && estadoAnterior !== "en_revision") {
      avisarCampanaPorRevisar({ id: Number(id), creadorId: Number(user.id), otraVez: estadoAnterior === "rechazada" });
    }

    return NextResponse.json({ message: "Campaña actualizada", data: mapCampaign(result.rows[0]) });
  } catch (error) {
    console.error("Error reemplazando campaña", error);
    return NextResponse.json({ error: "No se pudo actualizar la campaña" }, { status: 500 });
  }
}
