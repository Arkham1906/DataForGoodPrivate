"use server";

// Server actions del panel sobre usuarios: asignarRol, revocarRol, aplicarSancion, restaurarAcceso.
// Cada una verifica la sesión raíz (exigirSuperUsuario), aplica la regla, registra en audit_log
// y notifica a la persona.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { pool } from "@/lib/db";
import { hasRootSession } from "@/lib/rootSession";
import { normalizeRoles } from "@/lib/roles";
import { CODIGO_DE_ROL, NOMBRE_DE_ROL, type RolAsignable } from "@/lib/usuarios/rol-asignable";
import type { TipoDeSancion } from "@/lib/usuarios/directorio";
import { retirarComoRevisorDeTodasLasCampanas } from "@/lib/usuarios/revisor";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { TIPOS_DE_SANCION } from "@/lib/sanciones";
import {
  AVISOS_PARA_BANEO,
  consecuenciaDelAviso,
  describirConsecuencia,
  type ConsecuenciaDeAviso,
} from "@/lib/usuarios/escala-de-avisos";
import { agregarAListaNegra, quitarDeListaNegra } from "@/lib/usuarios/lista-negra";
import { leerClaveDeReportes } from "@/lib/reportes/motivos";
import { sqlDeClave } from "@/lib/reportes/reportes";

export type ResultadoDeAccion = { ok: true } | { ok: false; error: string };

/*
 * ────────────────────────────────────────────────────────────────────────────
 * Las cuatro acciones escriben de verdad (asignarRol/revocarRol en
 * `usuarios.role`, aplicarSancion/restaurarAcceso en `sanciones`) y quedan en
 * audit_log. La suspensión y el baneo bloquean la cuenta; los avisos siguen la
 * escala de lib/usuarios/escala-de-avisos.ts y el baneo pone el correo en la
 * lista negra (lib/usuarios/lista-negra.ts). Cada una avisa a la
 * persona con una notificación (lib/notificaciones/notificaciones.ts).
 * ────────────────────────────────────────────────────────────────────────────
 */

async function exigirSuperUsuario(): Promise<void> {
  const autorizado = await hasRootSession();
  if (!autorizado) throw new Error("No autorizado");
}

export async function asignarRol(
  usuarioId: string,
  rol: RolAsignable,
): Promise<ResultadoDeAccion> {
  await exigirSuperUsuario();

  // El revisor de aportes ya no lo asigna el SuperUsuario: lo otorga el
  // creador de una campaña al invitar, y la persona lo acepta desde sus
  // notificaciones (ver POST /api/campanas/[id]/revisores). El SuperUsuario
  // solo puede revocarlo (revocarRol).
  if (rol === "REVISOR_DE_APORTES") {
    return {
      ok: false,
      error:
        "El rol de revisor de aportes ya no se asigna aquí: lo otorga el creador de una campaña al invitar.",
    };
  }

  const numericId = Number(usuarioId);
  if (!Number.isInteger(numericId)) {
    return { ok: false, error: "ID de usuario inválido." };
  }

  try {
    const actual = await pool.query<{ role: string[] | null }>(
      `SELECT role FROM usuarios WHERE id = $1`,
      [numericId],
    );
    if (actual.rowCount === 0) {
      return { ok: false, error: "El usuario no existe." };
    }

    // Supervisor y revisor ya no son mutuamente excluyentes: se agrega el
    // rol sin tocar los que ya tenía (incluido "revisor" si lo era).
    const codigo = CODIGO_DE_ROL[rol];
    const teniaElRol = (actual.rows[0].role ?? []).includes(codigo);
    const nuevosRoles = normalizeRoles([...(actual.rows[0].role ?? []), codigo]);

    await pool.query(`UPDATE usuarios SET role = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
      numericId,
      JSON.stringify(nuevosRoles),
    ]);

    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: "rol.asignar",
      objetivo: { tipo: "usuario", id: numericId },
      detalle: { rol },
    });
    // Aquí solo llega SUPERVISOR: el de revisor se rechaza arriba.
    if (!teniaElRol) {
      await notificar({
        usuarioId: numericId,
        tipo: "rol_asignado",
        titulo: `Ahora eres ${NOMBRE_DE_ROL[rol].toLowerCase()}`,
        mensaje: "Ya puedes tomar campañas en revisión y dictaminarlas desde Supervisión.",
        enlace: "/supervision",
        metadata: { rol },
      });
    }

    revalidatePath(`/usuarios/${usuarioId}/roles`);
    revalidatePath(`/usuarios/${usuarioId}`);
    revalidatePath("/usuarios");
    return { ok: true };
  } catch (error) {
    console.error("Error asignando rol", error);
    return { ok: false, error: "No se pudo asignar el rol." };
  }
}

export async function revocarRol(
  usuarioId: string,
  rol: RolAsignable,
): Promise<ResultadoDeAccion> {
  await exigirSuperUsuario();

  const numericId = Number(usuarioId);
  if (!Number.isInteger(numericId)) {
    return { ok: false, error: "ID de usuario inválido." };
  }

  try {
    const actual = await pool.query<{ role: string[] | null }>(
      `SELECT role FROM usuarios WHERE id = $1`,
      [numericId],
    );
    if (actual.rowCount === 0) {
      return { ok: false, error: "El usuario no existe." };
    }

    // Ya no son mutuamente excluyentes: se retira solo el rol indicado, sin
    // tocar el otro si también lo tenía. Revocar no detiene las campañas
    // activas de esa persona: pasan a la tutela del supervisor del área (esa
    // reasignación aún no existe).
    const codigo = CODIGO_DE_ROL[rol];
    const teniaElRol = (actual.rows[0].role ?? []).includes(codigo);
    const nuevosRoles = normalizeRoles(
      (actual.rows[0].role ?? []).filter((r) => r !== codigo),
    );

    await pool.query(`UPDATE usuarios SET role = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
      numericId,
      JSON.stringify(nuevosRoles),
    ]);

    if (rol === "SUPERVISOR") {
      // Una campaña tiene un solo supervisor: las que tomó y aún no dictamina
      // vuelven a quedar libres para que otro supervisor las tome.
      await pool.query(
        `UPDATE campanas SET supervisor_id = NULL, updated_at = NOW()
         WHERE supervisor_id = $1 AND status = 'en_revision'`,
        [numericId],
      );
    }

    if (rol === "REVISOR_DE_APORTES") {
      // Si era revisor aceptado en alguna campaña, se le retira ahí también:
      // si no, la sesión se lo vuelve a asignar solo con el siguiente login.
      await retirarComoRevisorDeTodasLasCampanas(numericId);
    }

    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: "rol.revocar",
      objetivo: { tipo: "usuario", id: numericId },
      detalle: { rol },
    });
    if (teniaElRol) {
      await notificar({
        usuarioId: numericId,
        tipo: "rol_revocado",
        titulo: `Ya no eres ${NOMBRE_DE_ROL[rol].toLowerCase()}`,
        mensaje:
          rol === "SUPERVISOR"
            ? "La administración retiró tu rol de supervisor. Las campañas que tomaste sin dictaminar quedaron libres."
            : "La administración retiró tu rol de revisor de aportes en todas las campañas.",
        metadata: { rol },
      });
    }

    revalidatePath(`/usuarios/${usuarioId}/roles`);
    revalidatePath(`/usuarios/${usuarioId}`);
    revalidatePath("/usuarios");
    return { ok: true };
  } catch (error) {
    console.error("Error revocando rol", error);
    return { ok: false, error: "No se pudo revocar el rol." };
  }
}

/**
 * Aviso o baneo inmediato (2026-10-12). Un AVISO se guarda como STRIKE y sigue la escala de
 * lib/usuarios/escala-de-avisos.ts según cuántos lleve la cuenta (los strikes de antes cuentan):
 * mensaje, suspensión de 2 días, de 7 días y, al cuarto, baneo + lista negra. BANEO es el baneo
 * inmediato para casos graves, también con lista negra. Con `reportes` (desde /reportes) resuelve en
 * la misma transacción los reportes pendientes de esa clave contra la persona.
 */
export async function aplicarSancion(
  usuarioId: string,
  datos: {
    tipo: TipoDeSancion;
    detalle: string;
    /** Clave de los reportes que se confirman ("campana-116" o "aporte-55"). */
    reportes?: string;
  },
): Promise<ResultadoDeAccion> {
  await exigirSuperUsuario();

  const numericId = Number(usuarioId);
  if (!Number.isInteger(numericId)) {
    return { ok: false, error: "ID de usuario inválido." };
  }

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
        `INSERT INTO sanciones (usuario_id, tipo, detalle) VALUES ($1, 'STRIKE', $2) RETURNING id`,
        [numericId, detalle],
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
        `INSERT INTO sanciones (usuario_id, tipo, detalle) VALUES ($1, 'BANEO_DE_CAMPANA', $2) RETURNING id`,
        [numericId, detalle],
      );
      sancionId = b.rows[0].id;
      bloqueo = { id: sancionId, tipo: "BANEO_DE_CAMPANA", dias: null, nueva: true };
      await agregarAListaNegra(client, { usuarioId: numericId, sancionId, motivo: detalle });
    }

    // Confirmar reportes: los pendientes de esa clave contra esta persona quedan resueltos con esta
    // sanción. Si otro SuperUsuario ya los resolvió, no se sanciona dos veces por lo mismo.
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
    actor: { tipo: "superusuario" },
    accion: "sancion.aplicar",
    objetivo: { tipo: "usuario", id: numericId },
    detalle: {
      tipo: aviso ? "AVISO" : "BANEO",
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

  revalidatePath("/usuarios/sanciones");
  revalidatePath(`/usuarios/${usuarioId}`);
  revalidatePath("/usuarios");
  if (clave) revalidatePath("/reportes");
  redirect("/usuarios/sanciones");
}

export async function restaurarAcceso(
  sancionId: string,
): Promise<ResultadoDeAccion> {
  await exigirSuperUsuario();

  const numericId = Number(sancionId);
  if (!Number.isInteger(numericId)) {
    return { ok: false, error: "ID de sanción inválido." };
  }

  try {
    // El contador de strikes NO se reinicia: se conserva para la escala de
    // penalización, así que esto solo cambia el estado de la cuenta.
    const result = await pool.query<{ usuario_id: number; tipo: string }>(
      `UPDATE sanciones SET activa = false, restaurada_en = NOW()
       -- Un aviso (STRIKE) no se restaura: cuenta para la escala para siempre.
       WHERE id = $1 AND activa = true AND tipo <> 'STRIKE'
       RETURNING usuario_id, tipo`,
      [numericId],
    );
    if (result.rowCount === 0) {
      return { ok: false, error: "La sanción no existe o ya fue restaurada." };
    }

    // Restaurar un baneo saca su correo de la lista negra.
    if (result.rows[0].tipo === "BANEO_DE_CAMPANA") await quitarDeListaNegra(numericId);

    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: "sancion.restaurar",
      objetivo: { tipo: "usuario", id: result.rows[0].usuario_id },
      detalle: { sancionId: numericId, tipo: result.rows[0].tipo },
    });
    // Un strike no bloquea la cuenta: retirarlo no "restaura" nada que avisar.
    if (result.rows[0].tipo !== "STRIKE") {
      await notificar({
        usuarioId: result.rows[0].usuario_id,
        tipo: "sancion_restaurada",
        titulo: "Recuperaste el acceso a tu cuenta",
        mensaje: "La administración levantó la sanción de tu cuenta. Ya puedes volver a participar.",
        metadata: { sancionId: numericId, tipo: result.rows[0].tipo },
      });
    }
  } catch (error) {
    console.error("Error restaurando acceso", error);
    return { ok: false, error: "No se pudo restaurar el acceso." };
  }

  revalidatePath("/usuarios/sanciones");
  revalidatePath("/usuarios");
  return { ok: true };
}
