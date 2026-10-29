// /api/aportes — listado y envío de aportes. El archivo se sube a MinIO (lib/minio.ts).

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { estaBaneadoDeCampana } from "@/lib/campanas/baneos";
import { respuestasValidas, seccionesDesdeFila } from "@/lib/campanas/checklist";
import { idDeEnlaceVigente } from "@/lib/campanas/enlaces";
import {
  LARGO_MAXIMO_DESCRIPCION,
  MENSAJE_CUERPO_GRANDE,
  cuerpoDemasiadoGrande,
  errorDeArchivo,
  guardarArchivoDelAporte,
  insertarAporteConCuota,
  tiposAceptados,
} from "@/lib/aportes/comun";
import { inscripcionDe } from "@/lib/campanas/inscripciones";
import { avisoDePausa, pausaDesdeFila } from "@/lib/campanas/pausa";

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
    sinArchivo: !row.file_path,
    archivoBorrado: row.archivo_borrado_en != null,
    caracteristicas: Array.isArray(row.caracteristicas) ? row.caracteristicas : [],
    calificacion: row.calificacion ? String(row.calificacion) : undefined,
    status: String(row.status ?? "pendiente"),
    submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : new Date().toISOString(),
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    firstPassBy: row.first_pass_by ? String(row.first_pass_by) : undefined,
    firstPassByUserId: row.first_pass_by_user_id != null ? String(row.first_pass_by_user_id) : undefined,
  };
}

// GET: aportes de una campaña. ?campaignId=&mine=true → los tuyos; ?campaignId= → todos (solo el creador);
// ?campaignId=&reviewer=true → para revisar (revisor aceptado), sin los aportes propios.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");
    const mine = url.searchParams.get("mine") === "true";
    const reviewer = url.searchParams.get("reviewer") === "true";

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId es obligatorio" }, { status: 400 });
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }

    if (!mine) {
      const campaignResult = await pool.query(
        `SELECT c.creator_id,
                EXISTS (
                  SELECT 1 FROM campana_revisores cr
                  WHERE cr.campana_id = c.id AND cr.usuario_id = $2 AND cr.estado = 'aceptado'
                ) AS is_reviewer
         FROM campanas c WHERE c.id = $1 LIMIT 1`,
        [campaignId, user.id]
      );
      if (campaignResult.rowCount === 0) {
        return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
      }
      const isCreator = Number(campaignResult.rows[0].creator_id) === Number(user.id);
      const isReviewer = Boolean(campaignResult.rows[0].is_reviewer);
      if (!isCreator && !(reviewer && isReviewer)) {
        return NextResponse.json({ error: "Solo quien creó la campaña o su revisor puede ver estos aportes" }, { status: 403 });
      }
    }

    const result = mine
      ? await pool.query(
          `SELECT * FROM aportes WHERE campaign_id = $1 AND user_id = $2 ORDER BY submitted_at DESC`,
          [campaignId, user.id]
        )
      : reviewer
        ? await pool.query(
            `SELECT * FROM aportes
             WHERE campaign_id = $1
               AND user_id IS DISTINCT FROM $2
               AND (status = 'pendiente' OR first_pass_by_user_id = $2)
             ORDER BY submitted_at DESC`,
            [campaignId, user.id]
          )
      : await pool.query(
          `SELECT * FROM aportes WHERE campaign_id = $1 ORDER BY submitted_at DESC`,
          [campaignId]
        );

    // El revisor solo necesita el contenido: el correo del participante no le corresponde.
    const aportes = result.rows.map(mapAporte);
    return NextResponse.json({
      data: reviewer && !mine ? aportes.map((aporte) => ({ ...aporte, participantEmail: undefined })) : aportes,
    });
  } catch (error) {
    console.error("Error listando aportes", error);
    return NextResponse.json({ error: "No se pudieron listar los aportes" }, { status: 500 });
  }
}

// POST: envía un aporte (multipart/form-data). Valida campaña activa, que no seas el creador,
// que no estés baneado, la cuota, el tipo y tamaño del archivo; lo sube a MinIO e inserta la fila.
// Exige estar inscrito a la campaña (aceptó los acuerdos una vez: lib/campanas/inscripciones.ts, 403 si no);
// guarda la hora de la inscripción en consentimiento_en.
// Campo opcional `enlace`: token de /c/[token]; si es el vigente de la campaña, se guarda en enlace_id.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }

    if (cuerpoDemasiadoGrande(request)) {
      return NextResponse.json({ error: MENSAJE_CUERPO_GRANDE }, { status: 413 });
    }
    const formData = await request.formData();
    const campaignId = String(formData.get("campaignId") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const rawCaracteristicas = formData.getAll("caracteristicas").map(String);
    const file = formData.get("file");
    const tokenDeEnlace = String(formData.get("enlace") ?? "").trim().toLowerCase();

    if (!campaignId || !description) {
      return NextResponse.json({ error: "campaignId y description son obligatorios" }, { status: 400 });
    }

    if (description.length > LARGO_MAXIMO_DESCRIPCION) {
      return NextResponse.json({ error: "La descripción no puede superar 1000 caracteres" }, { status: 400 });
    }

    const campaignResult = await pool.query(`SELECT * FROM campanas WHERE id = $1 LIMIT 1`, [campaignId]);
    if (campaignResult.rowCount === 0) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    const campaign = campaignResult.rows[0];

    // El archivo debe ser de un tipo que acepta la campaña; sin archivo, solo si acepta texto.
    const tipos = tiposAceptados(campaign.data_types);
    const errorArchivo = errorDeArchivo(file, tipos);
    if (errorArchivo) {
      return NextResponse.json({ error: errorArchivo }, { status: 400 });
    }

    if (Number(campaign.creator_id) === Number(user.id)) {
      return NextResponse.json({ error: "No puedes aportar en una campaña que creaste" }, { status: 403 });
    }

    if (String(campaign.status) !== "activa") {
      const error = String(campaign.status) === "pausada" ? avisoDePausa(pausaDesdeFila(campaign), "Podrás aportar cuando se reanude.") : "Esta campaña no está activa";
      return NextResponse.json({ error }, { status: 400 });
    }

    if (await estaBaneadoDeCampana(campaignId, user.id)) {
      return NextResponse.json({ error: "No puedes aportar en esta campaña porque estás baneado de ella" }, { status: 403 });
    }

    // Los acuerdos se aceptan una vez, al inscribirse a la campaña (2026-10-15); su hora va en consentimiento_en.
    const inscritoEn = await inscripcionDe(campaignId, user.id);
    if (!inscritoEn) {
      return NextResponse.json(
        { error: "Inscríbete a la campaña y acepta sus acuerdos antes de aportar" },
        { status: 403 }
      );
    }

    // Solo se guardan respuestas que existen en los checklists de la campaña ("Título: opción").
    const caracteristicas = respuestasValidas(rawCaracteristicas, seccionesDesdeFila(campaign));

    const existingCountResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM aportes WHERE campaign_id = $1 AND user_id = $2`,
      [campaignId, user.id]
    );
    const existingCount = existingCountResult.rows[0].count as number;
    if (existingCount >= Number(campaign.quota_per_user)) {
      return NextResponse.json({ error: "Ya alcanzaste tu cuota en esta campaña" }, { status: 400 });
    }

    // Llegó desde un enlace público (/c/[token]): se atribuye si el token es el
    // vigente de esta campaña. Uno inválido o caducado no bloquea el aporte.
    const enlaceId = tokenDeEnlace ? await idDeEnlaceVigente(tokenDeEnlace, campaignId) : null;

    // Se comprueba por su contenido y se guarda sin los metadatos que se pueden quitar.
    const subida = await guardarArchivoDelAporte(file, campaignId, tipos);
    if (!subida.ok) return NextResponse.json({ error: subida.error }, { status: 400 });
    const { tipo, guardado: saved } = subida.archivo;

    // Cuenta e inserta con candado: dos envíos simultáneos no pasan la cuota.
    const insertado = await insertarAporteConCuota({
      campaignId,
      persona: `usuario:${user.id}`,
      cuota: Number(campaign.quota_per_user),
      archivoSubido: saved?.relativePath ?? null,
      contar: async (client) => {
        const { rows } = await client.query(
          `SELECT COUNT(*)::int AS count FROM aportes WHERE campaign_id = $1 AND user_id = $2`,
          [campaignId, user.id]
        );
        return Number(rows[0]?.count ?? 0);
      },
      insertar: async (client) => {
        const { rows } = await client.query(
          `INSERT INTO aportes (
            campaign_id, user_id, participant_name, participant_email, description,
            file_type, file_path, file_original_name, file_mime_type, file_size_bytes, caracteristicas, enlace_id,
            consentimiento_en
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12,
            (SELECT aceptada_en FROM campana_inscripciones WHERE campana_id = $1 AND usuario_id = $2))
          RETURNING *`,
          [
            campaignId,
            user.id,
            `${user.nombre} ${user.apellidos}`.trim(),
            user.email,
            description,
            tipo,
            // Aporte de solo texto: sin archivo ('', como ya lo leen los datos abiertos).
            saved?.relativePath ?? "",
            // Sin nombre original: el del teléfono puede traer nombres o fechas, y nadie lo usa.
            null,
            saved?.mimeType ?? null,
            saved?.sizeBytes ?? null,
            JSON.stringify(caracteristicas),
            enlaceId,
          ]
        );
        return rows[0];
      },
    });
    if (!insertado.ok) {
      return NextResponse.json({ error: "Ya alcanzaste tu cuota en esta campaña" }, { status: 400 });
    }

    return NextResponse.json({ message: "Aporte enviado", data: mapAporte(insertado.fila) }, { status: 201 });
  } catch (error) {
    console.error("Error creando aporte", error);
    return NextResponse.json({ error: "No se pudo enviar el aporte" }, { status: 500 });
  }
}
