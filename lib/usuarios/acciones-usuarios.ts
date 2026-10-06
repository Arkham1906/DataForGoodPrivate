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
import { STRIKES_PARA_BANEO, TIPOS_DE_SANCION } from "@/lib/sanciones";

export type ResultadoDeAccion = { ok: true } | { ok: false; error: string };

/*
 * ────────────────────────────────────────────────────────────────────────────
 * Las cuatro acciones escriben de verdad (asignarRol/revocarRol en
 * `usuarios.role`, aplicarSancion/restaurarAcceso en `sanciones`) y quedan en
 * audit_log. La suspensión y el baneo bloquean la cuenta, y al tercer
 * STRIKE la cuenta se banea sola (lib/sanciones.ts). Cada una avisa a la
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

export async function aplicarSancion(
  usuarioId: string,
  datos: { tipo: TipoDeSancion; detalle: string; dias?: number },
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
  if (
    datos.tipo === "SUSPENSION_TEMPORAL" &&
    !(Number.isInteger(datos.dias) && (datos.dias as number) >= 1)
  ) {
    return { ok: false, error: "Indica cuántos días dura la suspensión (un número entero mayor que cero)." };
  }

  const dias = datos.tipo === "SUSPENSION_TEMPORAL" ? datos.dias : null;
  const client = await pool.connect();
  let sancionId: number;
  let baneoAutomatico: { id: number; strikes: number } | null = null;
  let strikes: number | null = null;

  try {
    await client.query("BEGIN");

    // FOR UPDATE: dos strikes aplicados a la vez se forman en fila, así que
    // el conteo de abajo no puede generar dos baneos automáticos.
    const usuario = await client.query(`SELECT id FROM usuarios WHERE id = $1 FOR UPDATE`, [numericId]);
    if (usuario.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "El usuario no existe." };
    }

    const sancion = await client.query<{ id: number }>(
      `INSERT INTO sanciones (usuario_id, tipo, detalle, dias)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [numericId, datos.tipo, detalle, dias],
    );
    sancionId = sancion.rows[0].id;

    // Al llegar a STRIKES_PARA_BANEO strikes la cuenta se banea sola, salvo
    // que ya tenga un baneo activo.
    if (datos.tipo === "STRIKE") {
      const conteo = await client.query<{ strikes: number; baneada: boolean }>(
        `SELECT COUNT(*) FILTER (WHERE tipo = 'STRIKE')::int AS strikes,
                BOOL_OR(activa AND tipo = 'BANEO_DE_CAMPANA') AS baneada
         FROM sanciones WHERE usuario_id = $1`,
        [numericId],
      );
      const { baneada } = conteo.rows[0];
      strikes = conteo.rows[0].strikes;
      if (strikes >= STRIKES_PARA_BANEO && !baneada) {
        const baneo = await client.query<{ id: number }>(
          `INSERT INTO sanciones (usuario_id, tipo, detalle, aplicada_por)
           VALUES ($1, 'BANEO_DE_CAMPANA', $2, 'Automático') RETURNING id`,
          [numericId, `Baneo automático al acumular ${strikes} strikes.`],
        );
        baneoAutomatico = { id: baneo.rows[0].id, strikes };
      }
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
    detalle: { sancionId, tipo: datos.tipo, dias, motivo: detalle },
  });
  // Con suspensión o baneo la persona no puede entrar: la verá al recuperar el acceso.
  // Mientras, /cuenta-bloqueada ya le muestra el motivo.
  await notificar({
    usuarioId: numericId,
    tipo: "sancion_aplicada",
    titulo:
      datos.tipo === "STRIKE"
        ? "Recibiste un strike"
        : datos.tipo === "SUSPENSION_TEMPORAL"
          ? "Tu cuenta fue suspendida"
          : "Tu cuenta fue bloqueada",
    mensaje:
      datos.tipo === "STRIKE"
        ? `Motivo: ${detalle}${strikes ? ` Llevas ${strikes} de ${STRIKES_PARA_BANEO}: al llegar a ${STRIKES_PARA_BANEO} la cuenta se bloquea.` : ""}`
        : datos.tipo === "SUSPENSION_TEMPORAL"
          ? `Suspensión de ${dias} ${dias === 1 ? "día" : "días"}. Motivo: ${detalle}`
          : `Motivo: ${detalle}`,
    metadata: { sancionId, tipo: datos.tipo, ...(dias ? { dias } : {}) },
  });
  if (baneoAutomatico) {
    await notificar({
      usuarioId: numericId,
      tipo: "sancion_aplicada",
      titulo: "Tu cuenta fue bloqueada",
      mensaje: `Se bloqueó automáticamente al acumular ${baneoAutomatico.strikes} strikes.`,
      metadata: { sancionId: baneoAutomatico.id, tipo: "BANEO_DE_CAMPANA", automatico: true },
    });
    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: "sancion.aplicar",
      objetivo: { tipo: "usuario", id: numericId },
      detalle: {
        sancionId: baneoAutomatico.id,
        tipo: "BANEO_DE_CAMPANA",
        automatico: true,
        strikes: baneoAutomatico.strikes,
      },
    });
  }

  revalidatePath("/usuarios/sanciones");
  revalidatePath(`/usuarios/${usuarioId}`);
  revalidatePath("/usuarios");
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
       WHERE id = $1 AND activa = true
       RETURNING usuario_id, tipo`,
      [numericId],
    );
    if (result.rowCount === 0) {
      return { ok: false, error: "La sanción no existe o ya fue restaurada." };
    }

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
