// Misiones de cada persona (2026-11-04; SRS v1.3: RF-GAM-40 a 45, 75). El catálogo sale de lib/datos/misiones.json y
// cada periodo elige al azar unas cuantas para cada persona (elegirMisiones): solo salen las que hoy se pueden cumplir.
// actualizarMisiones() recalcula el avance desde aportes, favoritos e inscripciones y, si una misión se completa, concede
// su recompensa, si la tiene, en la misma transacción: no hay nada que reclamar y no depende de que la persona entre (RF-GAM-75). La
// clave de idempotencia y el UNIQUE de mision_instancias evitan contarla o premiarla dos veces (RF-GAM-08, 42).
//
// Decisiones tomadas con la propuesta del SRS, pendientes de confirmar (DA-GAM-17): periodos de 24 horas y 7 días desde
// el primer inicio de sesión; una cuenta existente se ancla en su siguiente inicio de sesión o actividad; la recompensa
// se entrega al completarse. Los aportes anónimos no tienen user_id: no cuentan (RF-GAM-43).
//
// Misiones de inicio (2026-11-18; SRS v1.4: RF-GAM-103, RN-GAM-41): se asignan todas, una sola vez, en el periodo
// «inicio» (la semana de bienvenida). Al terminar la semana ya no se pueden completar, aunque se acepte después un
// aporte enviado dentro de ella (CA-GAM-95).
//
// Recompensas y dificultad (2026-11-19; SRS v1.4: RF-GAM-44, 122, tabla 4.6, decisión del 19 nov): al asignar una misión
// se guarda en mision_instancias.recompensa lo que dará; en las difíciles es el objeto sorteado (potenciador o protector),
// así la tarjeta lo muestra desde el inicio. La EXP se concede al completarla. Un objeto queda registrado como pendiente
// de entregar (recompensa_entregada_en NULL) y, al terminar, entregarObjetosDeMisiones() lo mete al inventario o lo deja
// para la ventana «ya tienes el máximo» (lib/gamificacion/inventario.ts, 2026-11-19). `presente` dice si la persona
// provocó el cambio (enviar, guardar, inscribirse) o llegó sin ella (aceptaron su aporte): decide si un potenciador se
// activa ya o se guarda hasta que vuelva (RF-GAM-33).

import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS, hoyEnTepic } from "@/lib/fecha-de-tepic";
import { notificar } from "@/lib/notificaciones/notificaciones";
import { DIFICILES_DEL_CATALOGO, SELECCION_DE_MISIONES } from "./catalogos";
import { evaluarProgresoDe } from "./evaluacion";
import { entregarObjetosDeMisiones } from "./inventario";
import {
  DURACION_MS,
  type PeriodicidadSorteada,
  avanceDeMision,
  cuandoCuenta,
  elegirMisiones,
  periodoEn,
  recompensaDesde,
  sortearObjeto,
  textoDeRecompensa,
  tipoDeRecompensa,
  type CondicionDeMision,
  type CuandoCuenta,
  type Dificultad,
  type ContextoDeSeleccion,
  type DatosParaMisiones,
  type MedidaDeMision,
  type Periodicidad,
  type Periodo,
  type RecompensaDeMision,
} from "./misiones-reglas";
import { TEXTOS } from "./textos";

const LIMITE_DEL_HISTORIAL = 50;

type FilaDeMision = {
  id: number;
  clave: string;
  nombre: string;
  periodicidad: Periodicidad;
  grupo: string | null;
  condicion: CondicionDeMision;
  recompensa: unknown;
  activa: boolean;
  dificultad: Dificultad;
};

/**
 * Lo que da una instancia: lo guardado al asignarla o, en las asignadas antes del 19 nov, lo del catálogo. Un «sorteo»
 * sin resolver (difícil asignada antes del cambio) no da nada.
 */
function recompensaDeInstancia(deInstancia: unknown, delCatalogo: unknown): RecompensaDeMision {
  const recompensa = recompensaDesde(deInstancia ?? delCatalogo);
  return recompensa?.tipo === "sorteo" ? null : recompensa;
}

async function contextoDeSeleccion(client: Pick<PoolClient, "query">, intereses: string[]): Promise<ContextoDeSeleccion> {
  const tiposR = await client.query<{ tipo: string }>(
    `SELECT DISTINCT t.tipo FROM campana_tipos t JOIN campanas c ON c.id = t.campana_id WHERE c.status = 'activa'`,
  );
  const campanasR = await client.query<{ tematica: string; especial: boolean }>(
    `SELECT c.tematica, (e.campana_id IS NOT NULL) AS especial
      FROM campanas c
      LEFT JOIN campana_especial e ON e.campana_id = c.id AND $1::date BETWEEN e.inicio AND e.fin
      WHERE c.status = 'activa'`,
    [hoyEnTepic()],
  );
  return {
    tiposDisponibles: new Set(tiposR.rows.map((t) => t.tipo)),
    hayCampanasDeInteres: campanasR.rows.some((c) => intereses.includes(c.tematica)),
    hayCampanasEspeciales: campanasR.rows.some((c) => c.especial),
  };
}

/** Nunca lanza: un fallo aquí no debe tumbar el aporte; la siguiente actividad de la persona lo recalcula. */
export async function actualizarMisiones(
  usuarioId: number | string,
  instantes: (Date | string)[] = [],
  opciones: { permitirBajar?: boolean; presente?: boolean } = {},
): Promise<void> {
  const completadas: { nombre: string; recompensa: RecompensaDeMision }[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const bloqueo = await client.query(`SELECT 1 FROM usuario_progreso WHERE usuario_id = $1 FOR UPDATE`, [usuarioId]);
    if (bloqueo.rows.length === 0) {
      await client.query("ROLLBACK");
      return;
    }
    await client.query(
      `UPDATE usuarios SET primer_inicio_sesion_en = date_trunc('second', NOW())
        WHERE id = $1 AND primer_inicio_sesion_en IS NULL`,
      [usuarioId],
    );
    const anclaR = await client.query<{ ancla: number; intereses: string[] }>(
      `SELECT (EXTRACT(EPOCH FROM primer_inicio_sesion_en) * 1000)::float8 AS ancla, intereses FROM usuarios WHERE id = $1`,
      [usuarioId],
    );
    const ancla = Math.floor(anclaR.rows[0].ancla);
    const intereses = anclaR.rows[0].intereses;
    const { rows: misiones } = await client.query<FilaDeMision>(
      `SELECT id, clave, nombre, periodicidad, grupo, condicion, recompensa, activa, dificultad FROM misiones`,
    );
    const misionPorId = new Map(misiones.map((m) => [m.id, m]));

    // El periodo vigente y, si se aceptó un aporte tarde, el periodo en que se envió.
    const puntos = [Date.now(), ...instantes.map((i) => new Date(i).getTime())];
    const periodos = new Map<string, { periodicidad: Periodicidad } & Periodo>();
    for (const periodicidad of ["diaria", "semanal", "inicio"] as const) {
      for (const punto of puntos) {
        const periodo = periodoEn(ancla, punto, periodicidad);
        if (periodo) periodos.set(`${periodicidad}:${periodo.inicio}`, { periodicidad, ...periodo });
      }
    }

    const leerInstancias = () =>
      client.query<{
        id: string;
        mision_id: number;
        inicio: number;
        objetivo: number;
        progreso: number;
        completada: boolean;
        recompensa: unknown;
      }>(
        `SELECT id::text AS id, mision_id, (EXTRACT(EPOCH FROM periodo_inicio) * 1000)::float8 AS inicio, objetivo, progreso,
                (completada_en IS NOT NULL) AS completada, recompensa
          FROM mision_instancias WHERE usuario_id = $1 AND periodo_inicio >= to_timestamp($2 / 1000.0)`,
        [usuarioId, Math.min(...puntos) - 2 * DURACION_MS.semanal],
      );
    const clavesDe = (filas: { mision_id: number; inicio: number }[], periodicidad: Periodicidad, inicio: number) =>
      filas
        .filter((f) => Math.round(f.inicio) === inicio && misionPorId.get(f.mision_id)?.periodicidad === periodicidad)
        .map((f) => misionPorId.get(f.mision_id)?.clave ?? "");

    // Un periodo se sortea una sola vez: con instancias, ya no cambia aunque cambie el catálogo.
    const previas = await leerInstancias();
    let contexto: ContextoDeSeleccion | null = null;
    for (const { periodicidad, inicio, fin } of periodos.values()) {
      if (clavesDe(previas.rows, periodicidad, inicio).length > 0) continue;
      const activas = misiones.filter((m) => m.activa && m.periodicidad === periodicidad);
      // Las de inicio no se sortean: salen todas (RF-GAM-103).
      if (periodicidad !== "inicio") contexto ??= await contextoDeSeleccion(client, intereses);
      const elegidas =
        periodicidad === "inicio" || !contexto
          ? activas
          : elegirMisiones(activas, {
              semilla: `${usuarioId}:${periodicidad}:${inicio}`,
              cuantas: SELECCION_DE_MISIONES[periodicidad as PeriodicidadSorteada],
              contexto,
              anteriores: new Set(clavesDe(previas.rows, periodicidad, inicio - DURACION_MS[periodicidad])),
              maximoDificiles: DIFICILES_DEL_CATALOGO.maximoPorPeriodo,
            });
      for (const mision of elegidas) {
        // Lo que dará se fija al asignarla: el objeto de una difícil se sortea aquí, una sola vez (misma semilla).
        const delCatalogo = recompensaDesde(mision.recompensa);
        const recompensa: RecompensaDeMision =
          delCatalogo?.tipo === "sorteo"
            ? { tipo: sortearObjeto(`${usuarioId}:${mision.clave}:${inicio}`, DIFICILES_DEL_CATALOGO.pesosDelSorteo) }
            : delCatalogo;
        await client.query(
          `INSERT INTO mision_instancias (usuario_id, mision_id, periodo_inicio, periodo_fin, objetivo, recompensa)
            VALUES ($1, $2, to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0), $5, $6::jsonb)
            ON CONFLICT (usuario_id, mision_id, periodo_inicio) DO NOTHING`,
          [usuarioId, mision.id, inicio, fin, mision.condicion.objetivo, recompensa ? JSON.stringify(recompensa) : null],
        );
      }
    }

    const aportesR = await client.query<{
      tipo: string;
      status: string;
      enviado: number;
      dia: string;
      campana_id: number;
      tematica: string;
      cuota: number;
      calificacion: number | null;
      caracteres: number;
      especial: boolean;
    }>(
      `SELECT a.file_type AS tipo, a.status, (EXTRACT(EPOCH FROM a.submitted_at) * 1000)::float8 AS enviado,
              to_char(a.submitted_at AT TIME ZONE $2, 'YYYY-MM-DD') AS dia,
              a.campaign_id AS campana_id, c.tematica, c.quota_per_user AS cuota, a.calificacion,
              char_length(a.description) AS caracteres,
              COALESCE((a.submitted_at AT TIME ZONE $2)::date BETWEEN e.inicio AND e.fin, false) AS especial
        FROM aportes a
        JOIN campanas c ON c.id = a.campaign_id
        LEFT JOIN campana_especial e ON e.campana_id = c.id
        WHERE a.user_id = $1`,
      [usuarioId, ZONA_DE_CAMPANAS],
    );
    const guardadasR = await client.query<{ instante: number }>(
      `SELECT (EXTRACT(EPOCH FROM created_at) * 1000)::float8 AS instante FROM campanas_guardadas WHERE usuario_id = $1`,
      [usuarioId],
    );
    const inscripcionesR = await client.query<{ instante: number }>(
      `SELECT (EXTRACT(EPOCH FROM aceptada_en) * 1000)::float8 AS instante FROM campana_inscripciones WHERE usuario_id = $1`,
      [usuarioId],
    );
    const datos: DatosParaMisiones = {
      aportes: aportesR.rows.map((a) => ({
        tipo: a.tipo,
        aceptado: a.status === "aceptado",
        enviadoEn: a.enviado,
        dia: a.dia,
        campanaId: a.campana_id,
        tematica: a.tematica,
        cuota: a.cuota,
        estrellas: a.status === "aceptado" ? a.calificacion : null,
        caracteres: a.caracteres,
        deInteres: intereses.includes(a.tematica),
        especial: a.especial,
      })),
      guardadas: guardadasR.rows.map((g) => g.instante),
      inscripciones: inscripcionesR.rows.map((i) => i.instante),
    };

    const instancias = await leerInstancias();
    for (const instancia of instancias.rows) {
      const mision = misionPorId.get(instancia.mision_id);
      if (!mision || instancia.completada) continue;
      const periodo = periodos.get(`${mision.periodicidad}:${Math.round(instancia.inicio)}`);
      if (!periodo) continue;
      // Terminada la semana de bienvenida, las de inicio ya no avanzan (RF-GAM-103, CA-GAM-95).
      if (mision.periodicidad === "inicio" && Date.now() >= periodo.fin) continue;
      const avance = Math.min(avanceDeMision(mision.condicion, datos, periodo), instancia.objetivo);
      // El avance solo sube, salvo tras un descuento por reporte (2026-11-13, A1): ahí baja en las misiones que aún no
      // se completan. Una misión completada no se toca (su recompensa ya se entregó).
      if (avance === instancia.progreso || (avance < instancia.progreso && !opciones.permitirBajar)) continue;
      if (avance < instancia.objetivo) {
        await client.query(`UPDATE mision_instancias SET progreso = $2 WHERE id = $1`, [instancia.id, avance]);
        continue;
      }

      const recompensa = recompensaDeInstancia(instancia.recompensa, mision.recompensa);
      const exp = recompensa?.tipo === "exp" ? recompensa.cantidad : 0;
      // La EXP se entrega aquí. Un objeto queda pendiente (recompensa_entregada_en NULL) hasta que exista el inventario.
      await client.query(
        `UPDATE mision_instancias
          SET progreso = $2, completada_en = NOW(), recompensa_entregada_en = CASE WHEN $3 THEN NOW() END
          WHERE id = $1`,
        [instancia.id, avance, exp > 0],
      );
      if (exp > 0) {
        await client.query(
          `INSERT INTO exp_movimientos (usuario_id, tipo, exp, motivo, mision_instancia_id, clave_idempotencia)
            VALUES ($1, 'mision', $2, $3, $4, $5)`,
          [usuarioId, exp, `Misión: ${mision.nombre}`, instancia.id, `mision:${instancia.id}`],
        );
      }
      await client.query(
        `UPDATE usuario_progreso
          SET exp_total = exp_total + $2, misiones_completadas = misiones_completadas + 1, actualizado_en = NOW()
          WHERE usuario_id = $1`,
        [usuarioId, exp],
      );
      completadas.push({ nombre: mision.nombre, recompensa });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`Error actualizando las misiones del usuario ${usuarioId}`, error);
    return;
  } finally {
    client.release();
  }

  // Las misiones completadas son requisito de rango y su EXP mide Energía de Impacto (RF-GAM-18, 47).
  if (completadas.length > 0) await evaluarProgresoDe(usuarioId);
  // Protectores y potenciadores de las difíciles: al inventario si caben; si no, a la ventana.
  if (completadas.some((c) => c.recompensa && c.recompensa.tipo !== "exp")) {
    await entregarObjetosDeMisiones(usuarioId, { presente: opciones.presente ?? false });
  }

  for (const { nombre, recompensa } of completadas) {
    const texto = textoDeRecompensa(recompensa);
    await notificar({
      usuarioId: Number(usuarioId),
      tipo: "mision_completada",
      titulo: "Misión completada",
      mensaje: texto ? `${nombre}: ${TEXTOS.misiones.ganaste(texto)}.` : `${nombre}. Suma a lo que piden los rangos.`,
      enlace: "/progreso/misiones",
    });
  }
}

/**
 * Abre los periodos que tocan al leer: la renovación no necesita ningún proceso en segundo plano. Las de inicio solo
 * se buscan durante la semana de bienvenida (o si la cuenta aún no tiene ancla).
 */
export async function asegurarMisionesVigentes(usuarioId: number | string): Promise<void> {
  const { rows } = await pool.query<{ faltan: boolean }>(
    `SELECT EXISTS (
        SELECT 1 FROM (SELECT DISTINCT periodicidad FROM misiones WHERE activa) p
        WHERE (
          p.periodicidad <> 'inicio'
          OR EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = $1
              AND (u.primer_inicio_sesion_en IS NULL OR u.primer_inicio_sesion_en > NOW() - make_interval(secs => $2 / 1000.0))
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM mision_instancias i JOIN misiones m ON m.id = i.mision_id
          WHERE i.usuario_id = $1 AND m.periodicidad = p.periodicidad AND i.periodo_inicio <= NOW() AND i.periodo_fin > NOW()
        )
      ) AS faltan`,
    [usuarioId, DURACION_MS.inicio],
  );
  if (rows[0]?.faltan) await actualizarMisiones(usuarioId);
}

// ---------------------------------------------------------------------------------------------------
// Pantalla /progreso/misiones.
// ---------------------------------------------------------------------------------------------------

export type MisionVigente = {
  id: string;
  nombre: string;
  mide: MedidaDeMision;
  progreso: number;
  objetivo: number;
  completada: boolean;
  /** «20 EXP», «1 protector»; null sin recompensa. */
  recompensa: string | null;
  /** Para el ícono de la recompensa. */
  tipoDeRecompensa: "exp" | "potenciador" | "protector" | null;
  dificil: boolean;
  /** Qué pasó con el objeto de una difícil completada; null si no da objeto o no se completó. */
  objeto: "pendiente" | "entregada" | "cambiada" | "perdida" | null;
  /** «Envía…» cuenta al enviar; «Logra…» al aceptarse (RF-GAM-43). */
  cuenta: CuandoCuenta;
  clave: string;
};

export type GrupoDeMisiones = {
  /** «27 oct, 08:15 → 28 oct, 08:15»; null sin misiones. */
  periodo: string | null;
  /** «16 h 05 min». */
  seRenuevanEn: string | null;
  misiones: MisionVigente[];
};

export type MisionCompletada = {
  id: string;
  clave: string;
  nombre: string;
  periodicidad: Periodicidad;
  periodo: string;
  completadaEn: string;
  recompensa: string | null;
};

export type DatosDeMisiones = {
  total: number;
  /** Misiones de la semana de bienvenida; sin misiones fuera de ella (RF-GAM-103). */
  inicio: GrupoDeMisiones;
  diarias: GrupoDeMisiones;
  semanales: GrupoDeMisiones;
  historial: MisionCompletada[];
};

const FECHA_Y_HORA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ZONA_DE_CAMPANAS,
});
const FECHA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: ZONA_DE_CAMPANAS });

export function textoDeTiempoRestante(ms: number): string {
  const minutos = Math.max(0, Math.ceil(ms / 60_000));
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  if (dias > 0) return `${dias} ${dias === 1 ? "día" : "días"} ${horas} h`;
  return `${horas} h ${String(minutos % 60).padStart(2, "0")} min`;
}

function grupoDe(filas: FilaVigente[], periodicidad: Periodicidad): GrupoDeMisiones {
  const delGrupo = filas.filter((f) => f.periodicidad === periodicidad);
  const primera = delGrupo[0];
  return {
    periodo: primera ? `${FECHA_Y_HORA.format(primera.inicio)} → ${FECHA_Y_HORA.format(primera.fin)}` : null,
    seRenuevanEn: primera ? textoDeTiempoRestante(primera.fin - Date.now()) : null,
    misiones: delGrupo.map((f) => {
      const recompensa = recompensaDeInstancia(f.recompensa_instancia, f.recompensa);
      const daObjeto = recompensa?.tipo === "potenciador" || recompensa?.tipo === "protector";
      return {
        id: f.id,
        nombre: f.nombre,
        mide: f.condicion.mide,
        progreso: f.progreso,
        objetivo: f.objetivo,
        completada: f.completada,
        recompensa: textoDeRecompensa(recompensa),
        tipoDeRecompensa: tipoDeRecompensa(recompensa),
        dificil: f.dificultad === "dificil",
        objeto: daObjeto && f.completada ? (f.recompensa_resultado ?? "pendiente") : null,
        cuenta: cuandoCuenta(f.condicion),
        clave: f.clave,
      };
    }),
  };
}

type FilaVigente = {
  id: string;
  nombre: string;
  periodicidad: Periodicidad;
  condicion: CondicionDeMision;
  recompensa: unknown;
  recompensa_instancia: unknown;
  recompensa_resultado: "entregada" | "cambiada" | "perdida" | null;
  dificultad: Dificultad;
  progreso: number;
  objetivo: number;
  completada: boolean;
  inicio: number;
  fin: number;
  clave : string;
};

/** null si falla (se loguea el error). */
export async function obtenerMisiones(usuarioId: number | string): Promise<DatosDeMisiones | null> {
  try {
    await asegurarMisionesVigentes(usuarioId);
    const [vigentesR, historialR, totalR] = await Promise.all([
      pool.query<FilaVigente>(
        `SELECT i.id::text AS id, m.clave, m.nombre, m.periodicidad, m.condicion, m.recompensa,
                i.recompensa AS recompensa_instancia, i.recompensa_resultado, m.dificultad, i.progreso, i.objetivo,
                (i.completada_en IS NOT NULL) AS completada,
                (EXTRACT(EPOCH FROM i.periodo_inicio) * 1000)::float8 AS inicio,
                (EXTRACT(EPOCH FROM i.periodo_fin) * 1000)::float8 AS fin
          FROM mision_instancias i JOIN misiones m ON m.id = i.mision_id
          WHERE i.usuario_id = $1 AND i.periodo_inicio <= NOW() AND i.periodo_fin > NOW()
          ORDER BY m.id`,
        [usuarioId],
      ),
      pool.query<{
        id: string;
        nombre: string;
        periodicidad: Periodicidad;
        recompensa: unknown;
        recompensa_instancia: unknown;
        inicio: number;
        fin: number;
        completada: number;
        clave: string;
      }>(
        `SELECT i.id::text AS id, m.clave, m.nombre, m.periodicidad, m.recompensa, i.recompensa AS recompensa_instancia,
                (EXTRACT(EPOCH FROM i.periodo_inicio) * 1000)::float8 AS inicio,
                (EXTRACT(EPOCH FROM i.periodo_fin) * 1000)::float8 AS fin,
                (EXTRACT(EPOCH FROM i.completada_en) * 1000)::float8 AS completada
          FROM mision_instancias i JOIN misiones m ON m.id = i.mision_id
          WHERE i.usuario_id = $1 AND i.completada_en IS NOT NULL
          ORDER BY i.completada_en DESC, i.id DESC
          LIMIT ${LIMITE_DEL_HISTORIAL}`,
        [usuarioId],
      ),
      pool.query<{ misiones_completadas: number }>(`SELECT misiones_completadas FROM usuario_progreso WHERE usuario_id = $1`, [usuarioId]),
    ]);

    return {
      total: totalR.rows[0]?.misiones_completadas ?? 0,
      inicio: grupoDe(vigentesR.rows, "inicio"),
      diarias: grupoDe(vigentesR.rows, "diaria"),
      semanales: grupoDe(vigentesR.rows, "semanal"),
      historial: historialR.rows.map((h) => ({
        id: h.id,
        nombre: h.nombre,
        periodicidad: h.periodicidad,
        periodo: `${FECHA.format(h.inicio)} – ${FECHA.format(h.fin)}`,
        completadaEn: FECHA_Y_HORA.format(h.completada),
        recompensa: textoDeRecompensa(recompensaDeInstancia(h.recompensa_instancia, h.recompensa)),
        clave : h.clave,
      })),
    };
  } catch (error) {
    console.error("Error armando las misiones", error);
    return null;
  }
}
