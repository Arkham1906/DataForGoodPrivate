/**
 * Vigilancia del rol delegado. Quien concede el rol de Supervisor responde por
 * cómo se usa, así que aquí se ve qué ha decidido cada uno y se puede revertir.
 */

import { pool } from "@/lib/db";

export type TipoDeAccion =
  // Lo que hoy hace un supervisor (supervision.tomar / supervision.dictaminar en audit_log).
  | "TOMO_CAMPANA"
  | "ACEPTO_CAMPANA"
  | "REPORTO_CAMPANA"
  // Del prototipo: flujos que todavía no existen para el rol Supervisor.
  | "VETO_PARTICIPANTE"
  | "PAUSO_CAMPANA"
  | "NOMBRO_REVISOR"
  | "APLICO_STRIKE"
  | "RECHAZO_CAMPANA";

/** Mismos tonos que components/ui/Tag. */
export type TonoDeEtiqueta = "default" | "ok" | "warn" | "danger";

export type AccionDeSupervisor = {
  id: string;
  tipo: TipoDeAccion;
  /** Sobre qué o quién recayó, en texto para mostrar. */
  sobre: string;
  motivo: string;
  ejecutadaEn: Date;
  /** Si ya fue revertida, cuándo. Una acción revertida no se revierte de nuevo. */
  revertidaEn: Date | null;
  /** Si hoy se puede revertir (ver puedeRevertirse). */
  reversible: boolean;
  /** Por qué no se puede revertir, para mostrarlo en lugar del botón. null si sí se puede. */
  noReversiblePorque: string | null;
  /** Campaña sobre la que recayó, para enlazarla desde el historial. */
  campanaId?: string;
  /** Creador de esa campaña: a quien se avisa si la campaña vuelve a revisión. */
  creadorId?: number;
  /** Contexto que necesita la pantalla de reversión. */
  contexto: {
    personaAfectada?: string;
    campana?: string;
    creadorDeCampana?: string;
    aportesPrevios?: number;
    fechaDeCierre?: string;
  };
};

export type Supervisor = {
  id: string;
  nombre: string;
  correo: string;
  /** false si ya no tiene el rol: sigue en la lista porque su historial puede revertirse. */
  conRol: boolean;
  /** Último rol.asignar en la bitácora: null si se asignó antes de que existiera. */
  desde: Date | null;
  campanasACargo: number;
  /** Campañas que aceptó, rechazó o reportó (cada dictamen cuenta). */
  dictamenes: number;
  accionesEnRango: number;
  revertidas: number;
  /** null si no hay ninguna acción registrada todavía. */
  ultimaActividad: Date | null;
};

export type EstadoDeCampanaSupervisada =
  | "EN_REVISION"
  | "PROGRAMADA"
  | "ACTIVA"
  | "PAUSADA"
  | "RECHAZADA"
  | "FINALIZADA";

export type ActividadDeSupervisor = Supervisor & {
  campanas: { id: string; nombre: string; estado: EstadoDeCampanaSupervisada }[];
  acciones: AccionDeSupervisor[];
  /** Reversiones en las que el SuperUsuario pidió dejar observación en su expediente. */
  observaciones: { fecha: Date; causal: string; descripcion: string; sobre: string }[];
};

export type ResumenDeSupervisores = {
  conRolActivo: number;
  campanasACargo: number;
  accionesEjecutadas: number;
  accionesRevertidas: number;
};

/* ── presentación ───────────────────────────────────────────────────────── */

export const ETIQUETA_DE_ACCION: Record<
  TipoDeAccion,
  { texto: string; tono: TonoDeEtiqueta }
> = {
  TOMO_CAMPANA: { texto: "Tomó campaña", tono: "default" },
  ACEPTO_CAMPANA: { texto: "Aceptó campaña", tono: "ok" },
  REPORTO_CAMPANA: { texto: "Reportó campaña", tono: "warn" },
  VETO_PARTICIPANTE: { texto: "Vetó participante", tono: "danger" },
  PAUSO_CAMPANA: { texto: "Pausó campaña", tono: "warn" },
  NOMBRO_REVISOR: { texto: "Nombró revisor", tono: "default" },
  APLICO_STRIKE: { texto: "Aplicó strike", tono: "warn" },
  RECHAZO_CAMPANA: { texto: "Rechazó campaña", tono: "danger" },
};

export const ETIQUETA_DE_ESTADO_DE_CAMPANA: Record<
  EstadoDeCampanaSupervisada,
  { texto: string; tono: TonoDeEtiqueta }
> = {
  EN_REVISION: { texto: "En revisión", tono: "warn" },
  PROGRAMADA: { texto: "Aceptada", tono: "ok" },
  ACTIVA: { texto: "Activa", tono: "ok" },
  PAUSADA: { texto: "Pausada", tono: "warn" },
  RECHAZADA: { texto: "Rechazada", tono: "danger" },
  FINALIZADA: { texto: "Finalizada", tono: "default" },
};

/** `campanas.status` → estado que se muestra. */
function estadoDeCampana(status: string): EstadoDeCampanaSupervisada {
  switch (status) {
    case "en_revision":
      return "EN_REVISION";
    case "aceptada":
      return "PROGRAMADA";
    case "activa":
      return "ACTIVA";
    case "pausada":
      return "PAUSADA";
    case "rechazada":
      return "RECHAZADA";
    default:
      return "FINALIZADA";
  }
}

export const CAUSALES_DE_REVERSION = [
  "Medida desproporcionada",
  "Motivo insuficiente",
  "Error de identificación",
  "Apelación procedente",
  "Fuera del alcance del rol",
];

/**
 * Qué cambia realmente al deshacer cada tipo de decisión. Es lo que se le
 * muestra al SuperUsuario antes de confirmar, y varía por tipo: no es lo mismo
 * levantar un veto que reactivar una campaña.
 *
 * Regla común a todas: revertir NO reevalúa el pasado. Los aportes ya validados
 * o rechazados se quedan como están.
 */
export function describirReversion(a: AccionDeSupervisor): {
  titulo: string;
  efecto: string;
  notificable: string | null;
} {
  const c = a.contexto;

  switch (a.tipo) {
    // Las cuatro que hoy existen (lib/usuarios/acciones-supervisor.ts las aplica).
    case "TOMO_CAMPANA":
      return {
        titulo: "Liberar una campaña tomada",
        efecto: `«${c.campana ?? "La campaña"}» deja de estar a cargo de este supervisor y vuelve a la cola de supervisión, para que cualquier supervisor la tome. Sigue En revisión.`,
        notificable: null,
      };

    case "ACEPTO_CAMPANA":
      return {
        titulo: "Revertir la aceptación de una campaña",
        efecto: `«${c.campana ?? "La campaña"}» vuelve al estado En revisión, sale del catálogo público y regresa a la cola de supervisión, sin supervisor: alguien tiene que volver a tomarla y dictaminarla. Los aportes que ya recibió se conservan.`,
        notificable: c.creadorDeCampana
          ? `Notificar a ${c.creadorDeCampana} que su campaña vuelve a revisión`
          : null,
      };

    case "REPORTO_CAMPANA":
      return {
        titulo: "Retirar un reporte de campaña",
        efecto: `Se retira el reporte de «${c.campana ?? "la campaña"}»: deja de aparecer entre las campañas reportadas. Su estado y su supervisor no cambian, porque un reporte no la había pausado ni rechazado.`,
        notificable: null,
      };

    case "VETO_PARTICIPANTE":
      return {
        titulo: "Revertir un veto de participante",
        efecto: `${c.personaAfectada ?? "La persona"} vuelve a poder aportar en «${
          c.campana ?? "la campaña"
        }». Sus ${c.aportesPrevios ?? 0} aportes previos siguen como estaban: revertir el veto no reevalúa lo ya validado ni lo ya rechazado.`,
        notificable: c.personaAfectada
          ? `Notificar a ${c.personaAfectada} que puede volver a participar`
          : null,
      };

    case "PAUSO_CAMPANA":
      return {
        titulo: "Revertir una pausa de campaña",
        efecto: `«${c.campana ?? "La campaña"}» vuelve al estado Activa y reaparece en el catálogo público con su fecha de cierre original${
          c.fechaDeCierre ? `, el ${c.fechaDeCierre}` : ""
        }. Los ${c.aportesPrevios ?? 0} aportes recibidos se conservan y la meta no se recalcula.`,
        notificable: c.creadorDeCampana
          ? `Notificar a ${c.creadorDeCampana} que su campaña vuelve a estar activa`
          : null,
      };

    case "NOMBRO_REVISOR":
      return {
        titulo: "Revertir el nombramiento de un revisor",
        efecto: `${c.personaAfectada ?? "La persona"} deja de revisar aportes en «${
          c.campana ?? "la campaña"
        }». Las revisiones que ya hizo se mantienen: se le retira la facultad, no se anula su trabajo.`,
        notificable: c.personaAfectada
          ? `Notificar a ${c.personaAfectada} que ya no es revisor de esa campaña`
          : null,
      };

    case "APLICO_STRIKE":
      return {
        titulo: "Revertir un strike",
        efecto: `Se descuenta el strike del contador de ${
          c.personaAfectada ?? "la persona"
        }. Si el strike había desencadenado una suspensión, esta se levanta; el aporte que lo originó sigue rechazado.`,
        notificable: c.personaAfectada
          ? `Notificar a ${c.personaAfectada} que se retiró el strike`
          : null,
      };

    case "RECHAZO_CAMPANA":
      return {
        titulo: "Revertir el rechazo de una campaña",
        efecto: `«${c.campana ?? "La campaña"}» vuelve al estado En revisión y regresa a la cola de supervisión, sin supervisor. No se activa sola: alguien tiene que volver a tomarla y validarla.`,
        notificable: c.creadorDeCampana
          ? `Notificar a ${c.creadorDeCampana} que su campaña vuelve a revisión`
          : null,
      };
  }
}

/**
 * Cuándo se puede revertir una decisión, según cómo está hoy la campaña. La
 * misma regla la vuelve a exigir el UPDATE de revertirAccion, por si la campaña
 * cambia entre que se pinta la pantalla y se confirma.
 *   - Tomó: la campaña sigue En revisión, a su cargo, y no la volvió a tomar después.
 *   - Aceptó: sigue Activa o Aceptada (aún no empieza), a su cargo, y es el último dictamen.
 *   - Rechazó: sigue Rechazada (el creador no la reenvió), a su cargo, y es el último dictamen.
 *   - Reportó: siempre que la campaña exista (un reporte no cambia su estado).
 * Los tipos del prototipo (vetar, pausar, nombrar revisor, strike) no existen todavía.
 */
export function puedeRevertirse(
  tipo: TipoDeAccion,
  campana: { existe: boolean; status: string | null; sigueASuCargo: boolean; huboDictamenDespues: boolean; laTomoDespues: boolean },
): { reversible: true } | { reversible: false; porque: string } {
  const no = (porque: string) => ({ reversible: false as const, porque });
  if (!campana.existe) return no("La campaña ya no existe");

  switch (tipo) {
    case "REPORTO_CAMPANA":
      return { reversible: true };
    case "TOMO_CAMPANA":
      if (campana.laTomoDespues || !campana.sigueASuCargo) return no("Ya no está a su cargo");
      if (campana.status !== "en_revision") return no("Ya la dictaminó");
      return { reversible: true };
    case "ACEPTO_CAMPANA":
    case "RECHAZO_CAMPANA": {
      if (!campana.sigueASuCargo) return no("Ya no está a su cargo");
      if (campana.huboDictamenDespues) return no("Hubo un dictamen después");
      if (campana.status === "finalizada") return no("La campaña ya terminó");
      const esperado = tipo === "ACEPTO_CAMPANA" ? ["activa", "aceptada"] : ["rechazada"];
      if (!esperado.includes(campana.status ?? "")) return no("La campaña cambió de estado");
      return { reversible: true };
    }
    default:
      return no("Este tipo de decisión todavía no existe");
  }
}

/** Estados en los que debe seguir la campaña para revertir cada tipo (lo usa el UPDATE). */
export const ESTADOS_PARA_REVERTIR: Partial<Record<TipoDeAccion, string[]>> = {
  TOMO_CAMPANA: ["en_revision"],
  ACEPTO_CAMPANA: ["activa", "aceptada"],
  RECHAZO_CAMPANA: ["rechazada"],
};

/* ── formato ────────────────────────────────────────────────────────────── */

const fechaCorta = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Mazatlan",
});

const fechaConHora = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Mazatlan",
});

export const formatearFechaSup = (f: Date | null) => (f ? fechaCorta.format(f) : "sin registrar");
export const formatearFechaHoraSup = (f: Date | null) =>
  f ? fechaConHora.format(f) : "sin actividad registrada";

/*
 * ────────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALE CADA DATO (conectado el 2026-10-08; antes todo salía en cero)
 *
 *   - Supervisores: quien tiene el rol hoy y también quien lo tuvo (tomó
 *     campañas o dejó acciones en la bitácora): sus decisiones siguen pudiendo
 *     revertirse. `conRol` dice cuál es cuál; "Con rol activo" cuenta solo los
 *     primeros.
 *   - desde: el último `rol.asignar` de SUPERVISOR en audit_log. Roles dados
 *     antes de que existiera la bitácora salen "sin registrar".
 *   - Campañas a su cargo: `campanas.supervisor_id` (quien la tomó; se queda
 *     con ella aunque ya haya terminado).
 *   - Acciones: `supervision.tomar` y `supervision.dictaminar` en audit_log con
 *     el supervisor como actor (lib/supervision/decision.ts). Dictámenes son
 *     solo las segundas; "acciones (30 días)" cuenta las dos.
 *   - Última actividad: la más reciente de esas acciones.
 *   - Revertidas: `supervision.revertir` (lib/usuarios/acciones-supervisor.ts),
 *     con `detalle.accionId` (la acción revertida) y `detalle.supervisorId`.
 *
 * Lo que hace el SuperUsuario desde /supervisar (actor "superusuario") no
 * cuenta para ningún supervisor.
 * ────────────────────────────────────────────────────────────────────────────
 */

const ACCIONES_DE_SUPERVISOR = `('supervision.tomar', 'supervision.dictaminar')`;

// Tiene el rol, o lo tuvo y dejó rastro. `u` es la fila de usuarios.
const ES_O_FUE_SUPERVISOR = `(
  u.role @> '["supervisor"]'::jsonb
  OR EXISTS (SELECT 1 FROM campanas c WHERE c.supervisor_id = u.id)
  OR EXISTS (SELECT 1 FROM audit_log a
    WHERE a.actor_tipo = 'usuario' AND a.actor_id = u.id AND a.accion IN ${ACCIONES_DE_SUPERVISOR})
)`;

type FilaSupervisorDB = {
  id: number;
  nombre: string;
  apellidos: string;
  email: string;
  con_rol: boolean;
  desde: Date | null;
  campanas: string;
  dictamenes: string;
  acciones_30: string;
  revertidas: string;
  ultima: Date | null;
};

// Datos de cada supervisor en una sola consulta; `u` es la fila de usuarios.
const COLUMNAS_DE_SUPERVISOR = `
  u.id, u.nombre, u.apellidos, u.email,
  u.role @> '["supervisor"]'::jsonb AS con_rol,
  (SELECT MAX(a.created_at) FROM audit_log a
    WHERE a.accion = 'rol.asignar' AND a.objetivo_tipo = 'usuario'
      AND a.objetivo_id = u.id::text AND a.detalle->>'rol' = 'SUPERVISOR') AS desde,
  (SELECT COUNT(*) FROM campanas c WHERE c.supervisor_id = u.id) AS campanas,
  (SELECT COUNT(*) FROM audit_log a
    WHERE a.actor_tipo = 'usuario' AND a.actor_id = u.id
      AND a.accion = 'supervision.dictaminar') AS dictamenes,
  (SELECT COUNT(*) FROM audit_log a
    WHERE a.actor_tipo = 'usuario' AND a.actor_id = u.id
      AND a.accion IN ${ACCIONES_DE_SUPERVISOR}
      AND a.created_at >= NOW() - INTERVAL '30 days') AS acciones_30,
  (SELECT COUNT(*) FROM audit_log a
    WHERE a.accion = 'supervision.revertir' AND a.detalle->>'supervisorId' = u.id::text) AS revertidas,
  (SELECT MAX(a.created_at) FROM audit_log a
    WHERE a.actor_tipo = 'usuario' AND a.actor_id = u.id
      AND a.accion IN ${ACCIONES_DE_SUPERVISOR}) AS ultima`;

function supervisorDesdeDB(row: FilaSupervisorDB): Supervisor {
  return {
    id: String(row.id),
    nombre: `${row.nombre} ${row.apellidos}`.trim(),
    correo: row.email,
    conRol: row.con_rol,
    desde: row.desde,
    campanasACargo: Number(row.campanas),
    dictamenes: Number(row.dictamenes),
    accionesEnRango: Number(row.acciones_30),
    revertidas: Number(row.revertidas),
    ultimaActividad: row.ultima,
  };
}

export async function obtenerResumenDeSupervisores(): Promise<ResumenDeSupervisores> {
  try {
    // "Con rol activo" son quienes lo tienen hoy; lo demás incluye a quienes lo tuvieron.
    const result = await pool.query<{ con_rol: string; campanas: string; acciones: string; revertidas: string }>(
      `SELECT
         (SELECT COUNT(*) FROM usuarios WHERE role @> '["supervisor"]'::jsonb) AS con_rol,
         (SELECT COUNT(*) FROM campanas WHERE supervisor_id IS NOT NULL) AS campanas,
         (SELECT COUNT(*) FROM audit_log
           WHERE actor_tipo = 'usuario' AND accion IN ${ACCIONES_DE_SUPERVISOR}
             AND created_at >= NOW() - INTERVAL '30 days') AS acciones,
         (SELECT COUNT(*) FROM audit_log WHERE accion = 'supervision.revertir') AS revertidas`,
    );
    const fila = result.rows[0];

    return {
      conRolActivo: Number(fila?.con_rol ?? 0),
      campanasACargo: Number(fila?.campanas ?? 0),
      accionesEjecutadas: Number(fila?.acciones ?? 0),
      accionesRevertidas: Number(fila?.revertidas ?? 0),
    };
  } catch (error) {
    console.error("Error obteniendo resumen de supervisores", error);
    return { conRolActivo: 0, campanasACargo: 0, accionesEjecutadas: 0, accionesRevertidas: 0 };
  }
}

export async function listarSupervisores(q?: string): Promise<Supervisor[]> {
  const t = (q ?? "").trim();

  try {
    const condiciones = [ES_O_FUE_SUPERVISOR];
    const valores: string[] = [];
    if (t) {
      valores.push(`%${t}%`);
      condiciones.push(`(u.nombre ILIKE $1 OR u.apellidos ILIKE $1 OR u.email ILIKE $1)`);
    }

    // Primero quienes tienen el rol, y entre ellos quien tuvo actividad más reciente.
    const result = await pool.query<FilaSupervisorDB>(
      `SELECT ${COLUMNAS_DE_SUPERVISOR} FROM usuarios u
       WHERE ${condiciones.join(" AND ")}
       ORDER BY con_rol DESC, ultima DESC NULLS LAST, u.id DESC`,
      valores,
    );

    return result.rows.map(supervisorDesdeDB);
  } catch (error) {
    console.error("Error listando supervisores", error);
    return [];
  }
}

type FilaDeAccionDB = {
  id: string;
  accion: string;
  detalle: { accion?: string; motivo?: string | null } | null;
  created_at: Date;
  objetivo_id: string | null;
  campana: string | null;
  creador: string | null;
  creador_id: number | null;
  status: string | null;
  sigue_a_su_cargo: boolean;
  dictamen_despues: boolean;
  toma_despues: boolean;
  revertida_en: Date | null;
};

function tipoDeAccion(fila: FilaDeAccionDB): TipoDeAccion {
  if (fila.accion === "supervision.tomar") return "TOMO_CAMPANA";
  switch (fila.detalle?.accion) {
    case "aceptada":
      return "ACEPTO_CAMPANA";
    case "rechazada":
      return "RECHAZO_CAMPANA";
    default:
      return "REPORTO_CAMPANA";
  }
}

/**
 * Acciones de un supervisor, de la más reciente a la más vieja (las 100 últimas),
 * o solo una si se da `accionId`. Trae cómo está hoy la campaña para decidir si
 * se puede revertir; la campaña puede haberse borrado (LEFT JOIN).
 */
async function consultarAcciones(supervisorId: number, accionId?: number): Promise<AccionDeSupervisor[]> {
  const valores: number[] = [supervisorId];
  if (accionId !== undefined) valores.push(accionId);

  const { rows } = await pool.query<FilaDeAccionDB>(
    `SELECT a.id::text AS id, a.accion, a.detalle, a.created_at, a.objetivo_id,
            c.name AS campana, c.creator_name AS creador, c.creator_id, c.status,
            COALESCE(c.supervisor_id = a.actor_id, false) AS sigue_a_su_cargo,
            EXISTS (SELECT 1 FROM audit_log d
              WHERE d.accion = 'supervision.dictaminar' AND d.objetivo_tipo = 'campana'
                AND d.objetivo_id = a.objetivo_id AND d.id > a.id) AS dictamen_despues,
            EXISTS (SELECT 1 FROM audit_log t
              WHERE t.accion = 'supervision.tomar' AND t.objetivo_tipo = 'campana'
                AND t.objetivo_id = a.objetivo_id AND t.id > a.id) AS toma_despues,
            (SELECT r.created_at FROM audit_log r
              WHERE r.accion = 'supervision.revertir' AND r.detalle->>'accionId' = a.id::text
              LIMIT 1) AS revertida_en
     FROM audit_log a
     LEFT JOIN campanas c ON a.objetivo_tipo = 'campana' AND c.id::text = a.objetivo_id
     WHERE a.actor_tipo = 'usuario' AND a.actor_id = $1 AND a.accion IN ${ACCIONES_DE_SUPERVISOR}
       ${accionId !== undefined ? "AND a.id = $2" : ""}
     ORDER BY a.created_at DESC
     LIMIT 100`,
    valores,
  );

  return rows.map((a) => {
    const tipo = tipoDeAccion(a);
    const existe = a.campana !== null;
    const regla = puedeRevertirse(tipo, {
      existe,
      status: a.status,
      sigueASuCargo: a.sigue_a_su_cargo,
      huboDictamenDespues: a.dictamen_despues,
      laTomoDespues: a.toma_despues,
    });
    return {
      id: a.id,
      tipo,
      sobre: a.campana ?? `Campaña #${a.objetivo_id ?? "?"} (ya no existe)`,
      motivo: a.detalle?.motivo?.trim() || (tipo === "TOMO_CAMPANA" ? "—" : "Sin motivo registrado"),
      ejecutadaEn: a.created_at,
      revertidaEn: a.revertida_en,
      reversible: !a.revertida_en && regla.reversible,
      noReversiblePorque: a.revertida_en || regla.reversible ? null : regla.porque,
      campanaId: existe ? (a.objetivo_id ?? undefined) : undefined,
      creadorId: a.creador_id ?? undefined,
      contexto: { campana: a.campana ?? undefined, creadorDeCampana: a.creador ?? undefined },
    };
  });
}

export async function obtenerActividad(id: string): Promise<ActividadDeSupervisor | null> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return null;

  try {
    const result = await pool.query<FilaSupervisorDB>(
      `SELECT ${COLUMNAS_DE_SUPERVISOR} FROM usuarios u
       WHERE u.id = $1 AND ${ES_O_FUE_SUPERVISOR}
       LIMIT 1`,
      [numericId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const [campanas, acciones, observaciones] = await Promise.all([
      pool.query<{ id: number; name: string; status: string }>(
        `SELECT id, name, status FROM campanas WHERE supervisor_id = $1 ORDER BY updated_at DESC`,
        [numericId],
      ),
      consultarAcciones(numericId),
      pool.query<{ created_at: Date; detalle: { causal?: string; descripcion?: string; campana?: string } }>(
        `SELECT created_at, detalle FROM audit_log
         WHERE accion = 'supervision.revertir' AND detalle->>'supervisorId' = $1::text
           AND (detalle->>'observacionEnExpediente')::boolean
         ORDER BY created_at DESC`,
        [numericId],
      ),
    ]);

    return {
      ...supervisorDesdeDB(row),
      campanas: campanas.rows.map((c) => ({ id: String(c.id), nombre: c.name, estado: estadoDeCampana(c.status) })),
      acciones,
      observaciones: observaciones.rows.map((o) => ({
        fecha: o.created_at,
        causal: o.detalle.causal ?? "",
        descripcion: o.detalle.descripcion ?? "",
        sobre: o.detalle.campana ?? "",
      })),
    };
  } catch (error) {
    console.error("Error obteniendo actividad de supervisor", error);
    return null;
  }
}

/** Una acción del supervisor, para la pantalla de reversión y para revertirAccion. */
export async function obtenerAccion(
  supervisorId: string,
  accionId: string,
): Promise<AccionDeSupervisor | null> {
  if (!/^\d+$/.test(supervisorId) || !/^\d+$/.test(accionId)) return null;
  try {
    const [accion] = await consultarAcciones(Number(supervisorId), Number(accionId));
    return accion ?? null;
  } catch (error) {
    console.error("Error obteniendo acción de supervisor", error);
    return null;
  }
}
