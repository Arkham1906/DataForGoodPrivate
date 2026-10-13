// Sanciones para aportes SIN cuenta (dominio.md, punto abierto 18, implementado el 2026-10-01).
// A una persona anónima no hay cuenta que banear: se sanciona su dispositivo (hash de la
// cookie anonimo_id). La IP no se guarda, así que no hay bloqueo por red.
//
//   1. Aporte: el creador o el revisor lo marcan como "Contenido inapropiado" (al rechazarlo, o
//      antes de decidir). Solo esos cuentan para el nivel 4. El creador puede además borrar el
//      archivo de MinIO mientras el aporte no tenga decisión.
//   2. Campaña: el creador bloquea el dispositivo en su campaña (tabla dispositivos_bloqueados
//      con campana_id). Se quita desde "Participantes baneados".
//   3. Enlace: regenerar el token (ya existía) y el interruptor campanas.permite_anonimos.
//   4. Plataforma: INAPROPIADOS_PARA_BLOQUEO aportes inapropiados del mismo dispositivo en
//      VENTANA_DE_DIAS lo bloquean en toda la plataforma DIAS_DE_BLOQUEO días. El
//      SuperUsuario (modo supervisor) o un supervisor lo ve y lo quita en .../sanciones.
//
// Los route handlers verifican quién puede hacer qué; aquí solo se aplican las reglas.

import { pool } from "@/lib/db";
import { borrarArchivo } from "@/lib/minio";
import { registrarAuditoria, type ActorDeAuditoria } from "@/lib/auditoria";
import { tieneDecision } from "@/lib/aportes/decision";

// TODO(dominio): números provisionales que fijó el usuario el 2026-10-01 ("luego se ajusta").
export const INAPROPIADOS_PARA_BLOQUEO = 3;
export const VENTANA_DE_DIAS = 30;
export const DIAS_DE_BLOQUEO = 30;

/** Condición SQL de un bloqueo que sigue en vigor. */
const VIGENTE = `activo AND (hasta IS NULL OR hasta > NOW())`;

/** Si este dispositivo no puede aportar a la campaña. 'global' gana sobre 'campana'. */
export async function bloqueoDelDispositivo(entrada: {
  campanaId: number;
  anonimoId: string | null;
}): Promise<"global" | "campana" | null> {
  if (!entrada.anonimoId) return null;
  const { rows } = await pool.query<{ campana_id: number | null }>(
    `SELECT campana_id FROM dispositivos_bloqueados
     WHERE ${VIGENTE} AND anonimo_id = $2 AND (campana_id IS NULL OR campana_id = $1)
     ORDER BY campana_id NULLS FIRST
     LIMIT 1`,
    [entrada.campanaId, entrada.anonimoId]
  );
  if (rows.length === 0) return null;
  return rows[0].campana_id === null ? "global" : "campana";
}

/**
 * Marca un aporte anónimo como contenido inapropiado y, si con él el dispositivo junta
 * INAPROPIADOS_PARA_BLOQUEO en VENTANA_DE_DIAS, lo bloquea en toda la plataforma.
 * Devuelve false si el aporte no es anónimo. Marcarlo dos veces no cuenta doble.
 * Con soloSinDecision (la marca suelta de POST /api/aportes/[id]/inapropiado), un aporte ya
 * aceptado o rechazado no se marca: devuelve { ok: false, decidido: true }. PATCH no la usa
 * porque marca en el mismo momento en que rechaza.
 */
export async function marcarInapropiado(
  aporteId: number,
  usuarioId: number,
  { soloSinDecision = false }: { soloSinDecision?: boolean } = {}
): Promise<{ ok: boolean; bloqueoGlobal: boolean; decidido?: boolean }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: aportes } = await client.query<{ anonimo_id: string; campaign_id: number; inapropiado: boolean; status: string }>(
      `SELECT anonimo_id, campaign_id, inapropiado, status FROM aportes
       WHERE id = $1 AND user_id IS NULL AND anonimo_id IS NOT NULL
       FOR UPDATE`,
      [aporteId]
    );
    if (aportes.length === 0) {
      await client.query("ROLLBACK");
      return { ok: false, bloqueoGlobal: false };
    }
    const aporte = aportes[0];
    if (soloSinDecision && tieneDecision(aporte.status)) {
      await client.query("ROLLBACK");
      return { ok: false, bloqueoGlobal: false, decidido: true };
    }
    if (aporte.inapropiado) {
      await client.query("ROLLBACK");
      return { ok: true, bloqueoGlobal: false };
    }

    await client.query(
      `UPDATE aportes SET inapropiado = true, inapropiado_por = $2, inapropiado_en = NOW(), updated_at = NOW() WHERE id = $1`,
      [aporteId, usuarioId]
    );

    // Un candado por dispositivo: dos marcas simultáneas no crean dos bloqueos.
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`bloqueo:${aporte.anonimo_id}`]);
    const { rows: conteo } = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM aportes
       WHERE anonimo_id = $1 AND inapropiado AND inapropiado_en > NOW() - make_interval(days => $2)`,
      [aporte.anonimo_id, VENTANA_DE_DIAS]
    );
    const { rowCount: yaBloqueado } = await client.query(
      `SELECT 1 FROM dispositivos_bloqueados WHERE campana_id IS NULL AND anonimo_id = $1 AND ${VIGENTE} LIMIT 1`,
      [aporte.anonimo_id]
    );

    let bloqueoId: number | null = null;
    if (conteo[0].n >= INAPROPIADOS_PARA_BLOQUEO && !yaBloqueado) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO dispositivos_bloqueados (anonimo_id, campana_id, motivo, bloqueado_por, aporte_id, hasta)
         VALUES ($1, NULL, $2, NULL, $3, NOW() + make_interval(days => $4))
         RETURNING id`,
        [
          aporte.anonimo_id,
          `${conteo[0].n} aportes marcados como inapropiados en ${VENTANA_DE_DIAS} días`,
          aporteId,
          DIAS_DE_BLOQUEO,
        ]
      );
      bloqueoId = rows[0].id;
    }
    await client.query("COMMIT");

    await registrarAuditoria({
      actor: { tipo: "usuario", id: usuarioId },
      accion: "aporte.inapropiado",
      objetivo: { tipo: "aporte", id: aporteId },
      detalle: { campanaId: aporte.campaign_id },
    });
    if (bloqueoId !== null) {
      await registrarAuditoria({
        actor: { tipo: "usuario", id: usuarioId },
        accion: "sancion.dispositivo_bloquear",
        objetivo: { tipo: "dispositivo", id: bloqueoId },
        detalle: { aporteId, inapropiados: conteo[0].n, dias: DIAS_DE_BLOQUEO, automatico: true },
      });
    }
    return { ok: true, bloqueoGlobal: bloqueoId !== null };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** El creador aceptó el aporte: manda sobre la marca del revisor. El bloqueo que ya se aplicó se queda. */
export async function quitarMarcaInapropiado(aporteId: number): Promise<void> {
  await pool.query(
    `UPDATE aportes SET inapropiado = false, inapropiado_por = NULL, inapropiado_en = NULL WHERE id = $1 AND inapropiado`,
    [aporteId]
  );
}

/** Id del bloqueo en la campaña del dispositivo que envió este aporte, o null. */
export async function bloqueoEnCampanaDelAporte(aporteId: number): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT b.id FROM aportes a
     JOIN dispositivos_bloqueados b ON b.anonimo_id = a.anonimo_id AND b.campana_id = a.campaign_id
     WHERE a.id = $1 AND b.activo
     LIMIT 1`,
    [aporteId]
  );
  return rows.length ? rows[0].id : null;
}

/** Bloquea en la campaña el dispositivo que envió el aporte. Devuelve false si no es anónimo. */
export async function bloquearEnCampana(entrada: {
  campanaId: number;
  aporteId: number;
  usuarioId: number;
  motivo: string;
}): Promise<boolean> {
  const { rows } = await pool.query<{ anonimo_id: string }>(
    `SELECT anonimo_id FROM aportes WHERE id = $1 AND campaign_id = $2 AND user_id IS NULL AND anonimo_id IS NOT NULL`,
    [entrada.aporteId, entrada.campanaId]
  );
  if (rows.length === 0) return false;

  if ((await bloqueoEnCampanaDelAporte(entrada.aporteId)) === null) {
    const { rows: nuevo } = await pool.query<{ id: number }>(
      `INSERT INTO dispositivos_bloqueados (anonimo_id, campana_id, motivo, bloqueado_por, aporte_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [rows[0].anonimo_id, entrada.campanaId, entrada.motivo, entrada.usuarioId, entrada.aporteId]
    );
    await registrarAuditoria({
      actor: { tipo: "usuario", id: entrada.usuarioId },
      accion: "campana.bloquear_dispositivo",
      objetivo: { tipo: "dispositivo", id: nuevo[0].id },
      detalle: { campanaId: entrada.campanaId, aporteId: entrada.aporteId, motivo: entrada.motivo },
    });
  }
  return true;
}

export type DispositivoBloqueado = {
  bloqueoId: string;
  aporteId: string | null;
  motivo: string;
  bloqueadoEn: string; // ISO
};

/** Dispositivos anónimos bloqueados en la campaña, para "Participantes baneados". */
export async function listarDispositivosBloqueadosDeCampana(campanaId: number): Promise<DispositivoBloqueado[]> {
  const { rows } = await pool.query(
    `SELECT id, aporte_id, motivo, creado_en FROM dispositivos_bloqueados
     WHERE campana_id = $1 AND activo ORDER BY creado_en DESC`,
    [campanaId]
  );
  return rows.map((row) => ({
    bloqueoId: String(row.id),
    aporteId: row.aporte_id != null ? String(row.aporte_id) : null,
    motivo: String(row.motivo ?? ""),
    bloqueadoEn: new Date(row.creado_en).toISOString(),
  }));
}

/** Quita el bloqueo de un dispositivo en la campaña. Devuelve false si no existía. */
export async function desbloquearEnCampana(campanaId: number, bloqueoId: number, usuarioId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE dispositivos_bloqueados SET activo = false, restaurado_en = NOW()
     WHERE id = $1 AND campana_id = $2 AND activo`,
    [bloqueoId, campanaId]
  );
  if (!rowCount) return false;
  await registrarAuditoria({
    actor: { tipo: "usuario", id: usuarioId },
    accion: "campana.desbloquear_dispositivo",
    objetivo: { tipo: "dispositivo", id: bloqueoId },
    detalle: { campanaId },
  });
  return true;
}

/**
 * Borra de MinIO el archivo de un aporte anónimo (contenido ilegal o dañino). La fila se
 * conserva con archivo_borrado_en; quien pida el archivo después recibe 410.
 * Solo mientras el aporte no tenga decisión: aceptado o rechazado ya no se toca. La fila
 * queda bloqueada mientras tanto, así que no choca con una decisión al mismo tiempo.
 */
export async function borrarArchivoDeAporteAnonimo(
  aporteId: number,
  usuarioId: number
): Promise<"ok" | "no-anonimo" | "ya-borrado" | "decidido"> {
  const client = await pool.connect();
  let campanaId: number;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ file_path: string; archivo_borrado_en: Date | null; campaign_id: number; status: string }>(
      `SELECT file_path, archivo_borrado_en, campaign_id, status FROM aportes WHERE id = $1 AND user_id IS NULL FOR UPDATE`,
      [aporteId]
    );
    const fila = rows[0];
    const impedimento = !fila ? "no-anonimo" : tieneDecision(fila.status) ? "decidido" : fila.archivo_borrado_en ? "ya-borrado" : null;
    if (impedimento) {
      await client.query("ROLLBACK");
      return impedimento;
    }

    await borrarArchivo(fila.file_path);
    await client.query(`UPDATE aportes SET archivo_borrado_en = NOW(), updated_at = NOW() WHERE id = $1`, [aporteId]);
    await client.query("COMMIT");
    campanaId = fila.campaign_id;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  await registrarAuditoria({
    actor: { tipo: "usuario", id: usuarioId },
    accion: "aporte.archivo_borrar",
    objetivo: { tipo: "aporte", id: aporteId },
    detalle: { campanaId },
  });
  return "ok";
}

export type BloqueoGlobal = {
  id: string;
  motivo: string;
  desde: Date;
  hasta: Date | null;
  campana: string | null; // campaña del aporte que lo disparó
};

/** Bloqueos globales vigentes, para la pantalla de sanciones de la moderación (/supervisar o /supervision). */
export async function listarBloqueosGlobales(): Promise<BloqueoGlobal[]> {
  const { rows } = await pool.query(
    `SELECT b.id, b.motivo, b.creado_en, b.hasta, c.name AS campana
     FROM dispositivos_bloqueados b
     LEFT JOIN aportes a ON a.id = b.aporte_id
     LEFT JOIN campanas c ON c.id = a.campaign_id
     WHERE b.campana_id IS NULL AND b.activo AND (b.hasta IS NULL OR b.hasta > NOW())
     ORDER BY b.creado_en DESC`
  );
  return rows.map((row) => ({
    id: String(row.id),
    motivo: String(row.motivo ?? ""),
    desde: new Date(row.creado_en),
    hasta: row.hasta ? new Date(row.hasta) : null,
    campana: row.campana ? String(row.campana) : null,
  }));
}

/** Quien modera (SuperUsuario en modo supervisor o un supervisor) quita un bloqueo global antes de que venza. */
export async function restaurarBloqueoGlobal(bloqueoId: number, actor: ActorDeAuditoria): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE dispositivos_bloqueados SET activo = false, restaurado_en = NOW()
     WHERE id = $1 AND campana_id IS NULL AND activo`,
    [bloqueoId]
  );
  if (!rowCount) return false;
  await registrarAuditoria({
    actor,
    accion: "sancion.dispositivo_restaurar",
    objetivo: { tipo: "dispositivo", id: bloqueoId },
  });
  return true;
}
