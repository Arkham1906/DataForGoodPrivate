"use server";

// Server action de la bandeja /reportes: descartarReportes. Confirmar un reporte no está aquí: se hace
// con aplicarSancion (lib/usuarios/acciones-usuarios.ts) desde /usuarios/[id]/sancion?reportes=<clave>,
// que da el aviso y marca los reportes como resueltos en la misma transacción.

import { revalidatePath } from "next/cache";

import { pool } from "@/lib/db";
import { hasRootSession } from "@/lib/rootSession";
import { registrarAuditoria } from "@/lib/auditoria";
import { leerClaveDeReportes } from "@/lib/reportes/motivos";
import { sqlDeClave } from "@/lib/reportes/reportes";

export type ResultadoDeAccion = { ok: true } | { ok: false; error: string };

/** Largo máximo de la nota con la que se descarta. */
const MAXIMO_NOTA = 500;

/**
 * Descarta todos los reportes pendientes de una campaña o de un aporte (`clave`: "campana-116" o
 * "aporte-55"): no ameritan aviso. Nota opcional. No cuenta para la escala de avisos.
 */
export async function descartarReportes(claveTexto: string, nota: string): Promise<ResultadoDeAccion> {
  if (!(await hasRootSession())) return { ok: false, error: "No autorizado." };

  const clave = leerClaveDeReportes(claveTexto);
  if (!clave) return { ok: false, error: "Reportes inválidos." };
  const texto = typeof nota === "string" ? nota.trim() : "";
  if (texto.length > MAXIMO_NOTA) return { ok: false, error: `La nota no puede pasar de ${MAXIMO_NOTA} caracteres.` };

  try {
    const { rows } = await pool.query<{ id: number }>(
      `UPDATE reportes
       SET estado = 'descartado', nota_de_resolucion = $2, resuelto_en = NOW()
       WHERE ${sqlDeClave(clave)} AND estado = 'pendiente'
       RETURNING id`,
      [clave.id, texto || null],
    );
    if (rows.length === 0) return { ok: false, error: "Ya no hay reportes pendientes aquí." };

    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: "reporte.descartar",
      objetivo: { tipo: clave.tipo, id: clave.id },
      detalle: { reportes: rows.map((r) => r.id), nota: texto || null },
    });
  } catch (error) {
    console.error("Error descartando reportes", error);
    return { ok: false, error: "No se pudieron descartar los reportes." };
  }

  revalidatePath("/reportes");
  return { ok: true };
}
