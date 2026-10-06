// Baja voluntaria de cuenta (SCR-WEB-31, /cuenta/eliminar). Tres momentos:
//
// 1. solicitarBaja(): con la confirmación ya validada. Guarda el destino de los aportes y
//    la fecha efectiva (DIAS_DE_GRACIA), cierra todas las sesiones, finaliza las campañas
//    propias activas o pausadas y borra las que no tienen ningún aporte (borradores,
//    en revisión, aceptadas). Las finalizadas no se tocan.
// 2. cancelarBajaSiPendiente(): iniciar sesión dentro del plazo cancela la baja (lo llaman
//    el login y el regreso de Google). Las campañas ya finalizadas siguen finalizadas.
// 3. ejecutarBajasVencidas(): al vencer el plazo (lo corre instrumentation-node.ts cada
//    hora). Aplica el destino de los aportes y vacía la fila de datos personales. La fila
//    NO se borra: campanas.creator_id es ON DELETE CASCADE y se llevaría las campañas
//    finalizadas con los aportes de otras personas.
//
// Aporte "ya utilizado" = aceptado en una campaña finalizada (forma parte de los datos
// abiertos publicados en /datos): nunca se borra; con "eliminar" se anonimiza igual.

import { pool } from "@/lib/db";
import { borrarArchivo } from "@/lib/minio";
import { registrarAuditoria } from "@/lib/auditoria";
import { recalcularContadores } from "@/lib/aportes/comun";
import { retirarComoRevisorDeTodasLasCampanas } from "@/lib/usuarios/revisor";
import { DIAS_DE_GRACIA, type DestinoDeAportes } from "@/lib/usuarios/baja-opciones";

/** Nombre con el que quedan los aportes anonimizados. */
const NOMBRE_ANONIMO = "Anónimo";
/** Nombre de la fila vacía y de sus campañas tras el borrado definitivo. */
const NOMBRE_CUENTA_ELIMINADA = "Cuenta eliminada";

/* ── Resumen para la pantalla ──────────────────────────────────────────────── */

export type ResumenDeBaja = {
  aportes: {
    total: number;
    campanas: number;
    /** Aceptados en campañas finalizadas: no se pueden borrar. */
    utilizados: number;
    aceptadosSinUso: number;
    pendientes: number;
    rechazados: number;
  };
  campanasPropias: { aFinalizar: number; aBorrar: number };
  xp: number;
  nivel: number;
};

export async function obtenerResumenDeBaja(usuarioId: number): Promise<ResumenDeBaja> {
  const [aportes, campanas, usuario] = await Promise.all([
    pool.query<{
      total: number;
      campanas: number;
      utilizados: number;
      aceptados_sin_uso: number;
      pendientes: number;
      rechazados: number;
    }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(DISTINCT a.campaign_id)::int AS campanas,
              COUNT(*) FILTER (WHERE a.status = 'aceptado' AND c.status = 'finalizada')::int AS utilizados,
              COUNT(*) FILTER (WHERE a.status = 'aceptado' AND c.status <> 'finalizada')::int AS aceptados_sin_uso,
              COUNT(*) FILTER (WHERE a.status IN ('pendiente', 'espera_final'))::int AS pendientes,
              COUNT(*) FILTER (WHERE a.status = 'rechazado')::int AS rechazados
       FROM aportes a JOIN campanas c ON c.id = a.campaign_id
       WHERE a.user_id = $1`,
      [usuarioId]
    ),
    pool.query<{ a_finalizar: number; a_borrar: number }>(
      `SELECT COUNT(*) FILTER (WHERE status IN ('activa', 'pausada'))::int AS a_finalizar,
              COUNT(*) FILTER (
                WHERE status NOT IN ('activa', 'pausada', 'finalizada')
                  AND NOT EXISTS (SELECT 1 FROM aportes a WHERE a.campaign_id = campanas.id)
              )::int AS a_borrar
       FROM campanas WHERE creator_id = $1`,
      [usuarioId]
    ),
    pool.query<{ xp_total: number; level: number }>(`SELECT xp_total, level FROM usuarios WHERE id = $1`, [usuarioId]),
  ]);

  const a = aportes.rows[0];
  return {
    aportes: {
      total: a?.total ?? 0,
      campanas: a?.campanas ?? 0,
      utilizados: a?.utilizados ?? 0,
      aceptadosSinUso: a?.aceptados_sin_uso ?? 0,
      pendientes: a?.pendientes ?? 0,
      rechazados: a?.rechazados ?? 0,
    },
    campanasPropias: {
      aFinalizar: campanas.rows[0]?.a_finalizar ?? 0,
      aBorrar: campanas.rows[0]?.a_borrar ?? 0,
    },
    xp: Number(usuario.rows[0]?.xp_total ?? 0),
    nivel: Number(usuario.rows[0]?.level ?? 1),
  };
}

/* ── 1. Pedir la baja ──────────────────────────────────────────────────────── */

export type BajaSolicitada = {
  efectivaEn: Date;
  campanasFinalizadas: number;
  campanasBorradas: number;
};

export async function solicitarBaja(usuarioId: number, destino: DestinoDeAportes): Promise<BajaSolicitada> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const usuario = await client.query<{ baja_efectiva_en: Date }>(
      `UPDATE usuarios
       SET baja_solicitada_en = NOW(),
           baja_efectiva_en = NOW() + make_interval(days => $2),
           baja_destino_aportes = $3,
           updated_at = NOW()
       WHERE id = $1 AND eliminada_en IS NULL
       RETURNING baja_efectiva_en`,
      [usuarioId, DIAS_DE_GRACIA, destino]
    );
    if (usuario.rowCount === 0) throw new Error(`La cuenta ${usuarioId} no existe o ya fue eliminada`);

    // Sin aportes y sin publicar: no queda nada que conservar. Sus tablas hijas
    // (revisores, enlaces, guardadas...) se borran en cascada.
    const borradas = await client.query(
      `DELETE FROM campanas
       WHERE creator_id = $1
         AND status NOT IN ('activa', 'pausada', 'finalizada')
         AND NOT EXISTS (SELECT 1 FROM aportes a WHERE a.campaign_id = campanas.id)`,
      [usuarioId]
    );
    const finalizadas = await client.query(
      `UPDATE campanas SET status = 'finalizada', updated_at = NOW()
       WHERE creator_id = $1 AND status IN ('activa', 'pausada')`,
      [usuarioId]
    );

    // Ninguna sesión abierta: volver a entrar es lo que cancela la baja.
    await client.query(`DELETE FROM sessions WHERE usuario_id = $1`, [usuarioId]);

    await client.query("COMMIT");

    const resultado = {
      efectivaEn: new Date(usuario.rows[0].baja_efectiva_en),
      campanasFinalizadas: finalizadas.rowCount ?? 0,
      campanasBorradas: borradas.rowCount ?? 0,
    };
    await registrarAuditoria({
      actor: { tipo: "usuario", id: usuarioId },
      accion: "usuario.baja_solicitar",
      objetivo: { tipo: "usuario", id: usuarioId },
      detalle: { destino, ...resultado, efectivaEn: resultado.efectivaEn.toISOString() },
    });
    return resultado;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/* ── 2. Cancelarla al iniciar sesión ───────────────────────────────────────── */

/** Si la cuenta tenía una baja en curso, la cancela. Devuelve true si había una. */
export async function cancelarBajaSiPendiente(usuarioId: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE usuarios
     SET baja_solicitada_en = NULL, baja_efectiva_en = NULL, baja_destino_aportes = NULL, updated_at = NOW()
     WHERE id = $1 AND baja_solicitada_en IS NOT NULL AND eliminada_en IS NULL`,
    [usuarioId]
  );
  if (!result.rowCount) return false;

  await registrarAuditoria({
    actor: { tipo: "usuario", id: usuarioId },
    accion: "usuario.baja_cancelar",
    objetivo: { tipo: "usuario", id: usuarioId },
  });
  return true;
}

/* ── 3. Borrado definitivo al vencer el plazo ──────────────────────────────── */

export async function ejecutarBajasVencidas(): Promise<void> {
  const vencidas = await pool.query<{ id: number }>(
    `SELECT id FROM usuarios
     WHERE baja_efectiva_en <= NOW() AND eliminada_en IS NULL
     ORDER BY baja_efectiva_en`
  );
  for (const { id } of vencidas.rows) {
    try {
      await ejecutarBaja(id);
    } catch (error) {
      // Una cuenta con problemas no detiene las demás; se reintenta en la siguiente vuelta.
      console.error(`No se pudo completar la baja de la cuenta ${id}`, error);
    }
  }
}

async function ejecutarBaja(usuarioId: number): Promise<void> {
  const client = await pool.connect();
  const archivosABorrar: string[] = [];
  let destino: DestinoDeAportes;
  let aportesBorrados = 0;
  let aportesConservados = 0;

  try {
    await client.query("BEGIN");

    // Se vuelve a revisar con la fila bloqueada: si inició sesión justo ahora, ya no aplica.
    const usuario = await client.query<{ baja_destino_aportes: DestinoDeAportes }>(
      `SELECT baja_destino_aportes FROM usuarios
       WHERE id = $1 AND baja_efectiva_en <= NOW() AND eliminada_en IS NULL
       FOR UPDATE`,
      [usuarioId]
    );
    if (usuario.rowCount === 0) {
      await client.query("ROLLBACK");
      return;
    }
    destino = usuario.rows[0].baja_destino_aportes ?? "anonimizar";

    if (destino === "eliminar") {
      // Todo menos lo ya utilizado (aceptado en una campaña finalizada).
      const borrados = await client.query<{ campaign_id: number; file_path: string | null; archivo_borrado_en: Date | null }>(
        `DELETE FROM aportes a
         USING campanas c
         WHERE c.id = a.campaign_id
           AND a.user_id = $1
           AND NOT (a.status = 'aceptado' AND c.status = 'finalizada')
         RETURNING a.campaign_id, a.file_path, a.archivo_borrado_en`,
        [usuarioId]
      );
      aportesBorrados = borrados.rowCount ?? 0;
      for (const fila of borrados.rows) {
        if (fila.file_path && !fila.archivo_borrado_en) archivosABorrar.push(fila.file_path);
      }
      const campanasAfectadas = [...new Set(borrados.rows.map((fila) => fila.campaign_id))].sort((x, y) => x - y);
      for (const campaignId of campanasAfectadas) {
        await recalcularContadores(campaignId, client);
      }
    }

    // Lo que queda. user_id se conserva (apunta a la fila vacía): así sigue contando como
    // el mismo participante y no se confunde con un aporte anónimo por enlace (user_id NULL).
    const conservados = await client.query(
      destino === "autoria"
        ? `UPDATE aportes SET participant_email = NULL WHERE user_id = $1`
        : `UPDATE aportes SET participant_name = $2, participant_email = NULL WHERE user_id = $1`,
      destino === "autoria" ? [usuarioId] : [usuarioId, NOMBRE_ANONIMO]
    );
    aportesConservados = conservados.rowCount ?? 0;

    await client.query(`DELETE FROM notificaciones WHERE usuario_id = $1`, [usuarioId]);
    await client.query(`DELETE FROM push_suscripciones WHERE usuario_id = $1`, [usuarioId]);
    await client.query(`DELETE FROM campanas_guardadas WHERE usuario_id = $1`, [usuarioId]);
    await client.query(`DELETE FROM sessions WHERE usuario_id = $1`, [usuarioId]);
    // Sus campañas (finalizadas) se quedan, pero sin su nombre: creator_name es una copia.
    await client.query(`UPDATE campanas SET creator_name = $2 WHERE creator_id = $1`, [usuarioId, NOMBRE_CUENTA_ELIMINADA]);
    // Campañas que había tomado para supervisar y siguen sin dictamen: vuelven a la fila.
    await client.query(
      `UPDATE campanas SET supervisor_id = NULL, updated_at = NOW()
       WHERE supervisor_id = $1 AND status IN ('borrador', 'en_revision', 'rechazada')`,
      [usuarioId]
    );

    // La fila queda vacía. El correo cambia a uno inválido y único: el original queda
    // libre para registrar una cuenta nueva. Sin contraseña ni Google, nadie puede entrar.
    await client.query(
      `UPDATE usuarios
       SET nombre = $2, apellidos = '', email = 'eliminada-' || id || '@cuenta.invalid',
           password_hash = NULL, google_id = NULL, email_verificado = false,
           state = NULL, city = NULL, specialty = NULL, intereses = '[]'::jsonb, role = '["usuario"]'::jsonb,
           xp_total = 0, level = 1, streak_days = 0,
           failed_login_attempts = 0, locked_until = NULL,
           verification_code_hash = NULL, verification_code_expires_at = NULL, verification_attempts = 0,
           eliminada_en = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [usuarioId, NOMBRE_CUENTA_ELIMINADA]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  await retirarComoRevisorDeTodasLasCampanas(usuarioId);

  for (const archivo of archivosABorrar) {
    await borrarArchivo(archivo).catch((error) => {
      console.error(`No se pudo borrar de MinIO ${archivo} (baja de la cuenta ${usuarioId})`, error);
    });
  }

  await registrarAuditoria({
    actor: { tipo: "usuario", id: usuarioId },
    accion: "usuario.baja_ejecutar",
    objetivo: { tipo: "usuario", id: usuarioId },
    detalle: { destino, aportesBorrados, aportesConservados },
    guardarIp: false,
  });
}
