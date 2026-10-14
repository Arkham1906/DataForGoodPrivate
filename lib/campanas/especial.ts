// Campaña especial (2026-10-14, SCR-WEB-13): el creador le da a una campaña activa o pausada un
// periodo con multiplicador de XP (×1 a ×3), el bono fijo por cuota y una insignia opcional
// (solo el nombre). Aquí se guardan, se validan y se leen; OTORGAR el XP lo hace la
// gamificación con multiplicadorDeXp(). Reglas en references/dominio.md § 7.

import { pool } from "@/lib/db";
import { avisarCampanaEspecial } from "@/lib/notificaciones/campanas-por-interes";
import { hoyEnTepic, normalizeCampaignDate } from "@/lib/campaign-date";
import {
  BONO_POR_CUOTA,
  LARGO_MAXIMO_DE_INSIGNIA,
  MULTIPLICADOR_MAXIMO,
  fechaCorta,
  type CampanaEspecial,
} from "@/lib/campanas/especial-reglas";

/** Incentivos guardados en la fila de `campanas` (SELECT *), o null si no es especial. */
export function especialDesdeFila(row: Record<string, unknown>): CampanaEspecial | null {
  const inicio = normalizeCampaignDate(row.especial_inicio);
  const fin = normalizeCampaignDate(row.especial_fin);
  if (!row.is_special || !inicio || !fin) return null;
  const hoy = hoyEnTepic();
  return {
    inicio,
    fin,
    multiplicador: Number(row.especial_multiplicador ?? 1),
    insignia: row.especial_insignia ? String(row.especial_insignia) : null,
    bono: BONO_POR_CUOTA,
    etapa: hoy < inicio ? "proxima" : hoy > fin ? "terminada" : "vigente",
  };
}

type Resultado = { ok: true } | { ok: false; status: number; error: string };

/** Guarda (o cambia) los incentivos. Solo el creador y solo con la campaña activa o pausada. */
export async function guardarEspecial(campanaId: number, usuarioId: number, body: Record<string, unknown>): Promise<Resultado> {
  const campana = await pool.query(
    `SELECT creator_id, status, start_date, end_date FROM campanas WHERE id = $1`,
    [campanaId],
  );
  const fila = campana.rows[0];
  if (!fila) return { ok: false, status: 404, error: "Campaña no encontrada" };
  if (Number(fila.creator_id) !== usuarioId) return { ok: false, status: 403, error: "Solo quien creó la campaña puede hacerla especial" };
  if (fila.status !== "activa" && fila.status !== "pausada") {
    return { ok: false, status: 400, error: "Solo una campaña activa o pausada puede ser especial" };
  }

  const inicio = normalizeCampaignDate(body.inicio);
  const fin = normalizeCampaignDate(body.fin);
  const multiplicador = Number(body.multiplicador);
  const insignia = String(body.insignia ?? "").trim().replace(/\s+/g, " ");
  if (!inicio || !fin) return { ok: false, status: 400, error: "Indica el inicio y el fin del periodo especial" };
  if (fin < inicio) return { ok: false, status: 400, error: "El fin del periodo no puede ser anterior a su inicio" };
  if (fin < hoyEnTepic()) return { ok: false, status: 400, error: "El periodo especial ya terminó; elige fechas de hoy en adelante" };
  const desde = normalizeCampaignDate(fila.start_date);
  const hasta = normalizeCampaignDate(fila.end_date);
  if ((desde && inicio < desde) || (hasta && fin > hasta)) {
    const rango = desde && hasta ? ` (del ${fechaCorta(desde)} al ${fechaCorta(hasta)})` : "";
    return { ok: false, status: 400, error: `El periodo especial debe quedar dentro de la vigencia de la campaña${rango}` };
  }
  if (!Number.isInteger(multiplicador) || multiplicador < 1 || multiplicador > MULTIPLICADOR_MAXIMO) {
    return { ok: false, status: 400, error: `El multiplicador va de ×1 a ×${MULTIPLICADOR_MAXIMO}` };
  }
  if (insignia.length > LARGO_MAXIMO_DE_INSIGNIA) {
    return { ok: false, status: 400, error: `El nombre de la insignia admite hasta ${LARGO_MAXIMO_DE_INSIGNIA} caracteres` };
  }

  await pool.query(
    `UPDATE campanas
        SET is_special = true, especial_inicio = $2, especial_fin = $3,
            especial_multiplicador = $4, especial_insignia = $5, updated_at = NOW()
      WHERE id = $1`,
    [campanaId, inicio, fin, multiplicador, insignia || null],
  );
  // A quien participa o tiene su temática; si está pausada, se avisa al reanudarla. Una vez por
  // campaña: editar los incentivos después no vuelve a avisar.
  avisarCampanaEspecial(campanaId);
  return { ok: true };
}

/** Quita los incentivos (vuelve a ser una campaña normal). Solo el creador. */
export async function quitarEspecial(campanaId: number, usuarioId: number): Promise<Resultado> {
  const resultado = await pool.query(
    `UPDATE campanas
        SET is_special = false, especial_inicio = NULL, especial_fin = NULL,
            especial_multiplicador = NULL, especial_insignia = NULL, updated_at = NOW()
      WHERE id = $1 AND creator_id = $2
      RETURNING id`,
    [campanaId, usuarioId],
  );
  if (resultado.rowCount === 0) {
    const existe = await pool.query(`SELECT 1 FROM campanas WHERE id = $1`, [campanaId]);
    return existe.rowCount === 0
      ? { ok: false, status: 404, error: "Campaña no encontrada" }
      : { ok: false, status: 403, error: "Solo quien creó la campaña puede quitarle los incentivos" };
  }
  return { ok: true };
}

/**
 * Para la gamificación: multiplicador de XP de un aporte aprobado en `fecha` ("YYYY-MM-DD",
 * hora de Tepic; por defecto hoy). 1 si la campaña no es especial o la fecha cae fuera del
 * periodo. TODO(gamificación): usarlo al otorgar el XP de un aporte aprobado; el tope diario
 * por usuario sigue vigente (dominio.md § 7) y el bono por cuota es BONO_POR_CUOTA.
 */
export async function multiplicadorDeXp(campanaId: number, fecha: string = hoyEnTepic()): Promise<number> {
  const r = await pool.query(
    `SELECT especial_multiplicador AS m FROM campanas
      WHERE id = $1 AND is_special AND especial_inicio <= $2::date AND especial_fin >= $2::date`,
    [campanaId, fecha],
  );
  return r.rows[0] ? Number(r.rows[0].m) : 1;
}
