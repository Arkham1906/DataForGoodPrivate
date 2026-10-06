// /api/aportes/[id] — detalle, revisión, edición y borrado de un aporte.
// Cada cambio de estado actualiza también los contadores de la campaña.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { respuestasValidas, seccionesDesdeFila } from "@/lib/campanas/checklist";
import { bloqueoEnCampanaDelAporte, marcarInapropiado, quitarMarcaInapropiado } from "@/lib/aportes/sanciones-anonimas";
import { recalcularContadores } from "@/lib/aportes/comun";
import { borrarArchivo } from "@/lib/minio";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { ESTADOS_SIN_DECISION, tieneDecision } from "@/lib/aportes/decision";

// Una sola instancia (dominio.md § 5): el creador y el revisor aceptado deciden igual, aceptado o rechazado.
const ALLOWED_STATUS = new Set(["aceptado", "rechazado"]);

function mapAporte(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    campaignId: String(row.campaign_id ?? ""),
    userId: row.user_id != null ? String(row.user_id) : null,
    participantName: String(row.participant_name ?? "Anónimo"),
    participantEmail: row.participant_email ? String(row.participant_email) : undefined,
    description: String(row.description ?? ""),
    fileType: String(row.file_type ?? "foto"),
    fileSizeBytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : undefined,
    caracteristicas: Array.isArray(row.caracteristicas) ? row.caracteristicas : [],
    status: String(row.status ?? "pendiente"),
    submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : new Date().toISOString(),
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    firstPassBy: row.first_pass_by ? String(row.first_pass_by) : undefined,
    firstPassByUserId: row.first_pass_by_user_id != null ? String(row.first_pass_by_user_id) : undefined,
    inapropiado: row.inapropiado === true,
    archivoBorrado: row.archivo_borrado_en != null,
  };
}

/** "Reportar al creador" del revisor. Solo para el creador y los revisores: quien aportó no lo ve. */
function mapReporte(row: Record<string, unknown>) {
  return row.reporte_en
    ? {
        motivo: String(row.reporte_motivo ?? ""),
        revisor: String(row.reporte_revisor || "Un revisor"),
        en: new Date(String(row.reporte_en)).toISOString(),
      }
    : null;
}

async function loadAporteWithCampaign(id: string) {
  const result = await pool.query(
    `SELECT a.*, c.creator_id AS campaign_creator_id, c.name AS campaign_name, c.collection_mode AS campaign_collection_mode, c.checklist_opciones AS campaign_checklist_opciones, c.checklist_secciones AS campaign_checklist_secciones,
            TRIM(CONCAT(ru.nombre, ' ', ru.apellidos)) AS reporte_revisor
     FROM aportes a
     JOIN campanas c ON c.id = a.campaign_id
     LEFT JOIN usuarios ru ON ru.id = a.reporte_por
     WHERE a.id = $1
     LIMIT 1`,
    [id]
  );
  return result.rowCount ? result.rows[0] : null;
}

// GET: detalle de un aporte. Lo ven quien aportó, el creador y los revisores aceptados.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const row = await loadAporteWithCampaign(id);
    if (!row) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });

    const isOwner = Number(row.user_id) === Number(user.id);
    const isCampaignCreator = Number(row.campaign_creator_id) === Number(user.id);
    const reviewerResult = await pool.query(
      `SELECT 1 FROM campana_revisores WHERE campana_id = $1 AND usuario_id = $2 AND estado = 'aceptado' LIMIT 1`,
      [row.campaign_id, user.id]
    );
    const isReviewer = (reviewerResult.rowCount ?? 0) > 0;
    if (!isOwner && !isCampaignCreator && !isReviewer) {
      return NextResponse.json({ error: "No tienes permiso para ver este aporte" }, { status: 403 });
    }

    // Al creador, si el dispositivo de un aporte anónimo ya está bloqueado en su campaña.
    const bloqueoId =
      isCampaignCreator && row.user_id == null && row.anonimo_id ? await bloqueoEnCampanaDelAporte(Number(row.id)) : null;

    // El revisor (que no es el creador ni quien aportó) no recibe el correo del participante.
    const { participantEmail, ...aporte } = mapAporte(row);
    return NextResponse.json({
      data: {
        ...aporte,
        ...(isOwner || isCampaignCreator ? { participantEmail } : {}),
        ...(isCampaignCreator ? { dispositivoBloqueadoId: bloqueoId != null ? String(bloqueoId) : null } : {}),
        ...(isCampaignCreator || isReviewer ? { reporte: mapReporte(row) } : {}),
      },
    });
  } catch (error) {
    console.error("Error obteniendo aporte", error);
    return NextResponse.json({ error: "No se pudo obtener el aporte" }, { status: 500 });
  }
}

// El creador y el revisor aceptado aceptan o rechazan el aporte; su decisión es la final.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const row = await loadAporteWithCampaign(id);
    if (!row) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });

    const isCampaignCreator = Number(row.campaign_creator_id) === Number(user.id);
    const reviewerResult = await pool.query(
      `SELECT 1 FROM campana_revisores WHERE campana_id = $1 AND usuario_id = $2 AND estado = 'aceptado' LIMIT 1`,
      [row.campaign_id, user.id]
    );
    const isReviewer = (reviewerResult.rowCount ?? 0) > 0;
    if (!isCampaignCreator && !isReviewer) {
      return NextResponse.json({ error: "Solo el creador o un revisor aceptado puede revisar este aporte" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const status = String(body.status ?? "").trim().toLowerCase();
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ error: "status debe ser aceptado o rechazado" }, { status: 400 });
    }

    const rejectionReason = body.rejectionReason ?? body.rejection_reason ?? null;
    const comoRevisor = isReviewer && !isCampaignCreator;
    // Una decisión no se cambia, la haya tomado quien sea (dominio.md § 5). El UPDATE lo vuelve
    // a comprobar, por si el creador y el revisor deciden a la vez.
    if (tieneDecision(String(row.status))) {
      return NextResponse.json({ error: "Este aporte ya tiene una decisión" }, { status: 409 });
    }
    if (status === "rechazado" && !String(rejectionReason ?? "").trim()) {
      return NextResponse.json({ error: "rejectionReason es obligatorio al rechazar" }, { status: 400 });
    }
    // Casilla "Contenido inapropiado" al rechazar: solo para aportes sin cuenta.
    const inapropiado = body.inapropiado === true;
    if (inapropiado && (status !== "rechazado" || row.user_id != null)) {
      return NextResponse.json({ error: "Solo un aporte anónimo rechazado se puede marcar como inapropiado" }, { status: 400 });
    }

    // first_pass_by guarda qué revisor decidió (el creador ve su nombre). Nunca sale del body.
    const nuevoEstado = status;
    const firstPassBy = comoRevisor ? `${user.nombre} ${user.apellidos}`.trim() : row.first_pass_by ?? null;

    // El cambio y el recálculo de contadores van juntos, con la campaña bloqueada.
    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");
      await client.query(`SELECT 1 FROM campanas WHERE id = $1 FOR NO KEY UPDATE`, [row.campaign_id]);
      result = await client.query(
        `UPDATE aportes SET
          status = $2,
          rejection_reason = $3,
          first_pass_by = $4,
          first_pass_by_user_id = $5,
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND status = ANY($6::text[])
        RETURNING *`,
        [
          id,
          nuevoEstado,
          nuevoEstado === "rechazado" ? String(rejectionReason).trim() : null,
          firstPassBy,
          comoRevisor ? user.id : row.first_pass_by_user_id,
          ESTADOS_SIN_DECISION,
        ]
      );
      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Este aporte ya tiene una decisión" }, { status: 409 });
      }
      await recalcularContadores(row.campaign_id, client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    // Aceptar es la decisión final: se quita la marca de inapropiado que pudo poner alguien antes.
    if (nuevoEstado === "aceptado") await quitarMarcaInapropiado(Number(id));
    const bloqueoGlobal = inapropiado ? (await marcarInapropiado(Number(id), Number(user.id))).bloqueoGlobal : false;

    // La decisión (del creador o del revisor) llega al participante. Un aporte anónimo no tiene a quién avisar.
    if (row.user_id != null && nuevoEstado !== String(row.status)) {
      const enlace = `/mis-aportes/${row.campaign_id}`;
      await notificar(
        nuevoEstado === "aceptado"
          ? {
              usuarioId: row.user_id,
              tipo: "aporte_aceptado",
              titulo: "Aporte aceptado",
              mensaje: `Tu aporte en "${row.campaign_name}" fue aceptado.`,
              campanaId: row.campaign_id,
              enlace,
              metadata: { aporteId: String(id) },
            }
          : {
              usuarioId: row.user_id,
              tipo: "aporte_rechazado",
              titulo: "Aporte rechazado",
              mensaje: `Tu aporte en "${row.campaign_name}" fue rechazado. Motivo: ${String(rejectionReason).trim()}`,
              campanaId: row.campaign_id,
              enlace,
              metadata: { aporteId: String(id), motivo: String(rejectionReason).trim() },
            },
      );
    }

    // Se relee: la marca de inapropiado pudo cambiar después del UPDATE.
    const final = inapropiado || nuevoEstado === "aceptado" ? (await loadAporteWithCampaign(id)) ?? result.rows[0] : result.rows[0];
    return NextResponse.json({
      message: bloqueoGlobal
        ? "Aporte actualizado. Ese dispositivo juntó varios aportes inapropiados y quedó bloqueado en toda la plataforma."
        : "Aporte actualizado",
      data: mapAporte(final),
    });
  } catch (error) {
    console.error("Error revisando aporte", error);
    return NextResponse.json({ error: "No se pudo actualizar el aporte" }, { status: 500 });
  }
}

// Uso previsto: quien envió el aporte edita descripción/caracteristicas mientras sigue pendiente (Insomnia: PUT { "description": "...", "caracteristicas": [...] })
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const row = await loadAporteWithCampaign(id);
    if (!row) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });

    if (Number(row.user_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo quien envió el aporte puede editarlo" }, { status: 403 });
    }

    if (row.status !== "pendiente") {
      return NextResponse.json({ error: "Ya no puedes editar un aporte que entró a revisión" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const description = String(body.description ?? "").trim();
    if (!description) {
      return NextResponse.json({ error: "description es obligatorio" }, { status: 400 });
    }
    if (description.length > 1000) {
      return NextResponse.json({ error: "La descripción no puede superar 1000 caracteres" }, { status: 400 });
    }

    const secciones = seccionesDesdeFila({
      checklist_secciones: row.campaign_checklist_secciones,
      checklist_opciones: row.campaign_checklist_opciones,
      collection_mode: row.campaign_collection_mode,
    });
    const caracteristicas = respuestasValidas(
      Array.isArray(body.caracteristicas) ? body.caracteristicas.map(String) : [],
      secciones
    );

    // status en el WHERE: si lo decidieron mientras editaba, ya no se toca.
    const result = await pool.query(
      `UPDATE aportes SET description = $2, caracteristicas = $3::jsonb, updated_at = NOW()
       WHERE id = $1 AND status = 'pendiente' RETURNING *`,
      [id, description, JSON.stringify(caracteristicas)]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Ya no puedes editar un aporte que entró a revisión" }, { status: 400 });
    }

    return NextResponse.json({ message: "Aporte actualizado", data: mapAporte(result.rows[0]) });
  } catch (error) {
    console.error("Error editando aporte", error);
    return NextResponse.json({ error: "No se pudo editar el aporte" }, { status: 500 });
  }
}

// DELETE: quien aportó borra su aporte pendiente o rechazado (recupera ese espacio de su cuota).
// Uno aceptado ya no se borra. Descuenta los contadores de la campaña.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await pool.connect();

  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });

    const row = await loadAporteWithCampaign(id);
    if (!row) return NextResponse.json({ error: "Aporte no encontrado" }, { status: 404 });

    if (Number(row.user_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Solo quien envió el aporte puede eliminarlo" }, { status: 403 });
    }

    if (String(row.status) === "aceptado") {
      return NextResponse.json({ error: "Un aporte aceptado ya no se puede eliminar" }, { status: 400 });
    }

    await client.query("BEGIN");
    await client.query(`SELECT 1 FROM campanas WHERE id = $1 FOR NO KEY UPDATE`, [row.campaign_id]);
    // status en el WHERE: si lo aceptaron mientras tanto, ya no se borra.
    const borrado = await client.query(
      `DELETE FROM aportes WHERE id = $1 AND user_id = $2 AND status <> 'aceptado'`,
      [id, user.id]
    );
    if (borrado.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Un aporte aceptado ya no se puede eliminar" }, { status: 400 });
    }
    await recalcularContadores(row.campaign_id, client);
    await client.query("COMMIT");

    // Ya borrada la fila, también el archivo: antes quedaba huérfano en MinIO para siempre.
    if (row.file_path && !row.archivo_borrado_en) {
      await borrarArchivo(String(row.file_path)).catch((error) => {
        console.error(`No se pudo borrar de MinIO el archivo del aporte ${id}`, error);
      });
    }

    return NextResponse.json({ message: "Aporte eliminado" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Error eliminando aporte", error);
    return NextResponse.json({ error: "No se pudo eliminar el aporte" }, { status: 500 });
  } finally {
    client.release();
  }
}
