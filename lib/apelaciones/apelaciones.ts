// Apelaciones (2026-11-22, a pedido del usuario). Reglas en ./reglas.ts; tabla en lib/db-schema.ts (ensureApelacionesTable).
// - La persona apela desde /mis-apelaciones o, si su cuenta está bloqueada, desde /cuenta-bloqueada (lib/apelaciones/acciones.ts).
// - El SuperUsuario las resuelve en /apelaciones del panel. Aceptar deshace la decisión en la misma transacción:
//   aviso → anulada_en (deja de contar para la escala) y se levanta el bloqueo que ese aviso trajo (la suspensión o el
//   baneo "Automático" que se insertó en la misma transacción, con el mismo aplicada_en; lib/moderacion/sancionar.ts);
//   suspensión o baneo → anulada y levantada (activa = false), y el baneo sale de la lista negra;
//   baneo en una campaña → se borra de campana_baneados (como "Quitar baneo" del creador) y queda campana.desbanear.
// - La persona recibe la respuesta (apelacion_aceptada / apelacion_rechazada); al quitar un baneo en una campaña,
//   también quien la organiza.

import type { PoolClient } from "pg";

import { pool } from "@/lib/db";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { formatearFecha, formatearFechaYHora } from "@/lib/usuarios/directorio";
import {
  DIAS_PARA_APELAR,
  MOTIVO_MAXIMO,
  MOTIVO_MINIMO,
  RESPUESTA_MAXIMA,
  RESPUESTA_MINIMA,
  errorDeTexto,
  tituloDeDecision,
  type ClaseDeDecision,
  type DecisionApelada,
  type EstadoDeApelacion,
} from "./reglas";

export type Resultado = { ok: true } | { ok: false; error: string };

/** Una decisión que la persona todavía puede apelar. `clave`: "s<id>" (sanción) o "b<id>" (baneo en una campaña). */
export type DecisionApelable = { clave: string; decision: DecisionApelada; venceEn: Date };

export type ApelacionDeLaPersona = {
  id: string;
  estado: EstadoDeApelacion;
  decision: DecisionApelada;
  motivo: string;
  respuesta: string | null;
  creadaEn: Date;
  resueltaEn: Date | null;
};

export type ApelacionDelPanel = ApelacionDeLaPersona & {
  persona: { id: string; nombre: string };
  /** La decisión sigue en pie (no se levantó por otro lado mientras esperaba). */
  sigueVigente: boolean;
};

const CLASE_POR_TIPO: Record<string, ClaseDeDecision> = {
  STRIKE: "aviso",
  SUSPENSION_TEMPORAL: "suspension",
  BANEO_DE_CAMPANA: "baneo",
};

/** "Automático" es la escala de avisos (lib/moderacion/sancionar.ts). */
const quienAplico = (aplicadaPor: string) => (aplicadaPor === "Automático" ? "Escala de avisos" : aplicadaPor);

const venceEn = (desde: Date) => new Date(desde.getTime() + DIAS_PARA_APELAR * 86_400_000);

/** Hasta cuándo se apela una sanción: el plazo, o antes si es una suspensión que termina primero (2026-11-23). */
function limiteDeSancion(s: { tipo: string; aplicada_en: Date; dias: number | null }): Date {
  const plazo = venceEn(s.aplicada_en);
  if (s.tipo !== "SUSPENSION_TEMPORAL") return plazo;
  const fin = new Date(s.aplicada_en.getTime() + (s.dias ?? 0) * 86_400_000);
  return fin < plazo ? fin : plazo;
}

/* ── lo que ve la persona ───────────────────────────────────────────────── */

type FilaDeSancion = {
  id: number;
  tipo: string;
  detalle: string;
  dias: number | null;
  aplicada_en: Date;
  aplicada_por: string;
  numero: number | null;
};

type FilaDeBaneo = { id: number; motivo: string; created_at: Date; campana_id: number; campana: string; quien: string };

function decisionDeSancion(s: FilaDeSancion): DecisionApelada {
  const clase = CLASE_POR_TIPO[s.tipo] ?? "baneo";
  return {
    clase,
    ...(clase === "aviso" && s.numero ? { numero: Number(s.numero) } : {}),
    ...(clase === "suspension" && s.dias ? { dias: Number(s.dias) } : {}),
    motivo: s.detalle,
    aplicadaEn: s.aplicada_en.toISOString(),
    aplicadaPor: quienAplico(s.aplicada_por),
  };
}

function decisionDeBaneo(b: FilaDeBaneo): DecisionApelada {
  return {
    clase: "baneo_campana",
    motivo: b.motivo,
    aplicadaEn: b.created_at.toISOString(),
    aplicadaPor: b.quien,
    campana: { id: String(b.campana_id), nombre: b.campana },
  };
}

/** La suspensión `s` ya terminó (aplicada_en + dias). Una terminada no se apela (2026-11-23, a pedido del usuario). */
const SQL_SUSPENSION_TERMINADA = `s.aplicada_en + (COALESCE(s.dias, 0) || ' days')::interval <= NOW()`;

/** Número de cada aviso de la persona, sin contar los anulados (el mismo que usa la escala). */
const SQL_AVISOS = `
  SELECT id, ROW_NUMBER() OVER (ORDER BY aplicada_en, id)::int AS numero
  FROM sanciones WHERE usuario_id = $1 AND tipo = 'STRIKE' AND anulada_en IS NULL`;

/** Lo que la persona puede apelar ahora y las apelaciones que ya mandó. */
export async function apelacionesDeLaPersona(
  usuarioId: number,
): Promise<{ apelables: DecisionApelable[]; apelaciones: ApelacionDeLaPersona[] }> {
  const [sanciones, baneos, apelaciones] = await Promise.all([
    pool.query<FilaDeSancion>(
      `WITH avisos AS (${SQL_AVISOS})
       SELECT s.id, s.tipo, s.detalle, s.dias, s.aplicada_en, s.aplicada_por, a.numero
       FROM sanciones s LEFT JOIN avisos a ON a.id = s.id
       WHERE s.usuario_id = $1 AND s.anulada_en IS NULL AND s.restaurada_en IS NULL
         AND s.aplicada_en > NOW() - make_interval(days => $2)
         -- Una suspensión solo se apela mientras sigue activa (2026-11-23, a pedido del usuario).
         AND NOT (s.tipo = 'SUSPENSION_TEMPORAL' AND ${SQL_SUSPENSION_TERMINADA})
         AND NOT EXISTS (SELECT 1 FROM apelaciones p WHERE p.sancion_id = s.id)
       ORDER BY s.aplicada_en DESC, s.id DESC`,
      [usuarioId, DIAS_PARA_APELAR],
    ),
    pool.query<FilaDeBaneo>(
      `SELECT b.id, b.motivo, b.created_at, c.id AS campana_id, c.name AS campana,
              COALESCE(NULLIF(TRIM(q.nombre || ' ' || q.apellidos), ''), c.creator_name, 'Quien organiza la campaña') AS quien
       FROM campana_baneados b
       JOIN campanas c ON c.id = b.campana_id
       LEFT JOIN usuarios q ON q.id = b.baneado_por
       WHERE b.usuario_id = $1 AND b.created_at > NOW() - make_interval(days => $2)
         AND NOT EXISTS (SELECT 1 FROM apelaciones p WHERE p.baneo_id = b.id)
       ORDER BY b.created_at DESC`,
      [usuarioId, DIAS_PARA_APELAR],
    ),
    pool.query<{
      id: number;
      estado: EstadoDeApelacion;
      decision: DecisionApelada;
      motivo: string;
      respuesta: string | null;
      creada_en: Date;
      resuelta_en: Date | null;
    }>(
      `SELECT id, estado, decision, motivo, respuesta, creada_en, resuelta_en
       FROM apelaciones WHERE usuario_id = $1 ORDER BY creada_en DESC`,
      [usuarioId],
    ),
  ]);

  const apelables: DecisionApelable[] = [
    ...sanciones.rows.map((s) => ({ clave: `s${s.id}`, decision: decisionDeSancion(s), venceEn: limiteDeSancion(s) })),
    ...baneos.rows.map((b) => ({ clave: `b${b.id}`, decision: decisionDeBaneo(b), venceEn: venceEn(b.created_at) })),
  ].sort((a, b) => b.decision.aplicadaEn.localeCompare(a.decision.aplicadaEn));

  return {
    apelables,
    apelaciones: apelaciones.rows.map((a) => ({
      id: String(a.id),
      estado: a.estado,
      decision: a.decision,
      motivo: a.motivo,
      respuesta: a.respuesta,
      creadaEn: a.creada_en,
      resueltaEn: a.resuelta_en,
    })),
  };
}

/** La persona apela una decisión (`clave` de apelacionesDeLaPersona). Una sola vez y dentro del plazo. */
export async function enviarApelacion(usuarioId: number, clave: string, motivoEscrito: string): Promise<Resultado> {
  const motivo = typeof motivoEscrito === "string" ? motivoEscrito.trim() : "";
  const errorDeMotivo = errorDeTexto(motivo, MOTIVO_MINIMO, MOTIVO_MAXIMO, "Tu explicación");
  if (errorDeMotivo) return { ok: false, error: errorDeMotivo };

  const partes = /^(s|b)([1-9]\d{0,9})$/.exec(typeof clave === "string" ? clave : "");
  if (!partes) return { ok: false, error: "No encontramos esa decisión." };
  const [, tipo, idTexto] = partes;
  const id = Number(idTexto);

  const client = await pool.connect();
  let apelacionId: number;
  let decision: DecisionApelada;
  try {
    await client.query("BEGIN");

    if (tipo === "s") {
      const { rows } = await client.query<FilaDeSancion & { usuario_id: number; anulada_en: Date | null; restaurada_en: Date | null }>(
        `SELECT id, usuario_id, tipo, detalle, dias, aplicada_en, aplicada_por, anulada_en, restaurada_en, NULL::int AS numero
         FROM sanciones WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const s = rows[0];
      const error = !s || s.usuario_id !== usuarioId
        ? "No encontramos esa decisión."
        : s.anulada_en || s.restaurada_en
          ? "Esa sanción ya se levantó: no hace falta apelarla."
          : s.tipo === "SUSPENSION_TEMPORAL" && s.aplicada_en.getTime() + (s.dias ?? 0) * 86_400_000 <= Date.now()
            ? "Esa suspensión ya terminó: solo se apela mientras sigue activa."
          : venceEn(s.aplicada_en).getTime() < Date.now()
            ? `Pasaron los ${DIAS_PARA_APELAR} días para apelarla.`
            : null;
      if (error) {
        await client.query("ROLLBACK");
        return { ok: false, error };
      }
      if (s.tipo === "STRIKE") {
        const numero = await client.query<{ numero: number }>(`WITH avisos AS (${SQL_AVISOS}) SELECT numero FROM avisos WHERE id = $2`, [
          usuarioId,
          id,
        ]);
        s.numero = numero.rows[0]?.numero ?? null;
      }
      decision = decisionDeSancion(s);
      const insertada = await client.query<{ id: number }>(
        `INSERT INTO apelaciones (usuario_id, tipo, sancion_id, decision, motivo) VALUES ($1, 'sancion', $2, $3, $4) RETURNING id`,
        [usuarioId, id, JSON.stringify(decision), motivo],
      );
      apelacionId = insertada.rows[0].id;
    } else {
      const { rows } = await client.query<FilaDeBaneo & { usuario_id: number }>(
        `SELECT b.id, b.usuario_id, b.motivo, b.created_at, c.id AS campana_id, c.name AS campana,
                COALESCE(NULLIF(TRIM(q.nombre || ' ' || q.apellidos), ''), c.creator_name, 'Quien organiza la campaña') AS quien
         FROM campana_baneados b
         JOIN campanas c ON c.id = b.campana_id
         LEFT JOIN usuarios q ON q.id = b.baneado_por
         WHERE b.id = $1
         FOR UPDATE OF b`,
        [id],
      );
      const b = rows[0];
      const error = !b || b.usuario_id !== usuarioId
        ? "No encontramos ese baneo: quizá ya te lo quitaron."
        : venceEn(b.created_at).getTime() < Date.now()
          ? `Pasaron los ${DIAS_PARA_APELAR} días para apelarlo.`
          : null;
      if (error) {
        await client.query("ROLLBACK");
        return { ok: false, error };
      }
      decision = decisionDeBaneo(b);
      const insertada = await client.query<{ id: number }>(
        `INSERT INTO apelaciones (usuario_id, tipo, baneo_id, campana_id, decision, motivo)
         VALUES ($1, 'baneo_campana', $2, $3, $4, $5) RETURNING id`,
        [usuarioId, id, b.campana_id, JSON.stringify(decision), motivo],
      );
      apelacionId = insertada.rows[0].id;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    // Índice único: ya hay una apelación de esa decisión (dos envíos casi al mismo tiempo).
    if ((error as { code?: string }).code === "23505") return { ok: false, error: "Ya apelaste esta decisión." };
    console.error("No se pudo guardar la apelación", error);
    return { ok: false, error: "No se pudo enviar tu apelación. Intenta de nuevo." };
  } finally {
    client.release();
  }

  await registrarAuditoria({
    actor: { tipo: "usuario", id: usuarioId },
    accion: "apelacion.enviar",
    objetivo: { tipo: "apelacion", id: apelacionId },
    detalle: { clase: decision.clase, clave },
  });
  return { ok: true };
}

/* ── lo que ve el SuperUsuario ──────────────────────────────────────────── */

export async function contarApelacionesPendientes(): Promise<number> {
  try {
    const { rows } = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM apelaciones WHERE estado = 'pendiente'`);
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Pendientes (las más viejas primero: llevan más esperando) o resueltas (las 300 más recientes). */
export async function listarApelacionesDelPanel(vista: "pendientes" | "resueltas"): Promise<ApelacionDelPanel[]> {
  const { rows } = await pool.query<{
    id: number;
    estado: EstadoDeApelacion;
    decision: DecisionApelada;
    motivo: string;
    respuesta: string | null;
    creada_en: Date;
    resuelta_en: Date | null;
    usuario_id: number;
    nombre: string;
    sigue_vigente: boolean;
  }>(
    `SELECT a.id, a.estado, a.decision, a.motivo, a.respuesta, a.creada_en, a.resuelta_en,
            u.id AS usuario_id, TRIM(u.nombre || ' ' || u.apellidos) AS nombre,
            CASE WHEN a.tipo = 'sancion'
                 THEN EXISTS (SELECT 1 FROM sanciones s WHERE s.id = a.sancion_id AND s.anulada_en IS NULL AND s.restaurada_en IS NULL
                                AND NOT (s.tipo = 'SUSPENSION_TEMPORAL' AND ${SQL_SUSPENSION_TERMINADA}))
                 ELSE a.baneo_id IS NOT NULL END AS sigue_vigente
     FROM apelaciones a
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE ${vista === "pendientes" ? "a.estado = 'pendiente'" : "a.estado <> 'pendiente'"}
     ORDER BY ${vista === "pendientes" ? "a.creada_en ASC" : "a.resuelta_en DESC"}
     LIMIT 300`,
  );
  return rows.map((a) => ({
    id: String(a.id),
    estado: a.estado,
    decision: a.decision,
    motivo: a.motivo,
    respuesta: a.respuesta,
    creadaEn: a.creada_en,
    resueltaEn: a.resuelta_en,
    persona: { id: String(a.usuario_id), nombre: a.nombre },
    sigueVigente: a.sigue_vigente,
  }));
}

/** Deshace la sanción apelada; devuelve las sanciones que quedaron levantadas. */
async function anularSancion(client: PoolClient, sancionId: number): Promise<{ id: number; tipo: string }[]> {
  const { rows } = await client.query<{ tipo: string; usuario_id: number; anulada_en: Date | null }>(
    `SELECT tipo, usuario_id, anulada_en FROM sanciones WHERE id = $1 FOR UPDATE`,
    [sancionId],
  );
  const s = rows[0];
  if (!s || s.anulada_en) return [];

  const anuladas = await client.query<{ id: number; tipo: string }>(
    `UPDATE sanciones
     SET anulada_en = NOW(),
         activa = CASE WHEN tipo = 'STRIKE' THEN activa ELSE false END,
         restaurada_en = CASE WHEN tipo = 'STRIKE' THEN restaurada_en ELSE COALESCE(restaurada_en, NOW()) END
     WHERE (id = $1)
        -- El bloqueo que trajo ese aviso: la escala lo inserta en la misma transacción, con el mismo aplicada_en.
        -- Se compara dentro de SQL: un Date de JavaScript pierde los microsegundos y nunca coincidiría.
        OR ($3 AND usuario_id = $2 AND aplicada_por = 'Automático' AND tipo <> 'STRIKE'
            AND aplicada_en = (SELECT aplicada_en FROM sanciones WHERE id = $1) AND anulada_en IS NULL)
     RETURNING id, tipo`,
    [sancionId, s.usuario_id, s.tipo === "STRIKE"],
  );
  const baneos = anuladas.rows.filter((r) => r.tipo === "BANEO_DE_CAMPANA").map((r) => r.id);
  if (baneos.length > 0) {
    await client.query(`DELETE FROM lista_negra_correos WHERE sancion_id = ANY($1::int[])`, [baneos]);
  }
  return anuladas.rows;
}

/** El SuperUsuario acepta (y se deshace la decisión) o rechaza una apelación, con una respuesta para la persona. */
export async function resolverApelacion(apelacionId: number, aceptar: boolean, respuestaEscrita: string): Promise<Resultado> {
  const respuesta = typeof respuestaEscrita === "string" ? respuestaEscrita.trim() : "";
  const errorDeRespuesta = errorDeTexto(respuesta, RESPUESTA_MINIMA, RESPUESTA_MAXIMA, "La respuesta");
  if (errorDeRespuesta) return { ok: false, error: errorDeRespuesta };
  if (!Number.isInteger(apelacionId) || apelacionId <= 0) return { ok: false, error: "Apelación inválida." };

  const client = await pool.connect();
  let a: {
    usuario_id: number;
    tipo: "sancion" | "baneo_campana";
    sancion_id: number | null;
    baneo_id: number | null;
    decision: DecisionApelada;
  };
  let levantadas: { id: number; tipo: string }[] = [];
  let baneoQuitado: { campana_id: number; baneado_por: number } | null = null;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<typeof a & { estado: EstadoDeApelacion }>(
      `SELECT usuario_id, tipo, sancion_id, baneo_id, decision, estado FROM apelaciones WHERE id = $1 FOR UPDATE`,
      [apelacionId],
    );
    if (!rows[0] || rows[0].estado !== "pendiente") {
      await client.query("ROLLBACK");
      return { ok: false, error: rows[0] ? "Esa apelación ya se resolvió." : "No encontramos esa apelación." };
    }
    a = rows[0];

    if (aceptar && a.tipo === "sancion" && a.sancion_id) levantadas = await anularSancion(client, a.sancion_id);
    if (aceptar && a.tipo === "baneo_campana" && a.baneo_id) {
      const quitado = await client.query<{ campana_id: number; baneado_por: number }>(
        `DELETE FROM campana_baneados WHERE id = $1 RETURNING campana_id, baneado_por`,
        [a.baneo_id],
      );
      baneoQuitado = quitado.rows[0] ?? null;
    }

    await client.query(`UPDATE apelaciones SET estado = $2, respuesta = $3, resuelta_en = NOW() WHERE id = $1`, [
      apelacionId,
      aceptar ? "aceptada" : "rechazada",
      respuesta,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("No se pudo resolver la apelación", error);
    return { ok: false, error: "No se pudo guardar la decisión. Intenta de nuevo." };
  } finally {
    client.release();
  }

  await registrarAuditoria({
    actor: { tipo: "superusuario" },
    accion: aceptar ? "apelacion.aceptar" : "apelacion.rechazar",
    objetivo: { tipo: "usuario", id: a.usuario_id },
    detalle: {
      apelacionId,
      clase: a.decision.clase,
      ...(a.sancion_id ? { sancionId: a.sancion_id } : {}),
      ...(levantadas.length > 0 ? { levantadas } : {}),
      ...(a.decision.campana ? { campanaId: Number(a.decision.campana.id) } : {}),
    },
  });
  if (baneoQuitado) {
    // Igual que "Quitar baneo" del creador: el historial de sanciones lo muestra como levantado.
    await registrarAuditoria({
      actor: { tipo: "superusuario" },
      accion: "campana.desbanear",
      objetivo: { tipo: "usuario", id: a.usuario_id },
      detalle: { campanaId: baneoQuitado.campana_id, porApelacion: apelacionId },
    });
  }

  const titulo = tituloDeDecision(a.decision);
  await notificar({
    usuarioId: a.usuario_id,
    tipo: aceptar ? "apelacion_aceptada" : "apelacion_rechazada",
    titulo: aceptar ? "Aceptamos tu apelación" : "Tu apelación no procede",
    mensaje: `${titulo}. ${aceptar ? "La decisión se deshizo." : "La decisión se mantiene."} Respuesta: ${respuesta}`,
    campanaId: a.decision.campana?.id ?? null,
    enlace: "/mis-apelaciones",
    metadata: { apelacionId, clase: a.decision.clase },
  });
  if (baneoQuitado) {
    const persona = await pool
      .query<{ nombre: string }>(`SELECT TRIM(nombre || ' ' || apellidos) AS nombre FROM usuarios WHERE id = $1`, [a.usuario_id])
      .then((r) => r.rows[0]?.nombre || "Una persona")
      .catch(() => "Una persona");
    await notificar({
      usuarioId: baneoQuitado.baneado_por,
      tipo: "apelacion_aceptada",
      titulo: "Se quitó un baneo de tu campaña",
      mensaje: `La administración aceptó la apelación de ${persona}: puede volver a aportar en «${a.decision.campana?.nombre ?? "tu campaña"}».`,
      campanaId: baneoQuitado.campana_id,
      enlace: `/mis-campanas/${baneoQuitado.campana_id}/aportes`,
      metadata: { apelacionId, paraCreador: true },
    });
  }
  return { ok: true };
}

/* ── para las pantallas de la persona ───────────────────────────────────── */

/**
 * apelacionesDeLaPersona() con las fechas ya en texto (hora de Tepic), listo para components/apelaciones/
 * ApelacionesDeLaPersona. Lo usan /mis-apelaciones y /cuenta-bloqueada.
 */
export async function apelacionesParaLaPantalla(usuarioId: number) {
  const { apelables, apelaciones } = await apelacionesDeLaPersona(usuarioId);
  return {
    apelables: apelables.map((a) => ({
      clave: a.clave,
      decision: a.decision,
      fechaTexto: formatearFechaYHora(new Date(a.decision.aplicadaEn)),
      venceTexto: formatearFechaYHora(a.venceEn),
    })),
    apelaciones: apelaciones.map((a) => ({
      id: a.id,
      estado: a.estado,
      decision: a.decision,
      motivo: a.motivo,
      respuesta: a.respuesta,
      fechaTexto: formatearFecha(a.creadaEn),
      resueltaTexto: a.resueltaEn ? formatearFecha(a.resueltaEn) : null,
      decisionTexto: formatearFecha(new Date(a.decision.aplicadaEn)),
    })),
  };
}
