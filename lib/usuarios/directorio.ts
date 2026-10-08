// Directorio de usuarios del panel (/usuarios/**): búsqueda, ficha, estado de la cuenta y sanciones.
// Ojo: estas consultas no verifican la sesión raíz; dependen del layout del panel (docs/README.md § 8).

import { pool } from "@/lib/db";
import {
  nombreDeRolPrincipal,
  nombresDeRoles,
  rolesVigentesDesde,
  type RolAsignable,
} from "@/lib/usuarios/rol-asignable";
import type { TonoDeEtiqueta } from "@/lib/usuarios/supervisores";

export type { RolAsignable } from "@/lib/usuarios/rol-asignable";
export { CODIGO_DE_ROL, NOMBRE_DE_ROL, QUIEN_ASIGNA } from "@/lib/usuarios/rol-asignable";

/* ── modelo ─────────────────────────────────────────────────────────────── */

export type EstadoDeCuenta = "ACTIVA" | "CON_STRIKES" | "SUSPENDIDA" | "BANEADA";

export type FilaDeUsuario = {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  /** Los mismos roles, uno por etiqueta (la tabla del directorio los pinta como Tag). */
  roles: string[];
  /** Aclaración bajo el rol, p. ej. "(y creador de campañas)". */
  rolDetalle?: string;
  estado: EstadoDeCuenta;
  strikes: number;
};

export type Usuario = FilaDeUsuario & {
  ubicacion: string | null;
  especialidad: string | null;
  registradoEn: Date;
  campanasCreadas: number;
  aportesEnviados: number;
  aportesAceptados: number;
  /** Puede tener cero, uno o los dos roles delegados a la vez. */
  rolesVigentes: RolAsignable[];
  rolDesde: Date | null;
  interesesDeclarados: { tema: string; campanas: number }[];
  historialDeStrikes: { motivo: string; fecha: Date; campana: string }[];
};

export type ReporteDeSancion = {
  id: string;
  campana: string;
  campanaId: string;
  creadorDeCampana: string;
  reportadoPor: string;
  reportadoEn: Date;
  motivoDelRechazo: string;
  aporte: {
    id: string;
    descripcion: string;
    archivo: string;
    enviadoEn: Date;
    ubicacion: string | null;
  };
};

export type TipoDeSancion = "STRIKE" | "BANEO_DE_CAMPANA" | "SUSPENSION_TEMPORAL";

/** Una sanción de /usuarios/sanciones, de la cuenta o de una campaña (ver listarSanciones). */
export type RegistroDeSancion = {
  /** Único en la lista: `s<id>` (tabla sanciones), `b<id>` (bitácora) o `cb<id>` (campana_baneados). */
  id: string;
  /** Id en la tabla `sanciones`, para restaurarla; null en los baneos por campaña. */
  sancionId: string | null;
  usuarioId: string;
  usuario: string;
  tipo: "STRIKE" | "SUSPENSION" | "BANEO" | "BANEO_EN_CAMPANA";
  /** Solo en la suspensión. */
  dias?: number;
  motivo: string;
  /** null: la sanción es de toda la cuenta. */
  campana: { id: string; nombre: string } | null;
  /** Aporte por el que se baneó en la campaña, si se sabe. */
  aporteId: string | null;
  /** Quién la aplicó: "SuperUsuario", "Automático (3 strikes)" o el creador de la campaña. */
  quien: string;
  fecha: Date;
  /** Texto del estado: "Vigente", "Vigente hasta el…", "Restaurada el…", "Levantado el…". */
  estado: string;
  vigente: boolean;
  restaurable: boolean;
};

/* ── etiquetas de presentación ──────────────────────────────────────────── */

/** Mismos tonos que components/sistema/Tag. */
export const ETIQUETA_DE_ESTADO: Record<
  EstadoDeCuenta,
  { texto: string; tono: TonoDeEtiqueta }
> = {
  ACTIVA: { texto: "Activo", tono: "ok" },
  CON_STRIKES: { texto: "Con strikes", tono: "warn" },
  SUSPENDIDA: { texto: "Suspendida", tono: "danger" },
  BANEADA: { texto: "Baneada", tono: "danger" },
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
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Mazatlan",
});

export const formatearFecha = (f: Date) => fechaCorta.format(f);
export const formatearFechaYHora = (f: Date) => fechaConHora.format(f);

/*
 * ────────────────────────────────────────────────────────────────────────────
 * ESTADO DE CONEXIÓN
 *
 * buscarUsuarios y obtenerUsuario leen la tabla real `usuarios` (la misma que
 * usan el registro y `/api/usuarios`). Nombre, correo, rol, fecha de registro,
 * campañas creadas y aportes enviados/aceptados son reales. `estado`, `strikes`
 * y `historialDeStrikes` salen de la tabla real `sanciones` (ver
 * ensureSancionesTable en lib/db-schema.ts): un STRIKE nunca se borra (el
 * contador es para siempre, según acciones-usuarios.ts), y SUSPENDIDA/BANEADA
 * dependen de que haya una sanción de tipo SUSPENSION_TEMPORAL (sin vencer) o
 * BANEO_DE_CAMPANA todavía activa (`activa = true`, sin restaurar).
 *
 * Lo que SIGUE siendo de muestra, porque no existe tabla o flujo para eso:
 *   - rolDesde: no se guarda cuándo se asignó el rol, así que va en null.
 *   - interesesDeclarados: la columna `intereses` es una lista de strings, no
 *     tiene el conteo de campañas por tema del mockup, así que ese conteo
 *     queda en 0.
 *   - obtenerReporteDeSancion: no hay flujo de "reportar un aporte para
 *     sanción" en la app y ninguna pantalla la usa; se deja como estaba.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const POR_PAGINA = 20;

type FilaUsuarioDB = {
  id: number;
  nombre: string;
  apellidos: string;
  email: string;
  role: string[] | null;
  strikes: string | number;
  suspendida: boolean;
  baneada: boolean;
};

/** Subconsulta agregada: una fila por usuario con sus sanciones resumidas. */
export const RESUMEN_DE_SANCIONES = `
  LEFT JOIN (
    SELECT
      usuario_id,
      COUNT(*) FILTER (WHERE tipo = 'STRIKE') AS strikes,
      BOOL_OR(
        activa AND tipo = 'SUSPENSION_TEMPORAL'
        AND aplicada_en + (COALESCE(dias, 0) || ' days')::interval > NOW()
      ) AS suspendida,
      BOOL_OR(activa AND tipo = 'BANEO_DE_CAMPANA') AS baneada
    FROM sanciones
    GROUP BY usuario_id
  ) rs ON rs.usuario_id = u.id
`;

export function estadoDesdeSanciones(strikes: number, suspendida: boolean, baneada: boolean): EstadoDeCuenta {
  if (baneada) return "BANEADA";
  if (suspendida) return "SUSPENDIDA";
  if (strikes > 0) return "CON_STRIKES";
  return "ACTIVA";
}

function filaDesdeDB(row: FilaUsuarioDB): FilaDeUsuario {
  const roles = row.role ?? [];
  const strikes = Number(row.strikes ?? 0);
  return {
    id: String(row.id),
    nombre: `${row.nombre} ${row.apellidos}`.trim(),
    correo: row.email,
    rol: nombreDeRolPrincipal(roles),
    roles: nombresDeRoles(roles),
    estado: estadoDesdeSanciones(strikes, Boolean(row.suspendida), Boolean(row.baneada)),
    strikes,
  };
}

export async function buscarUsuarios(opciones: {
  q?: string;
  rol?: string;
  estado?: string;
  pagina?: number;
}): Promise<{ filas: FilaDeUsuario[]; total: number; pagina: number }> {
  const pagina = Math.max(1, opciones.pagina ?? 1);
  const q = (opciones.q ?? "").trim();
  const rol = (opciones.rol ?? "").trim();
  const estado = (opciones.estado ?? "").trim() as EstadoDeCuenta | "";

  // En una BD recién levantada `usuarios`/`sanciones` todavía no existen (las
  // crea bajo demanda el registro y el panel de sanciones): sin este
  // try/catch, la primera visita al directorio tumba la página con
  // "relation ... does not exist" en vez de mostrar la lista vacía.
  try {
    const condiciones: string[] = [];
    const valores: Array<string | number> = [];

    if (q) {
      valores.push(`%${q}%`);
      const posicion = valores.length;
      condiciones.push(
        `(u.nombre ILIKE $${posicion} OR u.apellidos ILIKE $${posicion} OR u.email ILIKE $${posicion} OR CAST(u.id AS TEXT) = $${posicion + 1})`,
      );
      valores.push(q);
    }

    if (rol) {
      valores.push(JSON.stringify([rol]));
      condiciones.push(`u.role @> $${valores.length}::jsonb`);
    }

    const condicionDeEstado: Record<EstadoDeCuenta, string> = {
      ACTIVA: "NOT COALESCE(rs.baneada, false) AND NOT COALESCE(rs.suspendida, false) AND COALESCE(rs.strikes, 0) = 0",
      CON_STRIKES: "NOT COALESCE(rs.baneada, false) AND NOT COALESCE(rs.suspendida, false) AND COALESCE(rs.strikes, 0) > 0",
      SUSPENDIDA: "NOT COALESCE(rs.baneada, false) AND COALESCE(rs.suspendida, false)",
      BANEADA: "COALESCE(rs.baneada, false)",
    };
    if (estado) {
      condiciones.push(condicionDeEstado[estado]);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

    const totalResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)
       FROM usuarios u
       ${RESUMEN_DE_SANCIONES}
       ${where}`,
      valores,
    );
    const total = Number(totalResult.rows[0]?.count ?? 0);

    const offset = (pagina - 1) * POR_PAGINA;
    const valoresConPaginacion = [...valores, POR_PAGINA, offset];
    const posicionLimit = valoresConPaginacion.length - 1;
    const posicionOffset = valoresConPaginacion.length;

    const result = await pool.query<FilaUsuarioDB>(
      `SELECT u.id, u.nombre, u.apellidos, u.email, u.role,
              COALESCE(rs.strikes, 0) AS strikes,
              COALESCE(rs.suspendida, false) AS suspendida,
              COALESCE(rs.baneada, false) AS baneada
       FROM usuarios u
       ${RESUMEN_DE_SANCIONES}
       ${where}
       ORDER BY u.id DESC
       LIMIT $${posicionLimit} OFFSET $${posicionOffset}`,
      valoresConPaginacion,
    );

    return { filas: result.rows.map(filaDesdeDB), total, pagina };
  } catch (error) {
    console.error("Error buscando usuarios", error);
    return { filas: [], total: 0, pagina };
  }
}

export async function obtenerUsuario(id: string): Promise<Usuario | null> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return null;

  try {
    const result = await pool.query<
      FilaUsuarioDB & {
        state: string | null;
        city: string | null;
        specialty: string | null;
        intereses: string[] | null;
        created_at: string;
      }
    >(
      `SELECT u.id, u.nombre, u.apellidos, u.email, u.role, u.state, u.city, u.specialty, u.intereses, u.created_at,
              COALESCE(rs.strikes, 0) AS strikes,
              COALESCE(rs.suspendida, false) AS suspendida,
              COALESCE(rs.baneada, false) AS baneada
       FROM usuarios u
       ${RESUMEN_DE_SANCIONES}
       WHERE u.id = $1
       LIMIT 1`,
      [numericId],
    );
    const row = result.rows[0];
    if (!row) return null;

    let historialDeStrikes: Usuario["historialDeStrikes"] = [];
    try {
      const strikesResult = await pool.query<{ detalle: string; aplicada_en: string }>(
        `SELECT detalle, aplicada_en FROM sanciones
         WHERE usuario_id = $1 AND tipo = 'STRIKE'
         ORDER BY aplicada_en DESC`,
        [numericId],
      );
      historialDeStrikes = strikesResult.rows.map((s) => ({
        motivo: s.detalle,
        fecha: new Date(s.aplicada_en),
        campana: "Sanción general",
      }));
    } catch (error) {
      console.error("Error listando historial de strikes", error);
    }

    // `campanas` y `aportes` las crea bajo demanda su propia ruta API: si
    // nadie las visitó todavía, no existen. Aseguramos ambas antes de
    // consultarlas y, si aun así fallan (conexión caída, etc.), la ficha
    // muestra 0 en vez de tumbar la página.
    let campanasCreadas = 0;
    let aportesEnviados = 0;
    let aportesAceptados = 0;

    try {
      const [campanasResult, aportesResult] = await Promise.all([
        pool.query<{ count: string }>(`SELECT COUNT(*) FROM campanas WHERE creator_id = $1`, [
          numericId,
        ]),
        pool.query<{ total: string; aceptados: string }>(
          `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'aceptado') AS aceptados
           FROM aportes WHERE user_id = $1`,
          [numericId],
        ),
      ]);

      campanasCreadas = Number(campanasResult.rows[0]?.count ?? 0);
      aportesEnviados = Number(aportesResult.rows[0]?.total ?? 0);
      aportesAceptados = Number(aportesResult.rows[0]?.aceptados ?? 0);
    } catch (error) {
      console.error("Error contando campañas/aportes del usuario", error);
    }

    return {
      ...filaDesdeDB(row),
      ubicacion: row.city && row.state ? `${row.city}, ${row.state}` : row.city || row.state || null,
      especialidad: row.specialty || null,
      registradoEn: new Date(row.created_at),
      campanasCreadas,
      aportesEnviados,
      aportesAceptados,
      rolesVigentes: rolesVigentesDesde(row.role ?? []),
      rolDesde: null,
      interesesDeclarados: (row.intereses ?? []).map((tema) => ({ tema, campanas: 0 })),
      historialDeStrikes,
    };
  } catch (error) {
    console.error("Error obteniendo usuario", error);
    return null;
  }
}

export async function obtenerReporteDeSancion(
  usuarioId: string,
): Promise<ReporteDeSancion | null> {
  if (usuarioId !== "8412") return null;

  return {
    id: "R-2841",
    campana: "Censo de árboles urbanos",
    campanaId: "17",
    creadorDeCampana: "Ana Ruiz",
    reportadoPor: "Diego Salas · revisor",
    reportadoEn: new Date("2026-08-14T16:48:00Z"),
    motivoDelRechazo: "Contenido fuera de tema",
    aporte: {
      id: "4903",
      descripcion: "Foto de mi perro en el parque, no encontré árboles cerca.",
      archivo: "IMG_2903.jpg",
      enviadoEn: new Date("2026-08-14T16:31:00Z"),
      ubicacion: "21.5041, −104.8946",
    },
  };
}

/**
 * Todas las sanciones de los usuarios que siguen existiendo (2026-10-08), de la
 * más reciente a la más vieja. Vienen de dos lados:
 *   - De la cuenta (tabla `sanciones`): strike, suspensión o baneo que aplica el
 *     SuperUsuario desde /usuarios/[id]/sancion, o el baneo automático al
 *     tercer strike. No están ligadas a una campaña.
 *   - Por campaña: el creador saca a alguien de su campaña por un aporte. El
 *     historial sale de `campana.banear` en audit_log (la fila de
 *     `campana_baneados` se borra al quitar el baneo); los baneos anteriores a
 *     la bitácora salen de `campana_baneados`.
 * Solo una suspensión o un baneo de cuenta vigentes se pueden restaurar desde
 * aquí (`restaurable`). El baneo por campaña lo quita su creador.
 */
export async function listarSanciones(): Promise<RegistroDeSancion[]> {
  try {
    const [cuenta, campana] = await Promise.all([
      pool.query<{
        id: number;
        tipo: string;
        detalle: string;
        dias: number | null;
        aplicada_en: Date;
        aplicada_por: string;
        activa: boolean;
        restaurada_en: Date | null;
        usuario_id: number;
        nombre: string;
        apellidos: string;
      }>(
        `SELECT s.id, s.tipo, s.detalle, s.dias, s.aplicada_en, s.aplicada_por, s.activa, s.restaurada_en,
                u.id AS usuario_id, u.nombre, u.apellidos
         FROM sanciones s
         JOIN usuarios u ON u.id = s.usuario_id`,
      ),
      pool.query<{
        clave: string;
        fecha: Date;
        motivo: string;
        campana_id: number | null;
        campana: string | null;
        aporte_id: number | null;
        quien: string | null;
        levantado_en: Date | null;
        usuario_id: number;
        nombre: string;
        apellidos: string;
      }>(
        `SELECT 'b' || a.id AS clave, a.created_at AS fecha, a.detalle->>'motivo' AS motivo,
                c.id AS campana_id, c.name AS campana, (a.detalle->>'aporteId')::int AS aporte_id,
                COALESCE(NULLIF(TRIM(q.nombre || ' ' || q.apellidos), ''), c.creator_name) AS quien,
                (SELECT MIN(d.created_at) FROM audit_log d
                  WHERE d.accion = 'campana.desbanear' AND d.objetivo_tipo = 'usuario'
                    AND d.objetivo_id = a.objetivo_id AND d.detalle->>'campanaId' = a.detalle->>'campanaId'
                    AND d.id > a.id) AS levantado_en,
                u.id AS usuario_id, u.nombre, u.apellidos
         FROM audit_log a
         JOIN usuarios u ON a.objetivo_tipo = 'usuario' AND u.id::text = a.objetivo_id
         LEFT JOIN campanas c ON c.id::text = a.detalle->>'campanaId'
         LEFT JOIN usuarios q ON q.id = a.actor_id
         WHERE a.accion = 'campana.banear'
         UNION ALL
         SELECT 'cb' || b.id, b.created_at, b.motivo, c.id, c.name, NULL,
                COALESCE(NULLIF(TRIM(q.nombre || ' ' || q.apellidos), ''), c.creator_name), NULL,
                u.id, u.nombre, u.apellidos
         FROM campana_baneados b
         JOIN usuarios u ON u.id = b.usuario_id
         JOIN campanas c ON c.id = b.campana_id
         LEFT JOIN usuarios q ON q.id = b.baneado_por
         WHERE NOT EXISTS (
           SELECT 1 FROM audit_log a
           WHERE a.accion = 'campana.banear' AND a.objetivo_tipo = 'usuario'
             AND a.objetivo_id = b.usuario_id::text AND a.detalle->>'campanaId' = b.campana_id::text
         )`,
      ),
    ]);

    const ahora = Date.now();
    const registros: RegistroDeSancion[] = [
      ...cuenta.rows.map((s): RegistroDeSancion => {
        const usuario = `${s.nombre} ${s.apellidos}`.trim();
        const base = {
          id: `s${s.id}`,
          sancionId: String(s.id),
          usuarioId: String(s.usuario_id),
          usuario,
          motivo: s.detalle,
          campana: null,
          aporteId: null,
          quien: s.aplicada_por === "Automático" ? "Automático (3 strikes)" : s.aplicada_por,
          fecha: s.aplicada_en,
        };
        if (s.tipo === "STRIKE") {
          return {
            ...base,
            tipo: "STRIKE",
            estado: s.activa ? "Cuenta para el baneo" : "Retirado",
            vigente: s.activa,
            restaurable: false,
          };
        }
        if (s.tipo === "SUSPENSION_TEMPORAL") {
          const vence = new Date(s.aplicada_en.getTime() + (s.dias ?? 0) * 86_400_000);
          const vigente = s.activa && vence.getTime() > ahora;
          return {
            ...base,
            tipo: "SUSPENSION",
            dias: s.dias ?? 0,
            estado: !s.activa
              ? `Restaurada${s.restaurada_en ? ` el ${formatearFecha(s.restaurada_en)}` : ""}`
              : vigente
                ? `Vigente hasta el ${formatearFecha(vence)}`
                : `Venció el ${formatearFecha(vence)}`,
            vigente,
            restaurable: vigente,
          };
        }
        return {
          ...base,
          tipo: "BANEO",
          estado: s.activa
            ? "Vigente"
            : `Restaurado${s.restaurada_en ? ` el ${formatearFecha(s.restaurada_en)}` : ""}`,
          vigente: s.activa,
          restaurable: s.activa,
        };
      }),
      ...campana.rows.map((b): RegistroDeSancion => {
        const vigente = !b.levantado_en;
        return {
          id: b.clave,
          sancionId: null,
          usuarioId: String(b.usuario_id),
          usuario: `${b.nombre} ${b.apellidos}`.trim(),
          tipo: "BANEO_EN_CAMPANA",
          motivo: b.motivo,
          campana: b.campana_id && b.campana ? { id: String(b.campana_id), nombre: b.campana } : null,
          aporteId: b.aporte_id ? String(b.aporte_id) : null,
          quien: b.quien ? `${b.quien} (creador)` : "Creador de la campaña",
          fecha: b.fecha,
          estado: vigente ? "Vigente" : `Levantado el ${formatearFecha(b.levantado_en as Date)}`,
          vigente,
          restaurable: false,
        };
      }),
    ];

    return registros.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  } catch (error) {
    console.error("Error listando sanciones", error);
    return [];
  }
}
