"use server";

// Server actions del panel sobre usuarios: asignarRol y revocarRol. Cada una verifica la sesión raíz
// (exigirSuperUsuario), aplica la regla, registra en audit_log y notifica a la persona.
// Desde el 2026-11-22 también dan y quitan los permisos del usuario común (creador de campaña y aportador,
// lib/usuarios/rol-asignable.ts). Quitar el de creador no toca sus campañas: las sigue administrando.
// Las sanciones (aviso, baneo, restaurar) ya no están aquí: desde el 2026-10-13 las aplica quien modera
// desde /supervisar o /supervision (lib/moderacion/acciones.ts).

import { revalidatePath } from "next/cache";

import { pool } from "@/lib/db";
import { hasRootSession } from "@/lib/rootSession";
import { agregarRol, columnaDeRoles, quitarRol } from "@/lib/usuarios/tabla-roles";
import {
  CODIGO_DE_ROL,
  NOMBRE_DE_ROL,
  SIN_ROL_DE_APORTADOR,
  SIN_ROL_DE_CREADOR,
  type RolAsignable,
} from "@/lib/usuarios/rol-asignable";
import { retirarComoRevisorDeTodasLasCampanas } from "@/lib/usuarios/revisor";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";

export type ResultadoDeAccion = { ok: true } | { ok: false; error: string };

type Aviso = { titulo: string; mensaje: string; enlace?: string };

/** Lo que se le avisa a la persona al darle el rol (el de revisor no llega aquí: lo da la invitación). */
const AVISO_AL_ASIGNAR: Record<Exclude<RolAsignable, "REVISOR_DE_APORTES">, Aviso> = {
  SUPERVISOR: {
    titulo: `Ahora eres ${NOMBRE_DE_ROL.SUPERVISOR.toLowerCase()}`,
    mensaje: "Ya puedes tomar campañas en revisión y dictaminarlas desde Supervisión.",
    enlace: "/supervision",
  },
  // Creador y aportador (2026-11-22): toda cuenta los tiene, así que darlos es devolverlos.
  CREADOR_DE_CAMPANAS: {
    titulo: "Puedes volver a crear campañas",
    mensaje: "La administración te devolvió el rol de creador de campaña: ya puedes crear campañas y enviarlas a revisión.",
    enlace: "/mis-campanas",
  },
  APORTADOR: {
    titulo: "Puedes volver a aportar",
    mensaje: "La administración te devolvió el rol de aportador: ya puedes inscribirte a campañas y enviar aportes.",
    enlace: "/campanas",
  },
};

/** Lo que se le avisa a la persona al quitarle el rol. */
const AVISO_AL_QUITAR: Record<RolAsignable, Aviso> = {
  SUPERVISOR: {
    titulo: `Ya no eres ${NOMBRE_DE_ROL.SUPERVISOR.toLowerCase()}`,
    mensaje: "La administración retiró tu rol de supervisor. Las campañas que tomaste sin dictaminar quedaron libres.",
  },
  REVISOR_DE_APORTES: {
    titulo: `Ya no eres ${NOMBRE_DE_ROL.REVISOR_DE_APORTES.toLowerCase()}`,
    mensaje: "La administración retiró tu rol de revisor de aportes en todas las campañas.",
  },
  CREADOR_DE_CAMPANAS: { titulo: "Ya no puedes crear campañas", mensaje: SIN_ROL_DE_CREADOR, enlace: "/mis-campanas" },
  APORTADOR: { titulo: "Ya no puedes aportar", mensaje: SIN_ROL_DE_APORTADOR, enlace: "/mis-aportes" },
};

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
      `SELECT ${columnaDeRoles()} FROM usuarios WHERE id = $1`,
      [numericId],
    );
    if (actual.rowCount === 0) {
      return { ok: false, error: "El usuario no existe." };
    }

    // Supervisor y revisor ya no son mutuamente excluyentes: se agrega el
    // rol sin tocar los que ya tenía (incluido "revisor" si lo era).
    const codigo = CODIGO_DE_ROL[rol];
    const teniaElRol = (actual.rows[0].role ?? []).includes(codigo);
    await agregarRol(pool, numericId, codigo);

    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: "rol.asignar",
      objetivo: { tipo: "usuario", id: numericId },
      detalle: { rol },
    });
    // Aquí no llega REVISOR_DE_APORTES: se rechaza arriba.
    if (!teniaElRol) {
      await notificar({
        usuarioId: numericId,
        tipo: "rol_asignado",
        ...AVISO_AL_ASIGNAR[rol],
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
      `SELECT ${columnaDeRoles()} FROM usuarios WHERE id = $1`,
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
    await quitarRol(pool, numericId, codigo);

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
        ...AVISO_AL_QUITAR[rol],
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
