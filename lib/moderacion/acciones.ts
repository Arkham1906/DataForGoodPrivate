"use server";

// Server actions de la moderación (2026-10-13): aplicarSancion (aviso, suspensión o baneo), restaurarAcceso,
// descartarReportes y quitarBloqueoDeDispositivo. Las usa quien modera desde dos zonas con las mismas
// pantallas (components/moderacion): el SuperUsuario en modo supervisor (/supervisar) y un usuario con
// rol de supervisor (/supervision). Antes eran del panel del SuperUsuario (/usuarios/sanciones, /reportes).
// Cada una recibe la zona y comprueba la sesión que le toca (lib/moderacion/moderador.ts); un supervisor
// no se modera a sí mismo. Registran en audit_log a nombre de quien modera y avisan a la persona.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";
import type { TipoDeSancion } from "@/lib/usuarios/directorio";
import { quitarDeListaNegra } from "@/lib/usuarios/lista-negra";
import {
  avisarSancion,
  detalleDeAuditoria,
  errorDeSancionPedida,
  sancionarEnTransaccion,
  type SancionAplicada,
} from "@/lib/moderacion/sancionar";
import { leerClaveDeReportes } from "@/lib/reportes/motivos";
import { sqlDeClave } from "@/lib/reportes/reportes";
import { restaurarBloqueoGlobal } from "@/lib/aportes/sanciones-anonimas";
import { actorDeModerador, cuentaDelModerador, firmaDeModerador, moderadorDe } from "@/lib/moderacion/moderador";
import { rutasDeModeracion, type ZonaDeModeracion } from "@/lib/moderacion/rutas";

export type ResultadoDeAccion = { ok: true } | { ok: false; error: string };

/** Largo máximo de la nota con la que se descartan reportes. */
const MAXIMO_NOTA = 500;

const NO_AUTORIZADO: ResultadoDeAccion = { ok: false, error: "No autorizado." };
const A_SI_MISMO: ResultadoDeAccion = { ok: false, error: "No puedes moderar tu propia cuenta." };

/** Las dos zonas muestran lo mismo, y el directorio del panel muestra el estado de la cuenta. */
function revalidarModeracion() {
  revalidatePath("/supervisar", "layout");
  revalidatePath("/supervision", "layout");
  revalidatePath("/usuarios", "layout");
}

/**
 * Aviso, suspensión directa (2026-10-16) o baneo inmediato. Las reglas están en
 * lib/moderacion/sancionar.ts (la escala de avisos, los días de la suspensión, la lista negra). Con
 * `reportes` (desde la bandeja de reportes) resuelve en la misma transacción los reportes pendientes de
 * esa clave contra la persona.
 */
export async function aplicarSancion(
  zona: ZonaDeModeracion,
  usuarioId: string,
  datos: {
    tipo: TipoDeSancion;
    detalle: string;
    /** Solo con SUSPENSION_TEMPORAL: 2 o 7. */
    dias?: number;
    /** Clave de los reportes que se confirman ("campana-116" o "aporte-55"). */
    reportes?: string;
  },
): Promise<ResultadoDeAccion> {
  const moderador = await moderadorDe(zona);
  if (!moderador) return NO_AUTORIZADO;

  const numericId = Number(usuarioId);
  if (!Number.isInteger(numericId)) {
    return { ok: false, error: "ID de usuario inválido." };
  }
  if (cuentaDelModerador(moderador) === numericId) return A_SI_MISMO;

  // Una server action se puede invocar con cualquier dato: no basta con que
  // el formulario solo ofrezca estas opciones (sancionarEnTransaccion vuelve a validar).
  const detalle = typeof datos.detalle === "string" ? datos.detalle.trim() : "";
  const pedida = { tipo: datos.tipo, dias: datos.dias };
  const errorDePedida = errorDeSancionPedida(pedida, detalle);
  if (errorDePedida) return { ok: false, error: errorDePedida };
  const clave = datos.reportes === undefined ? null : leerClaveDeReportes(datos.reportes);
  if (datos.reportes !== undefined && !clave) {
    return { ok: false, error: "Reportes inválidos." };
  }

  let reportesResueltos: number[] = [];
  let sancion: SancionAplicada;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const r = await sancionarEnTransaccion(client, {
      usuarioId: numericId,
      pedida,
      detalle,
      firma: firmaDeModerador(moderador),
    });
    if (!r.ok) {
      await client.query("ROLLBACK");
      return { ok: false, error: r.error };
    }
    sancion = r.sancion;

    // Confirmar reportes: los pendientes de esa clave contra esta persona quedan resueltos con esta
    // sanción. Si otro moderador ya los resolvió, no se sanciona dos veces por lo mismo.
    if (clave) {
      const resueltos = await client.query<{ id: number }>(
        `UPDATE reportes
         SET estado = 'sancionado', sancion_id = $3, nota_de_resolucion = $4, resuelto_en = NOW()
         WHERE ${sqlDeClave(clave)} AND reportado_id = $2 AND estado = 'pendiente'
         RETURNING id`,
        [clave.id, numericId, sancion.sancionId, detalle],
      );
      if (resueltos.rowCount === 0) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Esos reportes ya se resolvieron." };
      }
      reportesResueltos = resueltos.rows.map((row) => row.id);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error aplicando sanción", error);
    return { ok: false, error: "No se pudo aplicar la sanción." };
  } finally {
    client.release();
  }

  await registrarAuditoria({
    actor: actorDeModerador(moderador),
    accion: "sancion.aplicar",
    objetivo: { tipo: "usuario", id: numericId },
    detalle: {
      ...detalleDeAuditoria(sancion, detalle),
      zona,
      ...(clave ? { reportes: reportesResueltos, clave: datos.reportes } : {}),
    },
  });

  await avisarSancion(numericId, sancion, detalle);

  revalidarModeracion();
  redirect(rutasDeModeracion(zona).sanciones);
}

/** Levanta una suspensión o un baneo (un aviso no se restaura). Restaurar un baneo saca el correo de la lista negra. */
export async function restaurarAcceso(zona: ZonaDeModeracion, sancionId: string): Promise<ResultadoDeAccion> {
  const moderador = await moderadorDe(zona);
  if (!moderador) return NO_AUTORIZADO;

  const numericId = Number(sancionId);
  if (!Number.isInteger(numericId)) {
    return { ok: false, error: "ID de sanción inválido." };
  }

  try {
    // El contador de strikes NO se reinicia: se conserva para la escala de
    // penalización, así que esto solo cambia el estado de la cuenta.
    // $2: la cuenta del supervisor que modera, que no levanta sus propias sanciones.
    const result = await pool.query<{ usuario_id: number; tipo: string }>(
      `UPDATE sanciones SET activa = false, restaurada_en = NOW()
       -- Un aviso (STRIKE) no se restaura: cuenta para la escala para siempre.
       WHERE id = $1 AND activa = true AND tipo <> 'STRIKE'
         AND ($2::int IS NULL OR usuario_id <> $2)
       RETURNING usuario_id, tipo`,
      [numericId, cuentaDelModerador(moderador)],
    );
    if (result.rowCount === 0) {
      return { ok: false, error: "La sanción no existe o ya fue restaurada." };
    }

    // Restaurar un baneo saca su correo de la lista negra.
    if (result.rows[0].tipo === "BANEO_DE_CAMPANA") await quitarDeListaNegra(numericId);

    await registrarAuditoria({
      actor: actorDeModerador(moderador),
      accion: "sancion.restaurar",
      objetivo: { tipo: "usuario", id: result.rows[0].usuario_id },
      detalle: { sancionId: numericId, tipo: result.rows[0].tipo, zona },
    });
    await notificar({
      usuarioId: result.rows[0].usuario_id,
      tipo: "sancion_restaurada",
      titulo: "Recuperaste el acceso a tu cuenta",
      mensaje: "La administración levantó la sanción de tu cuenta. Ya puedes volver a participar.",
      metadata: { sancionId: numericId, tipo: result.rows[0].tipo },
    });
  } catch (error) {
    console.error("Error restaurando acceso", error);
    return { ok: false, error: "No se pudo restaurar el acceso." };
  }

  revalidarModeracion();
  return { ok: true };
}

/**
 * Descarta todos los reportes pendientes de una campaña o de un aporte (`clave`: "campana-116" o
 * "aporte-55"): no ameritan aviso. Nota opcional. No cuenta para la escala de avisos. Confirmar un
 * reporte se hace con aplicarSancion desde .../sanciones/[usuarioId]?reportes=<clave>, que da el aviso
 * y marca los reportes como resueltos en la misma transacción.
 */
export async function descartarReportes(zona: ZonaDeModeracion, claveTexto: string, nota: string): Promise<ResultadoDeAccion> {
  const moderador = await moderadorDe(zona);
  if (!moderador) return NO_AUTORIZADO;

  const clave = leerClaveDeReportes(claveTexto);
  if (!clave) return { ok: false, error: "Reportes inválidos." };
  const texto = typeof nota === "string" ? nota.trim() : "";
  if (texto.length > MAXIMO_NOTA) return { ok: false, error: `La nota no puede pasar de ${MAXIMO_NOTA} caracteres.` };

  try {
    // $3: un supervisor no descarta los reportes contra él mismo (tampoco los ve en la bandeja).
    const { rows } = await pool.query<{ id: number }>(
      `UPDATE reportes
       SET estado = 'descartado', nota_de_resolucion = $2, resuelto_en = NOW()
       WHERE ${sqlDeClave(clave)} AND estado = 'pendiente'
         AND ($3::int IS NULL OR reportado_id IS DISTINCT FROM $3)
       RETURNING id`,
      [clave.id, texto || null, cuentaDelModerador(moderador)],
    );
    if (rows.length === 0) return { ok: false, error: "Ya no hay reportes pendientes aquí." };

    await registrarAuditoria({
      actor: actorDeModerador(moderador),
      accion: "reporte.descartar",
      objetivo: { tipo: clave.tipo, id: clave.id },
      detalle: { reportes: rows.map((r) => r.id), nota: texto || null, zona },
    });
  } catch (error) {
    console.error("Error descartando reportes", error);
    return { ok: false, error: "No se pudieron descartar los reportes." };
  }

  revalidarModeracion();
  return { ok: true };
}

/** Quita el bloqueo global de un dispositivo anónimo antes de que venza (lib/aportes/sanciones-anonimas.ts). */
export async function quitarBloqueoDeDispositivo(zona: ZonaDeModeracion, bloqueoId: string): Promise<ResultadoDeAccion> {
  const moderador = await moderadorDe(zona);
  if (!moderador) return NO_AUTORIZADO;

  const id = Number(bloqueoId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "ID de bloqueo inválido." };

  try {
    if (!(await restaurarBloqueoGlobal(id, actorDeModerador(moderador)))) {
      return { ok: false, error: "El bloqueo no existe o ya se quitó." };
    }
  } catch (error) {
    console.error("Error quitando bloqueo de dispositivo", error);
    return { ok: false, error: "No se pudo quitar el bloqueo." };
  }

  revalidarModeracion();
  return { ok: true };
}
