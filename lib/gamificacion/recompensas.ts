// Recompensa de un aporte aceptado (2026-11-09; SRS v1.3: RF-GAM-01 a 08, 37 a 39, 57, 59, 60, 67). Al aceptarse un
// aporte con cuenta: EXP con la fórmula de RF-GAM-03 (lib/gamificacion/exp-reglas.ts) y los parámetros vigentes,
// un movimiento en exp_movimientos con todo lo usado en el cálculo, los contadores de usuario_progreso y
// usuario_contadores, el bono de cuota si se completó y, al final, la evaluación de rango y medallas (evaluacion.ts).

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { calificacionDesde } from "@/lib/aportes/calificacion";
import { SQL_SANCION_BLOQUEANTE } from "@/lib/sanciones";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { multiplicadorDeXp } from "@/lib/campanas/especial";
import type { NuevaNotificacion } from "@/lib/notificaciones/notificaciones";
import { bonoDeCuota, calcularExpDeAporte, redondearExp } from "./exp-reglas";
import { leerParametros } from "./parametros";
import { enviarAvisos, evaluarProgreso } from "./evaluacion";

type Consultor = Pick<PoolClient, "query">;

const TIPOS_CON_CONTADOR = new Set(["texto", "foto", "video", "audio", "documento"]);
const ESTADOS_QUE_DAN_EXP = new Set(["activa", "pausada"]);
const PENDIENTES_POR_PASADA = 200;

async function sumarContador(client: Consultor, usuarioId: number, dimension: string, clave: string): Promise<void> {
  await client.query(
    `INSERT INTO usuario_contadores (usuario_id, dimension, clave, valor) VALUES ($1, $2, $3, 1)
      ON CONFLICT (usuario_id, dimension, clave) DO UPDATE
        SET valor = usuario_contadores.valor + 1, actualizado_en = NOW()`,
    [usuarioId, dimension, clave],
  );
}

/** Bono por completar la cuota de la campaña (RF-GAM-37 a 39), una sola vez por persona y campaña. */
async function concederBonoDeCuota(
  client: Consultor,
  entrada: { usuarioId: number; campanaId: number; campanaNombre: string; cuota: number; cierre: string | null; version: number },
  parametros: Parameters<typeof bonoDeCuota>[1],
): Promise<void> {
  const { usuarioId, campanaId, cuota } = entrada;
  if (cuota < parametros.bonoCuota.cuotaMinima) return;
  const previo = await client.query(`SELECT 1 FROM campana_cuota_bonos WHERE usuario_id = $1 AND campana_id = $2`, [
    usuarioId,
    campanaId,
  ]);
  if (previo.rows.length > 0) return;

  // Los aportes que cumplieron la cuota: los primeros en enviarse, antes del cierre, que dieron EXP (RF-GAM-38).
  const { rows } = await client.query<{ exp_base: number; mult: number }>(
    `SELECT m.exp_base, m.mult_calidad::float8 AS mult
      FROM exp_movimientos m
      JOIN aportes a ON a.id = m.aporte_id
      WHERE m.usuario_id = $1 AND m.campana_id = $2 AND m.tipo = 'aporte'
        AND ($3::date IS NULL OR (a.submitted_at AT TIME ZONE $4)::date <= $3::date)
      ORDER BY a.submitted_at, a.id
      LIMIT $5`,
    [usuarioId, campanaId, entrada.cierre, ZONA_DE_CAMPANAS, cuota],
  );
  if (rows.length < cuota) return;
  const bono = bonoDeCuota({ cuota, referencias: rows.map((r) => redondearExp(r.exp_base * r.mult)) }, parametros);
  if (!bono) return;

  const movimiento = await client.query<{ id: string }>(
    `INSERT INTO exp_movimientos (usuario_id, tipo, exp, motivo, campana_id, parametros_version, clave_idempotencia)
      VALUES ($1, 'bono_campana', $2, $3, $4, $5, $6)
      ON CONFLICT (clave_idempotencia) DO NOTHING
      RETURNING id::text AS id`,
    [usuarioId, bono.bono, `Bono por completar la cuota de "${entrada.campanaNombre}"`, campanaId, entrada.version,
      `bono_cuota:${campanaId}:${usuarioId}`],
  );
  if (movimiento.rows.length === 0) return;
  await client.query(
    `INSERT INTO campana_cuota_bonos (usuario_id, campana_id, cuota, exp_referencia, bono, exp_movimiento_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (usuario_id, campana_id) DO NOTHING`,
    [usuarioId, campanaId, cuota, bono.referencia, bono.bono, movimiento.rows[0].id],
  );
  // El bono no cuenta como aporte ni toca los contadores de calificación (RF-GAM-39).
  await client.query(
    `UPDATE usuario_progreso
      SET exp_total = exp_total + $2, campanas_completadas = campanas_completadas + 1, actualizado_en = NOW()
      WHERE usuario_id = $1`,
    [usuarioId, bono.bono],
  );
}

/** El trabajo en sí; el llamador abre la transacción (o el SAVEPOINT). */
async function otorgar(client: Consultor, aporteId: number | string): Promise<NuevaNotificacion[]> {
  const parametros = await leerParametros(client);
  if (!parametros?.lanzamiento) return [];

  const { rows } = await client.query<{
    user_id: number | null;
    status: string;
    file_type: string;
    calificacion: number | null;
    exp_otorgada: number | null;
    campaign_id: number;
    tras_lanzamiento: boolean;
    campana_status: string;
    campana_nombre: string;
    tematica: string | null;
    cuota: number;
    cierre: string | null;
    dia_de_envio: string;
  }>(
    `SELECT a.user_id, a.status, a.file_type, a.calificacion, a.exp_otorgada, a.campaign_id,
            (a.reviewed_at >= $2) AS tras_lanzamiento,
            c.status AS campana_status, c.name AS campana_nombre, c.tematica, c.quota_per_user AS cuota,
            to_char(c.end_date, 'YYYY-MM-DD') AS cierre,
            to_char(a.submitted_at AT TIME ZONE $3, 'YYYY-MM-DD') AS dia_de_envio
      FROM aportes a
      JOIN campanas c ON c.id = a.campaign_id
      WHERE a.id = $1
      FOR NO KEY UPDATE OF a`,
    [aporteId, parametros.lanzamiento.toISOString(), ZONA_DE_CAMPANAS],
  );
  const aporte = rows[0];
  if (!aporte || aporte.status !== "aceptado" || aporte.user_id == null || aporte.exp_otorgada !== null) return [];
  if (!aporte.tras_lanzamiento) return [];
  const usuarioId = Number(aporte.user_id);

  const progreso = await client.query(`SELECT 1 FROM usuario_progreso WHERE usuario_id = $1 FOR UPDATE`, [usuarioId]);
  if (progreso.rows.length === 0) return [];

  const cuentaR = await client.query<{ congelada: boolean; sancionada: boolean }>(
    `SELECT (u.baja_solicitada_en IS NOT NULL OR u.eliminada_en IS NOT NULL) AS congelada,
            ${SQL_SANCION_BLOQUEANTE} AS sancionada
      FROM usuarios u WHERE u.id = $1`,
    [usuarioId],
  );
  const cuenta = cuentaR.rows[0];
  const daExp = ESTADOS_QUE_DAN_EXP.has(aporte.campana_status) && !!cuenta && !cuenta.congelada && !cuenta.sancionada;
  if (!daExp) {
    await client.query(`UPDATE aportes SET exp_otorgada = 0 WHERE id = $1`, [aporteId]);
    // Sigue contando como aceptado para Pulso Firme: se evalúa igual.
    return evaluarProgreso(client, usuarioId);
  }

  // El potenciador vigente a la hora de envío, aunque ya haya expirado (RF-GAM-36).
  const potenciadorR = await client.query<{ id: number; bonificacion: number }>(
    `SELECT p.id, p.bonificacion::float8 AS bonificacion
      FROM potenciadores p, aportes a
      WHERE a.id = $2 AND p.usuario_id = $1 AND p.activado_en IS NOT NULL
        AND p.activado_en <= a.submitted_at AND p.vence_en > a.submitted_at
      ORDER BY p.activado_en DESC
      LIMIT 1`,
    [usuarioId, aporteId],
  );
  const potenciador = potenciadorR.rows[0] ?? null;
  // Un aceptado sin calificación no debería existir (el PATCH la exige); si aparece, vale ★1, la preseleccionada (RF-GAM-09).
  const calificacion = calificacionDesde(aporte.calificacion) ?? 1;
  const calculo = calcularExpDeAporte(
    {
      tipo: aporte.file_type,
      calificacion,
      // La campaña especial vigente el día en que se envió, como el potenciador (RN-GAM-04).
      multCampana: await multiplicadorDeXp(aporte.campaign_id, aporte.dia_de_envio),
      bonificacionPotenciador: potenciador?.bonificacion ?? 0,
    },
    parametros.valores,
  );

  const movimiento = await client.query<{ id: string }>(
    `INSERT INTO exp_movimientos (usuario_id, tipo, exp, motivo, aporte_id, campana_id, exp_base, calificacion,
                                  mult_calidad, mult_campana, potenciador_id, bonificacion_potenciador, factor,
                                  parametros_version, clave_idempotencia)
      VALUES ($1, 'aporte', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (clave_idempotencia) DO NOTHING
      RETURNING id::text AS id`,
    [
      usuarioId,
      calculo.exp,
      `Aporte aceptado en "${aporte.campana_nombre}"`,
      aporteId,
      aporte.campaign_id,
      calculo.base,
      calificacion,
      calculo.multCalidad,
      calculo.multCampana,
      potenciador?.id ?? null,
      potenciador ? calculo.bonificacionPotenciador : null,
      calculo.factor,
      parametros.version,
      `aporte:${aporteId}`,
    ],
  );
  if (movimiento.rows.length === 0) {
    // Ya había un movimiento (reintento tras un fallo a medias): solo se marca el aporte con lo que se dio.
    await client.query(
      `UPDATE aportes SET exp_otorgada = (SELECT exp FROM exp_movimientos WHERE clave_idempotencia = $2) WHERE id = $1`,
      [aporteId, `aporte:${aporteId}`],
    );
    return [];
  }

  // Los de 5★ cuentan también como de 4★ o más (RN-GAM-07).
  await client.query(
    `UPDATE usuario_progreso
      SET exp_total = exp_total + $2,
          aportes_aceptados = aportes_aceptados + 1,
          aportes_excelentes = aportes_excelentes + $3,
          aportes_excepcionales = aportes_excepcionales + $4,
          actualizado_en = NOW()
      WHERE usuario_id = $1`,
    [usuarioId, calculo.exp, calificacion >= 4 ? 1 : 0, calificacion === 5 ? 1 : 0],
  );
  await client.query(`UPDATE aportes SET exp_otorgada = $2 WHERE id = $1`, [aporteId, calculo.exp]);

  // Contadores de las medallas y de la tabla de líderes por temática (RF-GAM-06).
  if (TIPOS_CON_CONTADOR.has(aporte.file_type)) await sumarContador(client, usuarioId, "tipo", aporte.file_type);
  await sumarContador(client, usuarioId, "campana", String(aporte.campaign_id));
  if (aporte.tematica) {
    const clave = claveDeTematica(aporte.tematica);
    const tematica = await client.query<{ id: number }>(`SELECT id FROM tematicas WHERE clave = $1 LIMIT 1`, [clave]);
    // Sin fila en el catálogo, la clave normalizada: la temática sigue contando como distinta.
    await sumarContador(client, usuarioId, "tematica", tematica.rows[0] ? String(tematica.rows[0].id) : clave);
  }

  await concederBonoDeCuota(
    client,
    {
      usuarioId,
      campanaId: aporte.campaign_id,
      campanaNombre: aporte.campana_nombre,
      cuota: Number(aporte.cuota ?? 0),
      cierre: aporte.cierre,
      version: parametros.version,
    },
    parametros.valores,
  );

  return evaluarProgreso(client, usuarioId);
}

/**
 * Dentro de la transacción que acepta el aporte, después del UPDATE. Nunca lanza: si falla, deshace solo lo suyo
 * (SAVEPOINT) y lo retoma repararRecompensasPendientes(). Devuelve los avisos para mandarlos después del COMMIT.
 */
export async function recompensarAporteAceptado(client: Consultor, aporteId: number | string): Promise<NuevaNotificacion[]> {
  await client.query("SAVEPOINT recompensa_de_aporte");
  try {
    const avisos = await otorgar(client, aporteId);
    await client.query("RELEASE SAVEPOINT recompensa_de_aporte");
    return avisos;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT recompensa_de_aporte").catch(() => {});
    console.error(`Error dando la recompensa del aporte ${aporteId}; se reintentará`, error);
    return [];
  }
}

/** Aportes aceptados desde el lanzamiento que quedaron sin procesar (un fallo en la aceptación). Nunca lanza. */
export async function repararRecompensasPendientes(): Promise<void> {
  try {
    const { rows } = await pool.query<{ id: number }>(
      `SELECT a.id FROM aportes a
        WHERE a.status = 'aceptado' AND a.user_id IS NOT NULL AND a.exp_otorgada IS NULL
          AND a.reviewed_at >= (SELECT MIN(lanzamiento_en) FROM parametros_gamificacion)
          AND a.reviewed_at < NOW() - INTERVAL '1 minute'
        ORDER BY a.reviewed_at
        LIMIT ${PENDIENTES_POR_PASADA}`,
    );
    for (const { id } of rows) {
      let avisos: NuevaNotificacion[] = [];
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        avisos = await otorgar(client, id);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`Error reintentando la recompensa del aporte ${id}`, error);
        continue;
      } finally {
        client.release();
      }
      await enviarAvisos(avisos);
    }
  } catch (error) {
    console.error("Error buscando recompensas pendientes", error);
  }
}
