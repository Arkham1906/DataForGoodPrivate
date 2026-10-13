"use server";

// Server actions de la moderación (2026-10-13): aplicarSancion (aviso o baneo), restaurarAcceso,
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
import { TIPOS_DE_SANCION } from "@/lib/sanciones";
import type { TipoDeSancion } from "@/lib/usuarios/directorio";
import {
  AVISOS_PARA_BANEO,
  consecuenciaDelAviso,
  describirConsecuencia,
  type ConsecuenciaDeAviso,
} from "@/lib/usuarios/escala-de-avisos";
import { agregarAListaNegra, quitarDeListaNegra } from "@/lib/usuarios/lista-negra";
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
 * Aviso o baneo inmediato (2026-10-12). Un AVISO se guarda como STRIKE y sigue la escala de
 * lib/usuarios/escala-de-avisos.ts según cuántos lleve la cuenta (los strikes de antes cuentan):
 * mensaje, suspensión de 2 días, de 7 días y, al cuarto, baneo + lista negra. BANEO es el baneo
 * inmediato para casos graves, también con lista negra. Con `reportes` (desde la bandeja de reportes)
 * resuelve en la misma transacción los reportes pendientes de esa clave contra la persona.
 */
export async function aplicarSancion(
  zona: ZonaDeModeracion,
  usuarioId: string,
  datos: {
    tipo: TipoDeSancion;
    detalle: string;
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
  // el formulario solo ofrezca estas opciones.
  if (!TIPOS_DE_SANCION.has(datos.tipo)) {
    return { ok: false, error: "Tipo de sanción inválido." };
  }
  const detalle = typeof datos.detalle === "string" ? datos.detalle.trim() : "";
  if (detalle.length < 20) {
    return { ok: false, error: "El detalle debe tener al menos 20 caracteres." };
  }
  const clave = datos.reportes === undefined ? null : leerClaveDeReportes(datos.reportes);
  if (datos.reportes !== undefined && !clave) {
    return { ok: false, error: "Reportes inválidos." };
  }

  const firma = firmaDeModerador(moderador);
  let reportesResueltos: number[] = [];
  let aviso: { id: number; numero: number } | null = null;
  // La sanción que bloquea (suspensión o baneo), si la hubo.
  let bloqueo: { id: number; tipo: "SUSPENSION_TEMPORAL" | "BANEO_DE_CAMPANA"; dias: number | null; nueva: boolean } | null = null;
  let consecuencia: ConsecuenciaDeAviso | null = null;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // FOR UPDATE: dos avisos a la vez se forman en fila, así que cada uno cuenta bien su número.
    const usuario = await client.query(`SELECT id FROM usuarios WHERE id = $1 FOR UPDATE`, [numericId]);
    if (usuario.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "El usuario no existe." };
    }

    const { rows: previos } = await client.query<{ avisos: number; baneo_id: number | null }>(
      `SELECT COUNT(*) FILTER (WHERE tipo = 'STRIKE')::int AS avisos,
              MAX(id) FILTER (WHERE activa AND tipo = 'BANEO_DE_CAMPANA') AS baneo_id
       FROM sanciones WHERE usuario_id = $1`,
      [numericId],
    );
    const baneoVigente = previos[0].baneo_id;

    let sancionId: number;
    if (datos.tipo === "STRIKE") {
      const numero = previos[0].avisos + 1;
      consecuencia = consecuenciaDelAviso(numero);
      const insertado = await client.query<{ id: number }>(
        `INSERT INTO sanciones (usuario_id, tipo, detalle, aplicada_por) VALUES ($1, 'STRIKE', $2, $3) RETURNING id`,
        [numericId, detalle, firma],
      );
      aviso = { id: insertado.rows[0].id, numero };
      sancionId = aviso.id;

      // La consecuencia es su propia sanción (la que bloquea y se puede restaurar); su detalle es lo
      // que la persona ve en /cuenta-bloqueada.
      const motivoDelBloqueo = `Aviso ${numero} de ${AVISOS_PARA_BANEO}. ${detalle}`;
      if (consecuencia.tipo === "suspension") {
        const s = await client.query<{ id: number }>(
          `INSERT INTO sanciones (usuario_id, tipo, detalle, dias, aplicada_por)
           VALUES ($1, 'SUSPENSION_TEMPORAL', $2, $3, 'Automático') RETURNING id`,
          [numericId, motivoDelBloqueo, consecuencia.dias],
        );
        bloqueo = { id: s.rows[0].id, tipo: "SUSPENSION_TEMPORAL", dias: consecuencia.dias, nueva: true };
      } else if (consecuencia.tipo === "baneo") {
        if (baneoVigente) {
          bloqueo = { id: baneoVigente, tipo: "BANEO_DE_CAMPANA", dias: null, nueva: false };
        } else {
          const b = await client.query<{ id: number }>(
            `INSERT INTO sanciones (usuario_id, tipo, detalle, aplicada_por)
             VALUES ($1, 'BANEO_DE_CAMPANA', $2, 'Automático') RETURNING id`,
            [numericId, motivoDelBloqueo],
          );
          bloqueo = { id: b.rows[0].id, tipo: "BANEO_DE_CAMPANA", dias: null, nueva: true };
        }
        await agregarAListaNegra(client, { usuarioId: numericId, sancionId: bloqueo.id, motivo: motivoDelBloqueo });
      }
    } else {
      // Baneo inmediato: si ya está baneada no se duplica, pero su correo sí entra a la lista negra.
      if (baneoVigente) {
        await client.query("ROLLBACK");
        return { ok: false, error: "La cuenta ya está baneada." };
      }
      const b = await client.query<{ id: number }>(
        `INSERT INTO sanciones (usuario_id, tipo, detalle, aplicada_por) VALUES ($1, 'BANEO_DE_CAMPANA', $2, $3) RETURNING id`,
        [numericId, detalle, firma],
      );
      sancionId = b.rows[0].id;
      bloqueo = { id: sancionId, tipo: "BANEO_DE_CAMPANA", dias: null, nueva: true };
      await agregarAListaNegra(client, { usuarioId: numericId, sancionId, motivo: detalle });
    }

    // Confirmar reportes: los pendientes de esa clave contra esta persona quedan resueltos con esta
    // sanción. Si otro moderador ya los resolvió, no se sanciona dos veces por lo mismo.
    if (clave) {
      const resueltos = await client.query<{ id: number }>(
        `UPDATE reportes
         SET estado = 'sancionado', sancion_id = $3, nota_de_resolucion = $4, resuelto_en = NOW()
         WHERE ${sqlDeClave(clave)} AND reportado_id = $2 AND estado = 'pendiente'
         RETURNING id`,
        [clave.id, numericId, sancionId, detalle],
      );
      if (resueltos.rowCount === 0) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Esos reportes ya se resolvieron." };
      }
      reportesResueltos = resueltos.rows.map((r) => r.id);
    }

    // Suspensión y baneo no cierran sus sesiones: el bloqueo aplica ya porque
    // getSessionUser deja de aceptarlas, y así la persona ve en la app la
    // pantalla de cuenta bloqueada con el motivo en vez de salir a /entrar.

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
      tipo: aviso ? "AVISO" : "BANEO",
      zona,
      ...(aviso ? { avisoId: aviso.id, aviso: aviso.numero } : {}),
      ...(bloqueo ? { bloqueo: { sancionId: bloqueo.id, tipo: bloqueo.tipo, dias: bloqueo.dias } } : {}),
      listaNegra: bloqueo?.tipo === "BANEO_DE_CAMPANA",
      motivo: detalle,
      ...(clave ? { reportes: reportesResueltos, clave: datos.reportes } : {}),
    },
  });

  // Con suspensión o baneo la persona no puede entrar: la verá al recuperar el acceso.
  // Mientras, /cuenta-bloqueada ya le muestra el motivo.
  const restantes = aviso ? AVISOS_PARA_BANEO - aviso.numero : 0;
  await notificar({
    usuarioId: numericId,
    tipo: "sancion_aplicada",
    titulo: !aviso
      ? "Tu cuenta fue baneada"
      : consecuencia?.tipo === "suspension"
        ? `Tu cuenta se suspendió ${consecuencia.dias} días`
        : consecuencia?.tipo === "baneo"
          ? "Tu cuenta fue baneada"
          : "Tu cuenta lleva un reporte",
    mensaje: `Motivo: ${detalle}${
      aviso
        ? ` Es tu aviso ${aviso.numero} de ${AVISOS_PARA_BANEO}.${
            restantes > 0
              ? ` El siguiente: ${describirConsecuencia(consecuenciaDelAviso(aviso.numero + 1))}.`
              : ""
          }`
        : ""
    }`,
    metadata: {
      sancionId: aviso?.id ?? bloqueo?.id,
      tipo: aviso ? "AVISO" : "BANEO_DE_CAMPANA",
      ...(aviso ? { aviso: aviso.numero } : {}),
      ...(bloqueo?.dias ? { dias: bloqueo.dias } : {}),
    },
  });

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
