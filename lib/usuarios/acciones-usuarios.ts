"use server";

// Server actions del panel sobre usuarios: asignarRol y revocarRol. Cada una verifica la sesión raíz
// (exigirSuperUsuario), aplica la regla, registra en audit_log y notifica a la persona.
// Las sanciones (aviso, baneo, restaurar) ya no están aquí: desde el 2026-10-13 las aplica quien modera
// desde /supervisar o /supervision (lib/moderacion/acciones.ts).

import { revalidatePath } from "next/cache";

import { pool } from "@/lib/db";
import { hasRootSession } from "@/lib/rootSession";
import { normalizeRoles } from "@/lib/roles";
import { CODIGO_DE_ROL, NOMBRE_DE_ROL, type RolAsignable } from "@/lib/usuarios/rol-asignable";
import { retirarComoRevisorDeTodasLasCampanas } from "@/lib/usuarios/revisor";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";

export type ResultadoDeAccion = { ok: true } | { ok: false; error: string };

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
