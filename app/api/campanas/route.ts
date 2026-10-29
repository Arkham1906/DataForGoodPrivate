// /api/campanas — listado y creación de campañas. Lo usa casi toda la zona de usuario.
// Antes de leer, activa las campañas aceptadas cuya fecha llegó y finaliza las vencidas (lib/campaign-date.ts).
// El POST exige sesión y solo crea borradores o campañas en revisión (lib/campanas/estado-del-creador.ts).
// El listado general y ?id= solo devuelven lo que quien consulta puede ver (lib/campanas/visibilidad.ts).

import { NextResponse } from "next/server";
import { especialDesdeFila } from "@/lib/campanas/especial";
import { pool } from "@/lib/db";
import { avisarCampanaPorRevisar } from "@/lib/notificaciones/avisos-a-supervisores";
import { getSessionUser } from "@/lib/session";
import { idsDeCampanasConBaneo, motivoDeBaneo } from "@/lib/campanas/baneos";
import { yaReporto } from "@/lib/reportes/reportes";
import { inscripcionDe } from "@/lib/campanas/inscripciones";
import { errorDeOrganizacion } from "@/lib/campanas/organizacion";
import { normalizarSecciones, seccionesDesdeFila } from "@/lib/campanas/checklist";
import { enviadosPorTipoDesdeFila, limitePorTipoDesdeFila, resolverMetaYLimites } from "@/lib/campanas/limite-por-tipo";
import { normalizarFormatosDeDocumento } from "@/lib/aportes/archivo";
import { XP_POR_APORTE, errorDeEstadoPedido } from "@/lib/campanas/estado-del-creador";
import { pausaDesdeFila } from "@/lib/campanas/pausa";
import { rechazoDesdeFila } from "@/lib/campanas/rechazo";
import { condicionDeVisibilidad } from "@/lib/campanas/visibilidad";
import { agregarEtiquetas, guardarEtiquetasDeCampana } from "@/lib/etiquetas/catalogo";
import { validarProposito } from "@/lib/campanas/proposito";
import { crearPropuestas, revisarTematicaDeCampana } from "@/lib/tematicas/catalogo";
import { hasRootSession } from "@/lib/rootSession";
import { campanasParaTi } from "@/lib/usuarios/inicio";
import { activateScheduledCampaigns, ahoraEnZona, calculateCampaignDaysRemaining, errorDeFinAntesDeInicio, errorDeInicioPasado, finalizeExpiredCampaigns, normalizeCampaignDate, normalizeCampaignTime } from "@/lib/campaign-date";

async function obtenerIdsGuardados(usuarioId: number): Promise<Set<number>> {
  const result = await pool.query<{ campana_id: number }>(
    `SELECT campana_id FROM campanas_guardadas WHERE usuario_id = $1`,
    [usuarioId],
  );
  return new Set(result.rows.map((row) => row.campana_id));
}

function normalizeDataTypes(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const allowed = new Set(["texto", "foto", "video", "audio", "documento"]);
  return input
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter((item) => allowed.has(item));
}

function normalizeCampaignStatus(input: unknown): string {
  const value = String(input ?? "borrador").trim().toLowerCase();
  const allowed = new Set([
    "borrador",
    "en_revision",
    "activa",
    "pausada",
    "finalizada",
    "rechazada",
  ]);

  return allowed.has(value) ? value : "borrador";
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
  const dataTypes = Array.isArray(row.data_types)
    ? row.data_types
    : Array.isArray(row.data_types ?? [])
      ? row.data_types
      : [];

  const checklistOpciones = Array.isArray(row.checklist_opciones) ? row.checklist_opciones : [];

  const aportes = Array.isArray(row.aportes)
    ? row.aportes
    : Array.isArray(row.aportes ?? [])
      ? row.aportes
      : [];

  return {
    id: String(row.id ?? ""),
    creatorId: String(row.creator_id ?? ""),
    creatorName: String(row.creator_name ?? ""),
    supervisorId: row.supervisor_id != null ? String(row.supervisor_id) : null,
    supervisedByRoot: Boolean(row.supervisado_por_root),
    latestSupervisionAction: row.latest_supervision_action ? String(row.latest_supervision_action) : null,
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    tematica: String(row.tematica ?? row.tag ?? ""),
    tag: String(row.tag ?? String(row.tematica ?? "")),
    // Subtemáticas (2026-10-27): las pone agregarEtiquetas antes de mapear; las pendientes solo para el creador y la supervisión.
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
    // Quién la pausó y por qué (null si no está pausada).
    pausa: pausaDesdeFila(row),
    // Por qué se rechazó (solo en ?mine=true y mientras siga rechazada).
    rechazo: rechazoDesdeFila(row),
    daysRemaining: calculateCampaignDaysRemaining(row.end_date ?? row.endDate),
    hasReviewerAssigned: Boolean(row.has_reviewer_assigned),
    shareToken: String(row.share_token ?? ""),
    shareTokenExpiresAt: row.share_token_expires_at ? new Date(row.share_token_expires_at as string).toISOString() : undefined,
    contributions: aportes,
    myContributionsCount: row.mis_aportes_count != null ? Number(row.mis_aportes_count) : undefined,
    ...(row.can_delete != null ? { canDelete: row.can_delete === true } : {}),
  };
}

// GET: campañas. Modos por query: ?id= (una, con bloque viewer), ?mine=true (creadas por ti),
// ?misAportes=true (aportaste o guardaste), ?available=true (puedes aportar), ?supervised=true (supervisas),
// ?paraTi=true ("Campañas para ti": hasta 3, como en /inicio; otra forma, CampanaParaTi de lib/usuarios/inicio.ts).
// Sin parámetros: activas, sin sesión.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("id");
    const mine = url.searchParams.get("mine") === "true";
    const available = url.searchParams.get("available") === "true";
    const supervised = url.searchParams.get("supervised") === "true";
    // Campañas donde ya se aportó o que se guardaron: el conjunto que muestra "Mis aportes".
    const misAportes = url.searchParams.get("misAportes") === "true";
    // "Campañas para ti" de /campanas (2026-10-27): las mismas hasta 3 que en /inicio.
    const paraTi = url.searchParams.get("paraTi") === "true";
    // Siempre se intenta leer la sesión (aunque el modo no la exija) para poder marcar isSaved.
    const user = await getSessionUser();

    await activateScheduledCampaigns();
    await finalizeExpiredCampaigns();

    if ((mine || available || misAportes || supervised || paraTi) && !user) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }
    if (paraTi) return NextResponse.json({ data: await campanasParaTi(user!) });

    const [savedIds, bannedIds] = user
      ? await Promise.all([obtenerIdsGuardados(user.id), idsDeCampanasConBaneo(user.id)])
      : [new Set<number>(), new Set<number>()];
    const conIsSaved = (row: Record<string, unknown>) => ({
      ...mapCampaign(row),
      isSaved: savedIds.has(Number(row.id)),
      // Su creador lo baneó: las listas la marcan y no la ofrecen para aportar.
      isBanned: bannedIds.has(Number(row.id)),
      isMine: user ? Number(row.creator_id) === Number(user.id) : false,
    });

    if (supervised) {
      const result = await pool.query(
        `SELECT c.*,
                latest_review.accion AS latest_supervision_action
         FROM campanas c
         LEFT JOIN LATERAL (
           SELECT cs.accion
           FROM campana_supervisores cs
           WHERE cs.campana_id = c.id
             AND cs.supervisor_id = $1
           ORDER BY cs.created_at DESC, cs.id DESC
           LIMIT 1
         ) latest_review ON true
         WHERE c.supervisor_id = $1
         ORDER BY c.created_at DESC`,
        [user!.id]
      );
      await agregarEtiquetas(result.rows, user, await hasRootSession());
      return NextResponse.json({ data: result.rows.map(conIsSaved) });
    }

    if (campaignId) {
      const visible = await condicionDeVisibilidad(user, "campanas", 2);
      const result = await pool.query(`SELECT * FROM campanas WHERE id = $1 AND ${visible.sql} LIMIT 1`, [campaignId, ...visible.params]);
      if (result.rowCount === 0) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
      await agregarEtiquetas(result.rows, user, await hasRootSession());
      const campaign = conIsSaved(result.rows[0]);
      return NextResponse.json({
        data: campaign,
        viewer: {
          isCreator: user ? campaign.creatorId === String(user.id) : false,
          isMySupervision: user ? campaign.supervisorId === String(user.id) : false,
          // Baneado de esta campaña por su creador: la pantalla avisa antes de que intente aportar,
          // con el motivo que escribió el creador.
          baneado: campaign.isBanned,
          motivoDeBaneo: user && campaign.isBanned ? await motivoDeBaneo(campaign.id, user.id) : null,
          // Ya reportó la campaña: /campanas/[id] no le ofrece reportarla otra vez.
          yaReportada: user ? await yaReporto({ tipo: "campana", id: Number(campaign.id) }, Number(user.id)) : false,
          // Ya aceptó los acuerdos para aportar (lib/campanas/inscripciones.ts).
          inscrito: user ? (await inscripcionDe(campaign.id, user.id)) !== null : false,
        },
      });
    }

    const result = mine
      ? await pool.query(
          // Si está rechazada, el motivo, la fecha y la sanción del último rechazo (lib/campanas/rechazo.ts).
          // El reporte con sanción se escribe en la misma transacción que el rechazo: mismo NOW().
          `SELECT c.*,
                  NOT EXISTS (SELECT 1 FROM aportes a WHERE a.campaign_id = c.id) AS can_delete,
                  r.motivo AS rechazo_motivo, r.created_at AS rechazo_en, r.por_superusuario AS rechazo_por_root,
                  s.tipo AS rechazo_sancion_tipo, s.dias AS rechazo_sancion_dias
           FROM campanas c
           LEFT JOIN LATERAL (
             SELECT cs.motivo, cs.created_at, cs.por_superusuario
             FROM campana_supervisores cs
             WHERE cs.campana_id = c.id AND cs.accion = 'rechazada' AND c.status = 'rechazada'
             ORDER BY cs.created_at DESC, cs.id DESC
             LIMIT 1
           ) r ON true
           LEFT JOIN LATERAL (
             SELECT sa.tipo, sa.dias
             FROM reportes rp JOIN sanciones sa ON sa.id = rp.sancion_id
             WHERE rp.campana_id = c.id AND rp.origen = 'rechazo' AND rp.resuelto_en = r.created_at
             LIMIT 1
           ) s ON true
           WHERE c.creator_id = $1
           ORDER BY c.created_at DESC`,
          [user!.id],
        )
      : available
        ? await pool.query(
            `SELECT * FROM campanas
             WHERE creator_id <> $1 AND status = 'activa'
               AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = campanas.id AND b.usuario_id = $1)
             ORDER BY created_at DESC`,
            [user!.id],
          )
        : misAportes
          ? await pool.query(
              `SELECT campanas.*,
                      (SELECT COUNT(*)::int FROM aportes a2 WHERE a2.campaign_id = campanas.id AND a2.user_id = $1) AS mis_aportes_count
               FROM campanas
               -- Las propias solo si las guardó (2026-10-19: el creador guardaba la suya y no la
               -- veía en ningún lado); en las propias no se aporta.
               WHERE (creator_id <> $1 AND EXISTS (SELECT 1 FROM aportes a WHERE a.campaign_id = campanas.id AND a.user_id = $1))
                  OR EXISTS (SELECT 1 FROM campanas_guardadas g WHERE g.campana_id = campanas.id AND g.usuario_id = $1)
               ORDER BY created_at DESC`,
              [user!.id],
            )
          : await condicionDeVisibilidad(user).then((visible) =>
              pool.query(`SELECT * FROM campanas WHERE ${visible.sql} ORDER BY created_at DESC`, visible.params),
            );

    await agregarEtiquetas(result.rows, user, await hasRootSession());
    return NextResponse.json({ data: result.rows.map(conIsSaved) });
  } catch (error) {
    console.error("Error listando campanas", error);
    return NextResponse.json({ error: "No se pudieron listar las campanas" }, { status: 500 });
  }
}

// POST: crea una campaña. Valida campos obligatorios salvo en borrador.
export async function POST(request: Request) {
  try {
    // La campaña siempre es de quien tiene la sesión: nunca se toma el creador del body.
    const sessionUser = await getSessionUser();
    if (!sessionUser) return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
    const body = await request.json().catch(() => ({}));

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const tematicaPedida = String(body.tematica ?? body.theme ?? body.tag ?? "").trim();

    if (!name || !description || !tematicaPedida) {
      return NextResponse.json(
        { error: "name, description y tematica son obligatorios" },
        { status: 400 }
      );
    }
    // Temática del catálogo, o una nueva que propone el creador con `tematicaNueva: true` (2026-10-29):
    // queda pendiente hasta que el SuperUsuario la revisa y se da de alta justo antes de guardar.
    const tematicaRevisada = await revisarTematicaDeCampana(tematicaPedida, Number(sessionUser.id), {
      proponer: body.tematicaNueva === true,
    });
    if (!tematicaRevisada.ok) return NextResponse.json({ error: tematicaRevisada.error }, { status: 400 });
    const tematica = tematicaRevisada.tematica;
    const tag = tematica;

    const creatorId = Number(sessionUser.id);
    const creator = `${sessionUser.nombre} ${sessionUser.apellidos}`.trim();
    if (!creator) {
      return NextResponse.json(
        { error: "El nombre del usuario creador es obligatorio" },
        { status: 400 }
      );
    }

    const dataTypes = normalizeDataTypes(body.dataTypes ?? body.data_types ?? []);
    // Formatos de "Archivo" (2026-10-28): solo si pide archivos; [] = todos.
    const formatosDeDocumento = dataTypes.includes("documento") ? normalizarFormatosDeDocumento(body.formatosDeDocumento) : [];
    const status = normalizeCampaignStatus(body.status ?? "borrador");
    const errorDeEstado = await errorDeEstadoPedido(status, creatorId);
    if (errorDeEstado) return NextResponse.json({ error: errorDeEstado }, { status: 400 });
    // Propósito (2026-10-27): obligatorio para enviar a revisión; un borrador puede no tenerlo.
    const proposito = validarProposito(body.proposito, body.propositoOtro ?? body.proposito_otro, status !== "borrador");
    if (!proposito.ok) return NextResponse.json({ error: proposito.error }, { status: 400 });
    // Checklists con título (la descripción del aporte siempre es obligatoria:
    // es el texto libre). Un cliente viejo que manda la lista plana
    // checklistOpciones la guarda como un solo checklist titulado "Checklist".
    const seccionesEnviadas =
      body.checklistSecciones ?? body.checklist_secciones ??
      (Array.isArray(body.checklistOpciones ?? body.checklist_opciones)
        ? [{ titulo: "Checklist", opciones: normalizeChecklistOpciones(body.checklistOpciones ?? body.checklist_opciones) }]
        : []);
    // Cada checklist va con su tipo de dato (2026-10-28); los de tipos que no pide se quitan.
    const secciones = normalizarSecciones(seccionesEnviadas, dataTypes);
    if (!secciones.ok) {
      return NextResponse.json({ error: secciones.error }, { status: 400 });
    }
    const checklistSecciones = secciones.secciones;
    // Columnas anteriores a las secciones: se dejan coherentes para quien aún las lea.
    const collectionMode = checklistSecciones.length > 0 ? "checklist" : "texto_libre";
    const checklistOpciones: string[] = [];

    // Meta por tipo de dato (por defecto: un límite por tipo y la meta es su suma) o meta general
    // (2026-10-28, lib/campanas/limite-por-tipo.ts). Los límites solo de los tipos que pide.
    const limitePorTipo = resolverMetaYLimites(body, dataTypes, status !== "borrador");
    if (!limitePorTipo.ok) return NextResponse.json({ error: limitePorTipo.error }, { status: 400 });
    const goalContributions = limitePorTipo.metaDeLaSuma ?? Number(body.goalContributions ?? body.goal_contributions ?? 0);
    const quotaPerUser = Number(body.quotaPerUser ?? body.quota_per_user ?? 1);
    // Contadores, XP, "especial" y "revisor asignado" los decide el sistema, no el body:
    // una campaña nueva empieza en cero y sin revisor.
    const currentContributions = 0;
    const approvedContributions = 0;
    const pendingContributions = 0;
    const rejectedContributions = 0;
    const participants = 0;
    const xpPerContribution = XP_POR_APORTE;
    const daysRemaining = null;
    const isSpecial = false;
    const hasReviewerAssigned = false;

    const startDate = normalizeCampaignDate(body.startDate ?? body.start_date);
    const endDate = normalizeCampaignDate(body.endDate ?? body.end_date);
    // Para todo el país: sin estado, municipio ni colonia (lib/campanas/ubicacion.ts).
    const todoElPais = body.todoElPais === true;
    const locationCity = todoElPais ? "" : String(body.locationCity ?? body.location_city ?? "").trim();
    const locationState = todoElPais ? "" : String(body.locationState ?? body.location_state ?? "").trim();
    // Sin municipio la campaña abarca todo el estado, y la colonia no aplica.
    const locationColonia = locationCity ? String(body.locationColonia ?? body.location_colonia ?? "").trim() : "";
    const organizer = String(body.organizer ?? "").trim();
    const errorOrganizacion = errorDeOrganizacion(organizer);
    if (errorOrganizacion) return NextResponse.json({ error: errorOrganizacion }, { status: 400 });
    // Columnas viejas del enlace (ya no se usan: campana_enlaces).
    const shareToken = "";
    const shareTokenExpiresAt = null;

    // Ni siquiera un borrador empieza antes de hoy (día de Tepic; hoy sí se permite)
    // ni termina antes de empezar.
    const errorDeInicio = errorDeInicioPasado(startDate) ?? errorDeFinAntesDeInicio(startDate, endDate);
    if (errorDeInicio) {
      return NextResponse.json({ error: errorDeInicio }, { status: 400 });
    }

    // Un borrador puede quedar incompleto a propósito; para cualquier otro
    // estado (en_revision, activa...) sí se exigen los campos importantes,
    // igual que ya hace NuevaCampanaForm en el cliente.
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

    await crearPropuestas(tematicaRevisada.porCrear, creatorId);

    const aportes: unknown[] = [];
    const ahora = ahoraEnZona();
    const horaDeCreacion = `${String(ahora.hour).padStart(2, "0")}:${String(ahora.minute).padStart(2, "0")}`;

    // La campaña y sus etiquetas (subtemáticas, opcionales) se guardan juntas: una etiqueta
    // inválida no deja una campaña a medias.
    const cliente = await pool.connect();
    let result;
    try {
      await cliente.query("BEGIN");
      result = await cliente.query(
        `INSERT INTO campanas (
          creator_id,
          creator_name,
          name,
          description,
          tematica,
          tag,
          status,
          data_types,
          collection_mode,
          checklist_opciones,
          goal_contributions,
          quota_per_user,
          current_contributions,
          approved_contributions,
          pending_contributions,
          rejected_contributions,
          participants,
          start_date,
          end_date,
          location_city,
          location_state,
          location_colonia,
          organizer,
          xp_per_contribution,
          is_special,
          days_remaining,
          has_reviewer_assigned,
          share_token,
          share_token_expires_at,
          aportes,
          start_time,
          end_time,
          checklist_secciones,
          cuota_por_tipo,
          todo_el_pais,
          proposito,
          proposito_otro,
          limite_por_tipo,
          formatos_de_documento
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30::jsonb, $31, $32, $33::jsonb, $34::jsonb, $35,
          $36, $37, $38::jsonb, $39::jsonb
        ) RETURNING *`,
        [
          creatorId,
          creator,
          name,
          description,
          tematica,
          tag,
          status,
          JSON.stringify(dataTypes),
          collectionMode,
          JSON.stringify(checklistOpciones),
          goalContributions,
          quotaPerUser,
          currentContributions,
          approvedContributions,
          pendingContributions,
          rejectedContributions,
          participants,
          startDate,
          endDate,
          locationCity,
          locationState,
          locationColonia,
          organizer,
          xpPerContribution,
          isSpecial,
          daysRemaining,
          hasReviewerAssigned,
          shareToken,
          shareTokenExpiresAt,
          JSON.stringify(aportes),
          horaDeCreacion,
          horaDeCreacion,
          JSON.stringify(checklistSecciones),
          null, // cuota_por_tipo: sin uso desde el 2026-10-27 (solo cuota general; lib/campanas/reparto-sugerido.ts)
          todoElPais,
          proposito.proposito,
          proposito.otro,
          limitePorTipo.limite ? JSON.stringify(limitePorTipo.limite) : null,
          JSON.stringify(formatosDeDocumento),
        ]
      );
      if ("etiquetas" in body) {
        const errorDeEtiquetas = await guardarEtiquetasDeCampana(cliente, {
          campanaId: Number(result.rows[0].id),
          tematica,
          nombres: body.etiquetas,
          usuarioId: creatorId,
        });
        if (errorDeEtiquetas) {
          await cliente.query("ROLLBACK");
          return NextResponse.json({ error: errorDeEtiquetas }, { status: 400 });
        }
      }
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      cliente.release();
    }
    await agregarEtiquetas(result.rows, sessionUser);

    if (result.rows[0].status === "en_revision") {
      avisarCampanaPorRevisar({ id: Number(result.rows[0].id), creadorId: creatorId });
    }

    return NextResponse.json(
      {
        message: "Campaña creada",
        data: mapCampaign(result.rows[0]),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creando campaña", error);
    return NextResponse.json(
      { error: "No se pudo crear la campaña" },
      { status: 500 }
    );
  }
}
