"use server";

// Server action revertirAccion: el SuperUsuario deshace una decisión de un supervisor (2026-10-08).
// Qué hace cada tipo y cuándo se puede está en lib/usuarios/supervisores.ts (describirReversion,
// puedeRevertirse). Registra supervision.revertir en audit_log y avisa al supervisor.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { pool } from "@/lib/db";
import { ipDelCliente } from "@/lib/ip";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { avisarCampanaPorRevisar } from "@/lib/notificaciones/avisos-a-supervisores";
import { hasRootSession } from "@/lib/rootSession";
import {
  CAUSALES_DE_REVERSION,
  ESTADOS_PARA_REVERTIR,
  ETIQUETA_DE_ACCION,
  describirReversion,
  obtenerAccion,
} from "@/lib/usuarios/supervisores";

export type DatosDeReversion = {
  causal: string;
  descripcion: string;
  notificarAfectado: boolean;
  observacionEnExpediente: boolean;
};

const MINIMO_DESCRIPCION = 40;
const MAXIMO_DESCRIPCION = 2000;

async function exigirSuperUsuario(): Promise<void> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
}

/**
 * Revertir es potestad exclusiva del SuperUsuario: ni el propio supervisor ni
 * otro pueden deshacer una decisión ajena.
 *
 * En una transacción: (1) asienta la reversión en audit_log, cuyo índice único
 * impide revertir dos veces la misma acción; (2) deshace el efecto con un UPDATE
 * que vuelve a exigir el estado de la campaña (si cambió mientras tanto, no se
 * aplica nada); (3) deja una fila "reasignada" en campana_supervisores, para que
 * la campaña ya no figure como reportada ni tomada. La acción original no se
 * borra ni se edita: el historial muestra las dos.
 */
export async function revertirAccion(
  supervisorId: string,
  accionId: string,
  datos: DatosDeReversion,
): Promise<{ ok: false; error: string } | never> {
  await exigirSuperUsuario();

  if (!CAUSALES_DE_REVERSION.includes(datos.causal)) {
    return { ok: false, error: "Selecciona una causal." };
  }
  const descripcion = datos.descripcion.trim();
  if (descripcion.length < MINIMO_DESCRIPCION) {
    return {
      ok: false,
      error: `La descripción debe tener al menos ${MINIMO_DESCRIPCION} caracteres.`,
    };
  }
  if (descripcion.length > MAXIMO_DESCRIPCION) {
    return { ok: false, error: `La descripción admite hasta ${MAXIMO_DESCRIPCION} caracteres.` };
  }

  const accion = await obtenerAccion(supervisorId, accionId);
  if (!accion) return { ok: false, error: "No se encontró esa decisión." };
  if (accion.revertidaEn) return { ok: false, error: "Esta decisión ya fue revertida." };
  if (!accion.reversible || !accion.campanaId) {
    return { ok: false, error: accion.noReversiblePorque ?? "Esta decisión no se puede revertir." };
  }

  const campanaId = Number(accion.campanaId);
  const supervisor = Number(supervisorId);
  const etiqueta = ETIQUETA_DE_ACCION[accion.tipo].texto;
  const notificable = describirReversion(accion).notificable;
  const avisarAlCreador = Boolean(datos.notificarAfectado && notificable && accion.creadorId);

  let ip: string | null = null;
  try {
    ip = ipDelCliente(await headers());
  } catch {
    // Fuera de una petición no hay encabezados.
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO audit_log (actor_tipo, actor_id, accion, objetivo_tipo, objetivo_id, detalle, ip)
       VALUES ('superusuario', NULL, 'supervision.revertir', 'campana', $1, $2::jsonb, $3)`,
      [
        String(campanaId),
        JSON.stringify({
          accionId: accion.id,
          supervisorId: String(supervisor),
          tipo: accion.tipo,
          campana: accion.contexto.campana ?? null,
          causal: datos.causal,
          descripcion,
          observacionEnExpediente: datos.observacionEnExpediente,
          creadorNotificado: avisarAlCreador,
        }),
        ip,
      ],
    );

    const estados = ESTADOS_PARA_REVERTIR[accion.tipo];
    if (estados) {
      // Tomó, aceptó o rechazó: la campaña vuelve a En revisión y a la cola, sin supervisor.
      const { rowCount } = await client.query(
        `UPDATE campanas
         SET status = 'en_revision', supervisor_id = NULL, supervisado_por_root = false, updated_at = NOW()
         WHERE id = $1 AND supervisor_id = $2 AND status = ANY($3::text[])
           AND NOT EXISTS (
             SELECT 1 FROM audit_log d
             WHERE d.objetivo_tipo = 'campana' AND d.objetivo_id = $1::text AND d.id > $4
               AND d.accion = $5
           )`,
        [
          campanaId,
          supervisor,
          estados,
          Number(accion.id),
          // Liberar una toma: que no la haya vuelto a tomar. Aceptar o rechazar: que sea el último dictamen.
          accion.tipo === "TOMO_CAMPANA" ? "supervision.tomar" : "supervision.dictaminar",
        ],
      );
      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return { ok: false, error: "La campaña cambió mientras tanto. Vuelve a cargar la página." };
      }
    }

    // Lo que leen las listas de supervisión (latest_supervision_action). Un reporte retirado solo
    // se marca si sigue siendo lo último que pasó con la campaña.
    await client.query(
      `INSERT INTO campana_supervisores (campana_id, supervisor_id, por_superusuario, accion, motivo)
       SELECT $1, NULL, true, 'reasignada', $2
       WHERE $3::boolean OR (
         SELECT accion FROM campana_supervisores WHERE campana_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1
       ) = 'reportada'`,
      [campanaId, `Reversión del SuperUsuario: ${datos.causal}`, Boolean(estados)],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: "Esta decisión ya fue revertida." };
    }
    console.error("Error revirtiendo una decisión de supervisor", error);
    return { ok: false, error: "No se pudo revertir. Intenta de nuevo." };
  } finally {
    client.release();
  }

  const campana = accion.contexto.campana ?? "la campaña";
  await notificar({
    usuarioId: supervisor,
    tipo: "supervision_revertida",
    titulo: "Se revirtió una de tus decisiones",
    mensaje: `El SuperUsuario revirtió «${etiqueta}» en "${campana}". Motivo: ${datos.causal}. ${descripcion}`,
    campanaId,
    enlace: "/supervision",
    metadata: { causal: datos.causal },
  });
  if (avisarAlCreador && accion.creadorId) {
    await notificar({
      usuarioId: accion.creadorId,
      tipo: "campana_en_revision",
      titulo: "Tu campaña vuelve a revisión",
      mensaje: `Tu campaña "${campana}" vuelve a revisión: un supervisor la revisará de nuevo.`,
      campanaId,
      enlace: "/mis-campanas",
    });
  }
  // Volvió a la fila de revisión sin supervisor: avisa a los demás supervisores.
  if (ESTADOS_PARA_REVERTIR[accion.tipo]) {
    avisarCampanaPorRevisar({ id: campanaId, creadorId: Number(accion.creadorId), otraVez: true, excluir: [supervisor] });
  }

  revalidatePath(`/usuarios/supervisores/${supervisorId}`);
  revalidatePath("/usuarios/supervisores");
  redirect(`/usuarios/supervisores/${supervisorId}`);
}
