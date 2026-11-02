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
  CAMPOS_DE_EDICION_LIMITADA,
  CAMPOS_EDITABLES_EN_PAUSA,
  COLUMNAS_AVISADAS_EN_PAUSA,
  ESTADOS_CON_EDICION_COMPLETA,
  MAX_CAMPANAS_ACTIVAS as MAX_ACTIVE_CAMPAIGNS,
  errorDeEstadoPedido,
} from "@/lib/campanas/estado-del-creador";
import { avisarEdicionEnPausa } from "@/lib/notificaciones/avisos-a-supervisores";
import { registrarAuditoria } from "@/lib/auditoria";
import { eliminarCampana } from "@/lib/campanas/eliminar";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { ACCIONES_DE_SUPERVISION, registrarDecisionDeCampana, tomarCampanaParaSupervisar, type AccionDeSupervision } from "@/lib/supervision/decision";
import { CAMBIOS_DE_ESTADO_POR_SUPERVISION, cambiarEstadoPorSupervision, type CambioDeEstadoPorSupervision } from "@/lib/supervision/estado-por-supervision";
import { pausaDesdeFila } from "@/lib/campanas/pausa";
import { condicionDeVisibilidad } from "@/lib/campanas/visibilidad";
import {
  agregarEtiquetas,
  guardarEtiquetasDeCampana,
  nombresDeEtiquetasDeCampana,
  quitarEtiquetasDeOtraTematica,
} from "@/lib/etiquetas/catalogo";
import { hasRootSession } from "@/lib/rootSession";
import { validarProposito } from "@/lib/campanas/proposito";
import { crearPropuestas, revisarTematicaDeCampana } from "@/lib/tematicas/catalogo";
import { normalizarSecciones, seccionesDesdeFila } from "@/lib/campanas/checklist";
import { enviadosPorTipoDesdeFila, limitePorTipoDesdeFila, resolverMetaYLimites } from "@/lib/campanas/limite-por-tipo";
import { cuotaPorTipoDesdeFila, resolverCuotaYMaximos, type CuotaPorTipo } from "@/lib/campanas/cuota-por-tipo";
import { normalizarFormatosDeDocumento } from "@/lib/aportes/archivo";
import { columnasCalculadas, guardarTiposDeCampana } from "@/lib/campanas/tipos-de-campana";
import { guardarChecklists } from "@/lib/campanas/tabla-checklists";
import { asegurarEnlaceVigente } from "@/lib/campanas/enlaces";
import { errorDeOrganizacion } from "@/lib/campanas/organizacion";
import { estaTerminada, sqlEstadoAlTerminar } from "@/lib/campanas/fallida";
import { activateScheduledCampaigns, ahoraEnZona, hoyEnTepic, calculateCampaignDaysRemaining, errorDeFinAntesDeInicio, errorDeInicioPasado, errorDeReanudarAntesDeInicio, finalizeExpiredCampaigns, hasCampaignEnded, normalizeCampaignDate, normalizeCampaignTime } from "@/lib/campaign-date";

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
  // La lista plana de antes de los títulos ya no existe (checklists en tablas desde el 2026-10-30).
  const checklistOpciones: string[] = [];

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
    // Subtemáticas (2026-10-27): las pone agregarEtiquetas antes de mapear.
    etiquetas: Array.isArray(row.etiquetas) ? row.etiquetas : [],
    // ¿Para qué se usarán los datos? (2026-10-27, lib/campanas/proposito.ts).
    proposito: row.proposito ? String(row.proposito) : null,
    propositoOtro: row.proposito_otro ? String(row.proposito_otro) : null,
    status: String(row.status ?? "borrador"),
    dataTypes,
    // Formatos de "Archivo" que acepta (2026-10-28); [] = todos.
    formatosDeDocumento: normalizarFormatosDeDocumento(row.formatos_de_documento),
    collectionMode: String(row.collection_mode ?? "checklist"),
    checklistOpciones,
    checklistSecciones: seccionesDesdeFila(row),
    goalContributions: Number(row.goal_contributions ?? 0),
    quotaPerUser: Number(row.quota_per_user ?? 0),
    // Límite total por tipo de dato (2026-10-28, lib/campanas/limite-por-tipo.ts) y lo enviado de cada uno.
    limitePorTipo: limitePorTipoDesdeFila(row),
    cuotaPorTipo: cuotaPorTipoDesdeFila(row),
    // Aprobada y esperando a que su creador la active (2026-10-31).
    esperaActivacion: row.espera_activacion === true,
    enviadosPorTipo: enviadosPorTipoDesdeFila(row),
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
    todoElPais: row.todo_el_pais === true,
    organizer: String(row.organizer ?? ""),
    xpPerContribution: Number(row.xp_per_contribution ?? 0),
    isSpecial: Boolean(row.is_special),
    especial: especialDesdeFila(row),
    pausa: pausaDesdeFila(row),
    daysRemaining: calculateCampaignDaysRemaining(row.end_date ?? row.endDate),
    hasReviewerAssigned: Boolean(row.has_reviewer_assigned),
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
    const result = await pool.query(`SELECT *, ${columnasCalculadas()} FROM campanas WHERE id = $1 AND ${visible.sql} LIMIT 1`, [id, ...visible.params]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    await agregarEtiquetas(result.rows, user, await hasRootSession());
    const campaign = mapCampaign(result.rows[0]);
    return NextResponse.json({ data: campaign, viewer: { isCreator: user ? campaign.creatorId === String(user.id) : false } });
  } catch (error) {
    console.error("Error obteniendo campaña", error);
    return NextResponse.json({ error: "No se pudo obtener la campaña" }, { status: 500 });
  }
}

// DELETE: el creador elimina su campaña (lib/campanas/eliminar.ts), siempre con body { confirmacion: "<nombre>" }.
// Sin aportes, en cualquier estado; con aportes (2026-10-31), en cualquiera menos finalizada.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[1-9]\d{0,8}$/.test(id)) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const resultado = await eliminarCampana({ campanaId: id, usuarioId: Number(user.id), confirmacion: body?.confirmacion });
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    return NextResponse.json({ message: "Campaña eliminada", aportes: resultado.aportes });
  } catch (error) {
    console.error("Error eliminando campaña", error);
    return NextResponse.json({ error: "No se pudo eliminar la campaña" }, { status: 500 });
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

    // Toma explícita en exclusiva. El dictamen también toma una campaña libre si se elige aceptar/rechazar directamente.
    if (accion === "tomar") {
      const roles = Array.isArray(user.role) ? user.role : typeof user.role === "string" ? [user.role] : [];
      if (!roles.includes("supervisor")) {
        return NextResponse.json({ error: "Solo un supervisor puede supervisar campañas" }, { status: 403 });
      }

      const resultado = await tomarCampanaParaSupervisar(id, { tipo: "usuario", usuarioId: Number(user.id) });
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.error }, { status: resultado.status });
      }

      const updated = await pool.query(`SELECT *, ${columnasCalculadas()} FROM campanas WHERE id = $1 LIMIT 1`, [id]);
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
        { tomarSiEstaLibre: true },
      );
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.error }, { status: resultado.status });
      }

      const updated = await pool.query(`SELECT *, ${columnasCalculadas()} FROM campanas WHERE id = $1 LIMIT 1`, [id]);
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

      const updated = await pool.query(`SELECT *, ${columnasCalculadas()} FROM campanas WHERE id = $1 LIMIT 1`, [id]);
      return NextResponse.json({ message: resultado.mensaje, data: mapCampaign(updated.rows[0]) });
    }

    const existing = await pool.query(
      `SELECT *, ${columnasCalculadas()} FROM campanas WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (existing.rowCount === 0) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    if (Number(existing.rows[0].creator_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo quien creó la campaña puede editarla" }, { status: 403 });
    }

    const currentStatus = String(existing.rows[0].status ?? "borrador");
    const estadoSolicitado = "status" in body ? normalizeCampaignStatus(body.status) : null;
    const enviarRevisionDesdePausa = currentStatus === "pausada" && estadoSolicitado === "en_revision";
    // Pausada con inicio futuro que el creador activa ya (2026-11-01): su inicio se adelanta a ahora (Tepic).
    let inicioAdelantado: { fecha: string; hora: string } | null = null;

    // Reglas de edición por estado: una finalizada es de solo lectura salvo
    // para reactivarla (status: "activa", con cupo libre de campañas activas);
    // activa y aceptada solo dejan tocar meta y fecha de fin (sin cambiar su
    // estado); pausada además casi todo (CAMPOS_EDITABLES_EN_PAUSA, sigue
    // pausada); borrador, en_revision y rechazada se editan por completo.
    // Una fallida (2026-11-01, lib/campanas/fallida.ts) igual: extenderla es reactivarla con un fin nuevo.
    if (estaTerminada(currentStatus)) {
      const reactiva = normalizeCampaignStatus(body.status) === "activa";
      if (!reactiva) {
        return NextResponse.json(
          { error: `Una campaña ${currentStatus === "fallida" ? "fallida" : "finalizada"} es de solo lectura y no se puede editar` },
          { status: 403 }
        );
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
      if (enviarRevisionDesdePausa && existing.rows[0].pausa_por !== "creador") {
        return NextResponse.json(
          { error: "Solo puedes enviar a revisión una campaña que pausaste para editarla" },
          { status: 403 }
        );
      }
      if (enviarRevisionDesdePausa) {
        const errorDeEstado = await errorDeEstadoPedido("en_revision", user.id);
        if (errorDeEstado) return NextResponse.json({ error: errorDeEstado }, { status: 400 });
        const camposRequeridos = [
          "name",
          "description",
          "tematica",
          "proposito",
          "propositoOtro",
          "etiquetas",
          "dataTypes",
          "checklistSecciones",
          "goalContributions",
          "quotaPerUser",
          "startDate",
          "endDate",
          "todoElPais",
          "locationState",
          "locationCity",
          "locationColonia",
        ];
        if (camposRequeridos.some((campo) => !(campo in body))) {
          return NextResponse.json({ error: "Para enviar a revisión, guarda todos los datos de la campaña" }, { status: 400 });
        }
        const camposNoPermitidos = Object.keys(body).filter(
          (key) => key !== "status" && !CAMPOS_EDITABLES_EN_PAUSA.has(key)
        );
        if (camposNoPermitidos.length > 0) {
          return NextResponse.json({ error: "Con la campaña pausada no se cambia la organización" }, { status: 400 });
        }
      }
      // El creador puede finalizarla, pausarla (activa) o reanudarla (pausada)
      // desde /mis-campanas, sin tocar ningún otro campo a la vez. Una pausada
      // cuyo inicio se movió al futuro se programa (2026-10-27): vuelve a
      // "aceptada" y activateScheduledCampaigns la activa a su hora.
      const pedido = Object.keys(body).length === 1 ? normalizeCampaignStatus(body.status) : null;
      const cambiaEstado =
        pedido === "finalizada" ||
        (currentStatus === "activa" && pedido === "pausada") ||
        (currentStatus === "pausada" && (pedido === "activa" || pedido === "aceptada")) ||
        enviarRevisionDesdePausa;
      if ((pedido === "activa" || pedido === "aceptada") && cambiaEstado) {
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
        // Editándola en pausa pudo quedar con inicio futuro: "Activar campaña" (2026-11-01) la activa ya
        // y adelanta su inicio a ahora; "aceptada" la programa para que empiece sola ese día. La que ya
        // empezó se reanuda, no se programa.
        const errorDeInicio = errorDeReanudarAntesDeInicio(existing.rows[0].start_date, existing.rows[0].start_time);
        if (pedido === "activa" && errorDeInicio) {
          const ahora = ahoraEnZona();
          inicioAdelantado = { fecha: hoyEnTepic(), hora: `${String(ahora.hour).padStart(2, "0")}:${String(ahora.minute).padStart(2, "0")}` };
        }
        if (pedido === "aceptada" && !errorDeInicio) {
          return NextResponse.json({ error: "La campaña ya llegó a su fecha de inicio: reanúdala en vez de programarla" }, { status: 400 });
        }
        const activas = await pool.query(
          `SELECT COUNT(*)::int AS count FROM campanas WHERE creator_id = $1 AND status = 'activa'`,
          [user.id]
        );
        if (Number(activas.rows[0].count) >= MAX_ACTIVE_CAMPAIGNS) {
          return NextResponse.json(
            { error: `Ya tienes ${MAX_ACTIVE_CAMPAIGNS} campañas activas; pausa o finaliza otra antes de ${pedido === "aceptada" ? "programar" : "reanudar"} esta` },
            { status: 400 }
          );
        }
      }
      if (!cambiaEstado) {
        if (pedido) {
          return NextResponse.json({ error: "Ese cambio de estado no está permitido para esta campaña" }, { status: 400 });
        }
        const camposPermitidos = currentStatus === "pausada" ? CAMPOS_EDITABLES_EN_PAUSA : CAMPOS_DE_EDICION_LIMITADA;
        const camposNoPermitidos = Object.keys(body).filter((key) => !camposPermitidos.has(key));
        if (camposNoPermitidos.length > 0) {
          return NextResponse.json(
            {
              error:
                currentStatus === "pausada"
                  ? "Con la campaña pausada no se cambia la organización"
                  : "Con la campaña activa solo puedes editar la meta de aportes, el límite por tipo de dato y la fecha/hora de finalización. Páusala para editar lo demás",
            },
            { status: 400 }
          );
        }
      }
    }

    // Activar la aceptada (2026-11-01, a pedido del usuario): se activa sola al llegar su fecha de inicio
    // (activateScheduledCampaigns), pero el creador puede activarla antes. PATCH { status: "activa" } la
    // activa ya: si su inicio era futuro, se adelanta a ahora (hora de Tepic). Antes (2026-10-31) esperaba
    // a que el creador la activara (espera_activacion) y, con inicio futuro, solo se programaba.
    if (currentStatus === "aceptada" && Object.keys(body).length === 1 && normalizeCampaignStatus(body.status) === "activa") {
      if (hasCampaignEnded(normalizeCampaignDate(existing.rows[0].end_date), normalizeCampaignTime(existing.rows[0].end_time))) {
        return NextResponse.json(
          { error: "La fecha de cierre ya pasó. Edita la fecha de finalización antes de activarla" },
          { status: 400 }
        );
      }
      const activas = await pool.query(
        `SELECT COUNT(*)::int AS count FROM campanas WHERE creator_id = $1 AND status = 'activa'`,
        [user.id]
      );
      if (Number(activas.rows[0].count) >= MAX_ACTIVE_CAMPAIGNS) {
        return NextResponse.json(
          { error: `Ya tienes ${MAX_ACTIVE_CAMPAIGNS} campañas activas; pausa o finaliza otra antes de activar esta` },
          { status: 400 }
        );
      }
      const adelantada = !!errorDeReanudarAntesDeInicio(existing.rows[0].start_date, existing.rows[0].start_time);
      const ahora = ahoraEnZona();
      const horaDeAhora = `${String(ahora.hour).padStart(2, "0")}:${String(ahora.minute).padStart(2, "0")}`;
      await pool.query(
        `UPDATE campanas
         SET espera_activacion = false,
             start_date = CASE WHEN $2 THEN $3::date ELSE start_date END,
             start_time = CASE WHEN $2 THEN $4::time ELSE start_time END,
             updated_at = NOW()
         WHERE id = $1`,
        [id, adelantada, hoyEnTepic(), horaDeAhora]
      );
      await activateScheduledCampaigns();
      await registrarAuditoria({
        actor: { tipo: "usuario", id: Number(user.id) },
        accion: "campana.activar",
        objetivo: { tipo: "campana", id },
        detalle: { adelantada, inicioAnterior: adelantada ? normalizeCampaignDate(existing.rows[0].start_date) : undefined },
      });
      const activada = await pool.query(`SELECT *, ${columnasCalculadas()} FROM campanas WHERE id = $1 LIMIT 1`, [id]);
      return NextResponse.json({
        message: activada.rows[0].status === "activa" ? "Campaña activada" : "No se pudo activar la campaña por ahora",
        data: mapCampaign(activada.rows[0]),
      });
    }

    if (currentStatus === "aceptada") {
      // Ya la aprobó el supervisor pero todavía no empieza: igual que activa
      // o pausada, solo se ajusta la meta de aportes y la fecha/hora de fin.
      // No tiene el atajo de "finalizar" porque aún no arrancó a recolectar.
      const camposNoPermitidos = Object.keys(body).filter((key) => !CAMPOS_DE_EDICION_LIMITADA.has(key));
      if (camposNoPermitidos.length > 0) {
        return NextResponse.json(
          { error: "Con la campaña aceptada solo puedes editar la meta de aportes, el límite por tipo de dato y la fecha/hora de finalización" },
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
    let tematica = "tematica" in body || "tag" in body ? String(body.tematica ?? body.tag ?? "").trim() : null;
    let status = "status" in body ? normalizeCampaignStatus(body.status) : null;
    // El creador la finaliza: con menos del 25% de la meta en aprobados queda "fallida" (2026-11-01).
    if (status === "finalizada" && (currentStatus === "activa" || currentStatus === "pausada")) {
      const alTerminar = await pool.query<{ estado: string }>(
        `SELECT ${sqlEstadoAlTerminar("c")} AS estado FROM campanas c WHERE c.id = $1`,
        [id]
      );
      status = alTerminar.rows[0]?.estado ?? "finalizada";
    }
    const dataTypes = "dataTypes" in body || "data_types" in body ? normalizeDataTypes(body.dataTypes ?? body.data_types) : null;
    // Formatos de "Archivo" (2026-10-28): si llegan o cambian los tipos; sin "documento", [].
    const formatosDeDocumento =
      "formatosDeDocumento" in body || dataTypes !== null
        ? (dataTypes ?? (Array.isArray(existing.rows[0].data_types) ? existing.rows[0].data_types.map(String) : [])).includes("documento")
          ? normalizarFormatosDeDocumento("formatosDeDocumento" in body ? body.formatosDeDocumento : existing.rows[0].formatos_de_documento)
          : []
        : null;
    // Checklists con título. Un cliente viejo que manda la lista plana
    // checklistOpciones la guarda como un solo checklist titulado "Checklist".
    const traeSecciones = "checklistSecciones" in body || "checklist_secciones" in body;
    const traeLegado = "checklistOpciones" in body || "checklist_opciones" in body;
    let checklistSecciones: ReturnType<typeof normalizarSecciones> | null = null;
    if (traeSecciones || traeLegado) {
      checklistSecciones = normalizarSecciones(
        traeSecciones
          ? body.checklistSecciones ?? body.checklist_secciones
          : [{ titulo: "Características", opciones: normalizeChecklistOpciones(body.checklistOpciones ?? body.checklist_opciones) }],
        // Si no cambian los tipos, se quedan todos (al mostrarlos solo salen los de tipos que pide).
        dataTypes ?? undefined
      );
      if (!checklistSecciones.ok) {
        return NextResponse.json({ error: checklistSecciones.error }, { status: 400 });
      }
    }
    const seccionesNuevas = checklistSecciones?.ok ? checklistSecciones.secciones : null;
    const collectionMode = seccionesNuevas ? (seccionesNuevas.length > 0 ? "checklist" : "texto_libre") : null;
    // Meta por tipo de dato o meta general (2026-10-28, lib/campanas/limite-por-tipo.ts), con los tipos
    // que van a quedar. Por tipo, la meta es la suma de los límites.
    let limitePorTipo: { limite: Record<string, number> | null; metaDeLaSuma: number | null } | null = null;
    if ("limitePorTipo" in body || "metaPorTipo" in body) {
      const tiposQueQuedan = dataTypes ?? (Array.isArray(existing.rows[0].data_types) ? existing.rows[0].data_types.map(String) : []);
      const validado = resolverMetaYLimites(body, tiposQueQuedan, (status ?? currentStatus) !== "borrador");
      if (!validado.ok) return NextResponse.json({ error: validado.error }, { status: 400 });
      limitePorTipo = validado;
    }
    const goalContributions =
      limitePorTipo?.metaDeLaSuma ??
      ("goalContributions" in body || "goal_contributions" in body ? Number(body.goalContributions ?? body.goal_contributions) : null);
    let quotaPerUser = "quotaPerUser" in body || "quota_per_user" in body ? Number(body.quotaPerUser ?? body.quota_per_user) : null;
    // Máximo por persona de cada tipo (2026-10-31, lib/campanas/cuota-por-tipo.ts), con los tipos y la cuota
    // que van a quedar. Con meta por tipo y los máximos en el body, la cuota es su suma; con meta general
    // (metaPorTipo: false) no hay máximos y se borran. Sin ninguno de los dos, los máximos no cambian (una
    // activa manda metaPorTipo con los límites, pero no la cuota).
    let cuotaPorTipo: CuotaPorTipo | null | undefined; // undefined = no cambia
    if ("cuotaPorTipo" in body || body.metaPorTipo === false) {
      const porTipo = body.metaPorTipo === true && "cuotaPorTipo" in body;
      const validado = resolverCuotaYMaximos({
        porTipo,
        maximos: "cuotaPorTipo" in body ? body.cuotaPorTipo : cuotaPorTipoDesdeFila(existing.rows[0]),
        tipos: dataTypes ?? (Array.isArray(existing.rows[0].data_types) ? existing.rows[0].data_types.map(String) : []),
        cuotaEscrita: quotaPerUser ?? Number(existing.rows[0].quota_per_user ?? 0),
        exigirCompleto: (status ?? currentStatus) !== "borrador",
      });
      if (!validado.ok) return NextResponse.json({ error: validado.error }, { status: 400 });
      cuotaPorTipo = validado.maximos;
      if (porTipo) quotaPerUser = validado.cuota;
    }
    const startDate = inicioAdelantado ? inicioAdelantado.fecha : "startDate" in body || "start_date" in body ? normalizeCampaignDate(body.startDate ?? body.start_date) : undefined;
    const startTime = inicioAdelantado ? inicioAdelantado.hora : "startTime" in body || "start_time" in body ? normalizeCampaignTime(body.startTime ?? body.start_time) : undefined;
    const endDate = "endDate" in body || "end_date" in body ? normalizeCampaignDate(body.endDate ?? body.end_date) : undefined;
    const endTime = "endTime" in body || "end_time" in body ? normalizeCampaignTime(body.endTime ?? body.end_time) : undefined;
    // Para todo el país: vacía estado, municipio y colonia (lib/campanas/ubicacion.ts).
    const todoElPais = "todoElPais" in body ? body.todoElPais === true : null;
    const locationCity = todoElPais
      ? ""
      : "locationCity" in body || "location_city" in body ? String(body.locationCity ?? body.location_city ?? "").trim() : null;
    const locationState = todoElPais
      ? ""
      : "locationState" in body || "location_state" in body ? String(body.locationState ?? body.location_state ?? "").trim() : null;
    // Sin municipio la campaña abarca todo el estado, y la colonia no aplica.
    const locationColonia = locationCity === ""
      ? ""
      : "locationColonia" in body || "location_colonia" in body ? String(body.locationColonia ?? body.location_colonia ?? "").trim() : null;
    const organizer = "organizer" in body ? String(body.organizer ?? "").trim() : null;
    const errorOrganizacion = errorDeOrganizacion(organizer);
    if (errorOrganizacion) return NextResponse.json({ error: errorOrganizacion }, { status: 400 });
    // El XP no lo cambia el creador (lib/campanas/estado-del-creador.ts). "Revisor asignado" se calcula
    // de campana_revisores (columnasCalculadas).
    const xpPerContribution = null;

    // Igual que en POST/PUT: un borrador puede quedar incompleto, pero si
    // esta edición manda (o deja) la campaña en cualquier otro estado, cada
    // campo importante que sí llegó en el body debe ser válido. No revisamos
    // los campos que no llegaron: ya deberían ser válidos desde que se creó.
    const effectiveStatus = status ?? currentStatus;
    // La fecha de inicio no puede quedar antes de hoy (día de Tepic): ni la que llega,
    // ni la que ya tenía si se envía a revisión. Solo donde se edita todo: activa
    // y aceptada no cambian el inicio.
    if (ESTADOS_CON_EDICION_COMPLETA.has(currentStatus)) {
      const inicioQueQueda =
        startDate !== undefined ? startDate : effectiveStatus !== "borrador" ? normalizeCampaignDate(existing.rows[0].start_date) : null;
      const errorDeInicio = errorDeInicioPasado(inicioQueQueda);
      if (errorDeInicio) {
        return NextResponse.json({ error: errorDeInicio }, { status: 400 });
      }
    }
    // Pausada: casi siempre ya empezó, así que su inicio (en el pasado) se conserva; solo
    // si se mueve, el nuevo no puede ser antes de hoy. Nombre, descripción y temática no se vacían.
    if (currentStatus === "pausada" && (status === null || enviarRevisionDesdePausa)) {
      if (startDate !== undefined && startDate !== normalizeCampaignDate(existing.rows[0].start_date)) {
        const errorDeInicio = errorDeInicioPasado(startDate);
        if (errorDeInicio) return NextResponse.json({ error: errorDeInicio }, { status: 400 });
      }
      if (name !== null && !name) return NextResponse.json({ error: "Falta el nombre de la campaña" }, { status: 400 });
      if (description !== null && !description) return NextResponse.json({ error: "Falta la descripción" }, { status: 400 });
      if (tematica !== null && !tematica) return NextResponse.json({ error: "Elige una temática" }, { status: 400 });
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
      if (locationState !== null && !locationState && !todoElPais) {
        return NextResponse.json({ error: "Selecciona un estado" }, { status: 400 });
      }
    }

    // Propósito (2026-10-27): solo donde se edita todo (borrador, en revisión, rechazada; en activa o
    // pausada los participantes ya aceptaron el acuerdo de uso con él). Obligatorio al ir a revisión:
    // se revisa el que llega o, si no llega, el que ya tenía.
    const traeProposito = "proposito" in body || "propositoOtro" in body;
    let propositoNuevo: { proposito: string | null; otro: string | null } | null = null;
    if (traeProposito || ((ESTADOS_CON_EDICION_COMPLETA.has(currentStatus) || enviarRevisionDesdePausa) && effectiveStatus !== "borrador")) {
      const validado = validarProposito(
        traeProposito ? body.proposito : existing.rows[0].proposito,
        traeProposito ? body.propositoOtro ?? body.proposito_otro : existing.rows[0].proposito_otro,
        effectiveStatus !== "borrador",
      );
      if (!validado.ok) return NextResponse.json({ error: validado.error }, { status: 400 });
      if (traeProposito) propositoNuevo = validado;
    }

    // Temática del catálogo, o una nueva que propone el creador con `tematicaNueva: true` (2026-10-29),
    // como en POST /api/campanas. La que la campaña ya tenía se acepta tal cual.
    if (tematica) {
      const revisada = await revisarTematicaDeCampana(tematica, Number(user.id), {
        proponer: body.tematicaNueva === true,
        actual: String(existing.rows[0].tematica || existing.rows[0].tag || ""),
      });
      if (!revisada.ok) return NextResponse.json({ error: revisada.error }, { status: 400 });
      tematica = revisada.tematica;
      await crearPropuestas(revisada.porCrear, Number(user.id));
    }

    // Etiquetas (subtemáticas, 2026-10-27): se validan y guardan antes del UPDATE, con la temática
    // que va a quedar; si hay un error, no cambia nada. En pausa se comparan para el aviso al supervisor.
    const tematicaQueQueda = tematica || String(existing.rows[0].tematica ?? existing.rows[0].tag ?? "");
    const etiquetasAntes = currentStatus === "pausada" ? await nombresDeEtiquetasDeCampana(Number(id)) : [];
    if ("etiquetas" in body) {
      const errorDeEtiquetas = await guardarEtiquetasDeCampana(pool, {
        campanaId: Number(id),
        tematica: tematicaQueQueda,
        nombres: body.etiquetas,
        usuarioId: Number(user.id),
      });
      if (errorDeEtiquetas) return NextResponse.json({ error: errorDeEtiquetas }, { status: 400 });
    } else if (tematica) {
      await quitarEtiquetasDeOtraTematica(pool, Number(id), tematica);
    }

    // Tipos de dato, límite por tipo y formatos de "Archivo" (tabla campana_tipos, 2026-10-30): antes del
    // UPDATE, como las etiquetas, para que su RETURNING ya los traiga. Lo que no llegó se queda como estaba.
    if (dataTypes !== null || limitePorTipo !== null || formatosDeDocumento !== null || cuotaPorTipo !== undefined) {
      await guardarTiposDeCampana(pool, id, {
        tipos: dataTypes ?? (Array.isArray(existing.rows[0].data_types) ? existing.rows[0].data_types.map(String) : []),
        limite: limitePorTipo !== null ? limitePorTipo.limite : limitePorTipoDesdeFila(existing.rows[0]),
        cuota: cuotaPorTipo !== undefined ? cuotaPorTipo : cuotaPorTipoDesdeFila(existing.rows[0]),
        formatos: formatosDeDocumento ?? normalizarFormatosDeDocumento(existing.rows[0].formatos_de_documento),
      });
    }

    // Checklists (tabla campana_checklists, 2026-10-30), antes del UPDATE para que su RETURNING ya los traiga.
    if (seccionesNuevas) await guardarChecklists(pool, id, seccionesNuevas);

    const result = await pool.query(
      `UPDATE campanas SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        tematica = COALESCE($4, tematica),
        tag = COALESCE($4, tag),
        status = COALESCE($5, status),
        goal_contributions = COALESCE($6, goal_contributions),
        quota_per_user = COALESCE($7, quota_per_user),
        start_date = COALESCE($8, start_date),
        end_date = COALESCE($9, end_date),
        location_city = COALESCE($10, location_city),
        location_state = COALESCE($11, location_state),
        location_colonia = COALESCE($12, location_colonia),
        organizer = COALESCE($13, organizer),
        xp_per_contribution = COALESCE($14, xp_per_contribution),
        collection_mode = COALESCE($15, collection_mode),
        start_time = COALESCE($16, start_time),
        end_time = COALESCE($17, end_time),
        todo_el_pais = COALESCE($18::boolean, todo_el_pais),
        proposito = CASE WHEN $19::boolean THEN $20 ELSE proposito END,
        proposito_otro = CASE WHEN $19::boolean THEN $21 ELSE proposito_otro END,
        -- La pausó el creador (sin motivo). "status" a la derecha es el estado anterior.
        pausa_por = CASE WHEN $5 = 'en_revision' AND status = 'pausada' THEN NULL WHEN $5 = 'pausada' AND status <> 'pausada' THEN 'creador' ELSE pausa_por END,
        pausa_motivo = CASE WHEN $5 = 'en_revision' AND status = 'pausada' THEN NULL WHEN $5 = 'pausada' AND status <> 'pausada' THEN NULL ELSE pausa_motivo END,
        pausada_en = CASE WHEN $5 = 'en_revision' AND status = 'pausada' THEN NULL WHEN $5 = 'pausada' AND status <> 'pausada' THEN NOW() ELSE pausada_en END,
        supervisor_id = CASE WHEN $5 = 'en_revision' AND status = 'pausada' THEN NULL ELSE supervisor_id END,
        supervisado_por_root = CASE WHEN $5 = 'en_revision' AND status = 'pausada' THEN false ELSE supervisado_por_root END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *, ${columnasCalculadas()}`,
      [
        id,
        name || null,
        description || null,
        tematica || null,
        status,
        goalContributions,
        quotaPerUser,
        startDate === undefined ? null : startDate,
        endDate === undefined ? null : endDate,
        locationCity,
        locationState,
        locationColonia,
        organizer,
        xpPerContribution,
        collectionMode,
        startTime === undefined ? null : startTime,
        endTime === undefined ? null : endTime,
        todoElPais,
        propositoNuevo !== null,
        propositoNuevo?.proposito ?? null,
        propositoNuevo?.otro ?? null,
      ]
    );

    // Pasó a activa (p. ej. se reactivó una finalizada): genera su enlace público.
    if (result.rows[0].status === "activa" && currentStatus !== "activa") {
      await asegurarEnlaceVigente(Number(id));
      // Se reanudó con incentivos que no se avisaron mientras estaba pausada.
      if (result.rows[0].is_special) avisarCampanaEspecial(Number(id));
    }
    // El creador la pausó: queda en la bitácora (2026-10-24), como cuando pausa la supervisión.
    if (currentStatus === "activa" && result.rows[0].status === "pausada") {
      await registrarAuditoria({
        actor: { tipo: "usuario", id: Number(user.id) },
        accion: "campana.pausar",
        objetivo: { tipo: "campana", id: Number(id) },
        detalle: { estadoAnterior: currentStatus, estadoNuevo: "pausada" },
      });
    }
    // Entró a revisión (desde borrador o rechazada): avisa a los supervisores.
    if (result.rows[0].status === "en_revision" && currentStatus !== "en_revision") {
      avisarCampanaPorRevisar({
        id: Number(id),
        creadorId: Number(user.id),
        otraVez: currentStatus === "rechazada" || enviarRevisionDesdePausa,
      });
    }
    // Se editó estando pausada: queda en la bitácora y se avisa a quien la supervisa.
    if (currentStatus === "pausada" && result.rows[0].status === "pausada") {
      const antes = existing.rows[0];
      const despues = result.rows[0];
      // NULL y "" valen lo mismo: una colonia NULL que el formulario manda vacía no es un cambio.
      const valor = (v: unknown) => JSON.stringify(v === null || v === undefined ? "" : v);
      const campos: string[] = COLUMNAS_AVISADAS_EN_PAUSA.filter((c) => valor(antes[c]) !== valor(despues[c]));
      if (valor(etiquetasAntes) !== valor(await nombresDeEtiquetasDeCampana(Number(id)))) campos.push("etiquetas");
      if (campos.length > 0) {
        await registrarAuditoria({
          actor: { tipo: "usuario", id: Number(user.id) },
          accion: "campana.editar_pausada",
          objetivo: { tipo: "campana", id: Number(id) },
          detalle: { campos },
        });
        avisarEdicionEnPausa({ id: Number(id), creadorId: Number(user.id), supervisorId: despues.supervisor_id, campos });
      }
    }

    await agregarEtiquetas(result.rows, user);
    const terminoFallida = result.rows[0].status === "fallida" && currentStatus !== "fallida";
    return NextResponse.json({
      message: terminoFallida ? "Campaña finalizada: quedó incompleta porque juntó menos del 25% de su meta" : "Campaña actualizada",
      data: mapCampaign(result.rows[0]),
    });
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
    let tematica = String(body.tematica ?? body.theme ?? body.tag ?? "").trim();
    if (!name || !description || !tematica) {
      return NextResponse.json({ error: "name, description y tematica son obligatorios" }, { status: 400 });
    }

    const status = normalizeCampaignStatus(body.status ?? "borrador");
    const proposito = validarProposito(body.proposito, body.propositoOtro ?? body.proposito_otro, status !== null && status !== "borrador");
    if (!proposito.ok) return NextResponse.json({ error: proposito.error }, { status: 400 });
    if (status === null) {
      return NextResponse.json({ error: `status debe ser uno de: ${Array.from(ALLOWED_STATUS).join(", ")}` }, { status: 400 });
    }
    const errorDeEstado = await errorDeEstadoPedido(status, user.id);
    if (errorDeEstado) return NextResponse.json({ error: errorDeEstado }, { status: 400 });

    const dataTypes = normalizeDataTypes(body.dataTypes ?? body.data_types ?? []);
    const formatosDeDocumento = dataTypes.includes("documento") ? normalizarFormatosDeDocumento(body.formatosDeDocumento) : [];
    const secciones = normalizarSecciones(
      body.checklistSecciones ?? body.checklist_secciones ??
        (Array.isArray(body.checklistOpciones ?? body.checklist_opciones)
          ? [{ titulo: "Características", opciones: normalizeChecklistOpciones(body.checklistOpciones ?? body.checklist_opciones) }]
          : []),
      dataTypes
    );
    if (!secciones.ok) {
      return NextResponse.json({ error: secciones.error }, { status: 400 });
    }
    const checklistSecciones = secciones.secciones;
    const collectionMode = checklistSecciones.length > 0 ? "checklist" : "texto_libre";
    // Meta por tipo de dato o meta general (2026-10-28, lib/campanas/limite-por-tipo.ts).
    const limitePorTipo = resolverMetaYLimites(body, dataTypes, status !== "borrador");
    if (!limitePorTipo.ok) return NextResponse.json({ error: limitePorTipo.error }, { status: 400 });
    const goalContributions = limitePorTipo.metaDeLaSuma ?? Number(body.goalContributions ?? body.goal_contributions ?? 0);
    // Máximo por persona de cada tipo (2026-10-31): con meta por tipo, la cuota es la suma de los máximos.
    const cuotaPorTipo = resolverCuotaYMaximos({
      porTipo: body.metaPorTipo === true && "cuotaPorTipo" in body,
      maximos: body.cuotaPorTipo,
      tipos: dataTypes,
      cuotaEscrita: Number(body.quotaPerUser ?? body.quota_per_user ?? 1),
      exigirCompleto: status !== "borrador",
    });
    if (!cuotaPorTipo.ok) return NextResponse.json({ error: cuotaPorTipo.error }, { status: 400 });
    const quotaPerUser = cuotaPorTipo.cuota;
    const startDate = normalizeCampaignDate(body.startDate ?? body.start_date);
    const startTime = normalizeCampaignTime(body.startTime ?? body.start_time);
    const endDate = normalizeCampaignDate(body.endDate ?? body.end_date);
    const endTime = normalizeCampaignTime(body.endTime ?? body.end_time);
    const todoElPais = body.todoElPais === true;
    const locationCity = todoElPais ? "" : String(body.locationCity ?? body.location_city ?? "").trim();
    const locationState = todoElPais ? "" : String(body.locationState ?? body.location_state ?? "").trim();
    // Sin municipio la campaña abarca todo el estado, y la colonia no aplica.
    const locationColonia = locationCity ? String(body.locationColonia ?? body.location_colonia ?? "").trim() : "";
    const organizer = String(body.organizer ?? "").trim();
    const errorOrganizacion = errorDeOrganizacion(organizer);
    if (errorOrganizacion) return NextResponse.json({ error: errorOrganizacion }, { status: 400 });
    // El XP se conserva: no lo decide el creador.
    const xpPerContribution = null;

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
      if (!locationState && !todoElPais) {
        return NextResponse.json({ error: "Selecciona un estado" }, { status: 400 });
      }
    }

    // Temática del catálogo o propuesta (2026-10-29), como en el PATCH.
    const tematicaRevisada = await revisarTematicaDeCampana(tematica, Number(user.id), {
      proponer: body.tematicaNueva === true,
      actual: String(existing.rows[0].tematica || existing.rows[0].tag || ""),
    });
    if (!tematicaRevisada.ok) return NextResponse.json({ error: tematicaRevisada.error }, { status: 400 });
    tematica = tematicaRevisada.tematica;
    await crearPropuestas(tematicaRevisada.porCrear, Number(user.id));

    // Etiquetas (subtemáticas): antes del UPDATE, como en el PATCH. Sin `etiquetas`, se quitan las de otra temática.
    if ("etiquetas" in body) {
      const errorDeEtiquetas = await guardarEtiquetasDeCampana(pool, {
        campanaId: Number(id),
        tematica,
        nombres: body.etiquetas,
        usuarioId: Number(user.id),
      });
      if (errorDeEtiquetas) return NextResponse.json({ error: errorDeEtiquetas }, { status: 400 });
    } else {
      await quitarEtiquetasDeOtraTematica(pool, Number(id), tematica);
    }

    // Tipos de dato con su límite y formatos (tabla campana_tipos, 2026-10-30), antes del UPDATE.
    await guardarTiposDeCampana(pool, id, { tipos: dataTypes, limite: limitePorTipo.limite, cuota: cuotaPorTipo.maximos, formatos: formatosDeDocumento });
    await guardarChecklists(pool, id, checklistSecciones);

    const result = await pool.query(
      `UPDATE campanas SET
        name = $2,
        description = $3,
        tematica = $4,
        tag = $4,
        status = $5,
        goal_contributions = $6,
        quota_per_user = $7,
        start_date = $8,
        end_date = $9,
        location_city = $10,
        location_state = $11,
        location_colonia = $12,
        organizer = $13,
        xp_per_contribution = COALESCE($14::int, xp_per_contribution),
        collection_mode = $15,
        start_time = $16,
        end_time = $17,
        todo_el_pais = $18,
        proposito = $19,
        proposito_otro = $20,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *, ${columnasCalculadas()}`,
      [
        id,
        name,
        description,
        tematica,
        status,
        goalContributions,
        quotaPerUser,
        startDate,
        endDate,
        locationCity,
        locationState,
        locationColonia,
        organizer,
        xpPerContribution,
        collectionMode,
        startTime,
        endTime,
        todoElPais,
        proposito.proposito,
        proposito.otro,
      ]
    );

    if (result.rows[0].status === "activa" && estadoAnterior !== "activa") {
      await asegurarEnlaceVigente(Number(id));
    }
    if (result.rows[0].status === "en_revision" && estadoAnterior !== "en_revision") {
      avisarCampanaPorRevisar({ id: Number(id), creadorId: Number(user.id), otraVez: estadoAnterior === "rechazada" });
    }

    await agregarEtiquetas(result.rows, user);
    return NextResponse.json({ message: "Campaña actualizada", data: mapCampaign(result.rows[0]) });
  } catch (error) {
    console.error("Error reemplazando campaña", error);
    return NextResponse.json({ error: "No se pudo actualizar la campaña" }, { status: 500 });
  }
}
