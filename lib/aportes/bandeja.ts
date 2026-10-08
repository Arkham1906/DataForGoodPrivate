// Bandeja de aportes del SuperUsuario (/aportes, SCR-WEB-14) y pestañas de la sección Aportes.
// Exige sesión raíz. Solo el registro de lo que llega: nunca el archivo, el correo ni la descripción completa.

import type { Pestana } from "@/components/sistema/subtabs";
import { pool } from "@/lib/db";
import { NOMBRE_DE_TIPO, esTipo } from "@/lib/campanas/sistema-opciones";
import { hasRootSession } from "@/lib/rootSession";

/** Pestañas de la sección Aportes. Las comparten el dashboard y la bandeja. */
export const PESTANAS_APORTES: Pestana[] = [
  { href: "/aportes/dashboard", etiqueta: "Dashboard" },
  { href: "/aportes", etiqueta: "Bandeja" },
];

export const POR_PAGINA = 20;

/** Filtro de la bandeja. "pendientes" junta la primera instancia y la espera del creador. */
export type FiltroDeEtapa = "pendientes" | "aceptado" | "rechazado";

export const FILTROS_DE_ETAPA: { valor: FiltroDeEtapa; etiqueta: string }[] = [
  { valor: "pendientes", etiqueta: "Pendientes" },
  { valor: "aceptado", etiqueta: "Aceptados" },
  { valor: "rechazado", etiqueta: "Rechazados" },
];

export function esFiltroDeEtapa(v?: string): FiltroDeEtapa | undefined {
  return FILTROS_DE_ETAPA.some((f) => f.valor === v) ? (v as FiltroDeEtapa) : undefined;
}

type Etapa = "pendiente" | "espera_final" | "aceptado" | "rechazado";

export const ETIQUETA_DE_ETAPA: Record<Etapa, { texto: string; tono: "default" | "ok" | "warn" | "danger" }> = {
  pendiente: { texto: "Sin revisar", tono: "default" },
  // Ya la validó el revisor: falta la decisión del creador.
  espera_final: { texto: "Espera final", tono: "warn" },
  aceptado: { texto: "Aceptado", tono: "ok" },
  rechazado: { texto: "Rechazado", tono: "danger" },
};

export type FilaDeAporte = {
  id: string;
  participante: string;
  anonimo: boolean;
  /** "YYYY-MM-DDTHH:MI" en hora de Tepic. */
  enviadoEn: string;
  campanaId: string;
  campana: string;
  /** Primeros caracteres de la descripción; null en aportes sin cuenta. */
  resumen: string | null;
  tipo: string;
  etapa: { texto: string; tono: "default" | "ok" | "warn" | "danger" };
};

export type FiltrosDeAportes = {
  q?: string;
  etapa?: FiltroDeEtapa;
  campanaId?: string;
  pagina?: number;
};

const LARGO_DEL_RESUMEN = 90;

const CONDICION_DE_ETAPA: Record<FiltroDeEtapa, string> = {
  pendientes: `a.status IN ('pendiente', 'espera_final')`,
  aceptado: `a.status = 'aceptado'`,
  rechazado: `a.status = 'rechazado'`,
};

async function exigirRoot(): Promise<void> {
  if (!(await hasRootSession())) throw new Error("No autorizado");
}

/** WHERE de búsqueda y campaña (sin la etapa, para que los conteos de las fichas la ignoren). */
function filtrosBase(f: FiltrosDeAportes): { condiciones: string[]; valores: unknown[] } {
  const condiciones: string[] = [];
  const valores: unknown[] = [];
  if (f.campanaId && /^\d{1,9}$/.test(f.campanaId)) {
    valores.push(Number(f.campanaId));
    condiciones.push(`a.campaign_id = $${valores.length}`);
  }
  const q = f.q?.trim();
  if (q) {
    valores.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const p = `$${valores.length}`;
    // A un anónimo no se le busca por nombre: su fila dice "Anónimo".
    condiciones.push(`((a.anonimo_id IS NULL AND a.participant_name ILIKE ${p}) OR c.name ILIKE ${p})`);
  }
  return { condiciones, valores };
}

const donde = (condiciones: string[]) => (condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "");

/** Un aporte tal como lo ve el SuperUsuario: sin descripción de anónimos ni datos de contacto. */
function filaDeAporte(r: {
  id: number;
  participant_name: string;
  anonimo: boolean;
  enviado_en: string;
  campaign_id: number;
  campana: string;
  resumen: string;
  largo: number;
  file_type: string;
  status: string;
}): FilaDeAporte {
  const tipo = esTipo(r.file_type);
  const etapa = ETIQUETA_DE_ETAPA[r.status as Etapa] ?? { texto: r.status, tono: "default" as const };
  return {
    id: String(r.id),
    participante: r.anonimo ? "Anónimo" : r.participant_name,
    anonimo: r.anonimo,
    enviadoEn: r.enviado_en,
    campanaId: String(r.campaign_id),
    campana: r.campana,
    resumen: r.anonimo ? null : `${r.resumen.trim()}${r.largo > LARGO_DEL_RESUMEN ? "…" : ""}`,
    tipo: tipo ? NOMBRE_DE_TIPO[tipo] : r.file_type,
    etapa,
  };
}

/** Aportes de una misma persona en la bandeja: con cuenta, o sin cuenta desde un mismo dispositivo. */
export type GrupoDeAportes = {
  /** `u<id>` (con cuenta), `n<n>` (dispositivo anónimo, numerado en la página) o `a<id>` (aporte suelto). */
  clave: string;
  participante: string;
  anonimo: boolean;
  /** Id del usuario, para "Ver ficha"; null si no tiene cuenta. */
  usuarioId: string | null;
  total: number;
  /** Fecha del envío más reciente ("YYYY-MM-DDTHH:MI", hora de Tepic). */
  ultimoEnvio: string;
  campanas: { id: string; nombre: string }[];
  /** Cuántos hay en cada etapa (solo las que tienen alguno). */
  porEtapa: { texto: string; tono: "default" | "ok" | "warn" | "danger"; n: number }[];
  /** Los aportes, del más reciente al más viejo (hasta APORTES_POR_GRUPO). */
  aportes: FilaDeAporte[];
};

/** Aportes que se muestran al desplegar a una persona; si tiene más, se avisa cuántos faltan. */
export const APORTES_POR_GRUPO = 50;

// A quién pertenece cada aporte. `a` es la fila de aportes.
const CLAVE_DE_GRUPO = `CASE
  WHEN a.user_id IS NOT NULL THEN 'u' || a.user_id
  WHEN a.anonimo_id IS NOT NULL THEN 'n' || a.anonimo_id
  ELSE 'a' || a.id
END`;

/**
 * La bandeja agrupada por persona (2026-10-08): una fila por participante con
 * cuántos aportes mandó, a qué campañas y en qué etapa están, y sus aportes
 * para desplegar. La búsqueda, la campaña y la etapa filtran los aportes, y
 * una persona aparece si le queda alguno. Se pagina por persona
 * (POR_PAGINA), primero quien envió más recientemente, para no partir a nadie
 * entre dos páginas. El identificador del dispositivo anónimo nunca sale de aquí.
 */
export async function buscarAportesPorParticipante(
  f: FiltrosDeAportes,
): Promise<{ grupos: GrupoDeAportes[]; totalDeGrupos: number }> {
  await exigirRoot();
  const { condiciones, valores } = filtrosBase(f);
  if (f.etapa) condiciones.push(CONDICION_DE_ETAPA[f.etapa]);
  const where = donde(condiciones);
  const pagina = Math.max(1, f.pagina ?? 1);

  try {
    const [grupos, total] = await Promise.all([
      pool.query<{ clave: string; ultimo: Date }>(
        `SELECT ${CLAVE_DE_GRUPO} AS clave, MAX(a.submitted_at) AS ultimo
         FROM aportes a JOIN campanas c ON c.id = a.campaign_id
         ${where}
         GROUP BY 1
         ORDER BY ultimo DESC, clave
         LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`,
        valores,
      ),
      pool.query<{ n: string }>(
        `SELECT COUNT(DISTINCT ${CLAVE_DE_GRUPO}) AS n FROM aportes a JOIN campanas c ON c.id = a.campaign_id ${where}`,
        valores,
      ),
    ]);
    const claves = grupos.rows.map((g) => g.clave);
    if (claves.length === 0) return { grupos: [], totalDeGrupos: Number(total.rows[0]?.n ?? 0) };

    // Los aportes de esas personas, con los mismos filtros; `total_grupo` cuenta también los que no se traen.
    valores.push(claves);
    const { rows } = await pool.query<{
      clave: string;
      total_grupo: string;
      id: number;
      user_id: number | null;
      participant_name: string;
      anonimo: boolean;
      enviado_en: string;
      campaign_id: number;
      campana: string;
      resumen: string;
      largo: number;
      file_type: string;
      status: string;
    }>(
      `SELECT * FROM (
         SELECT ${CLAVE_DE_GRUPO} AS clave,
                COUNT(*) OVER (PARTITION BY ${CLAVE_DE_GRUPO}) AS total_grupo,
                ROW_NUMBER() OVER (PARTITION BY ${CLAVE_DE_GRUPO} ORDER BY a.submitted_at DESC, a.id DESC) AS n,
                a.id, a.user_id, a.participant_name, (a.user_id IS NULL AND a.anonimo_id IS NOT NULL) AS anonimo,
                to_char((a.submitted_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mazatlan', 'YYYY-MM-DD"T"HH24:MI') AS enviado_en,
                a.submitted_at, a.campaign_id, c.name AS campana,
                LEFT(a.description, ${LARGO_DEL_RESUMEN}) AS resumen, char_length(a.description) AS largo,
                a.file_type, a.status
         FROM aportes a JOIN campanas c ON c.id = a.campaign_id
         ${donde([...condiciones, `${CLAVE_DE_GRUPO} = ANY($${valores.length}::text[])`])}
       ) t
       WHERE n <= ${APORTES_POR_GRUPO}
       ORDER BY submitted_at DESC, id DESC`,
      valores,
    );

    const porClave = new Map<string, typeof rows>();
    for (const r of rows) porClave.set(r.clave, [...(porClave.get(r.clave) ?? []), r]);

    let dispositivo = 0;
    return {
      totalDeGrupos: Number(total.rows[0]?.n ?? 0),
      grupos: claves.map((clave) => {
        const filas = porClave.get(clave) ?? [];
        const primera = filas[0];
        const anonimo = Boolean(primera?.anonimo);
        const aportes = filas.map(filaDeAporte);

        const campanas = new Map<string, string>();
        for (const a of aportes) campanas.set(a.campanaId, a.campana);
        const etapas = new Map<string, { texto: string; tono: "default" | "ok" | "warn" | "danger"; n: number }>();
        for (const a of aportes) {
          const e = etapas.get(a.etapa.texto) ?? { ...a.etapa, n: 0 };
          e.n += 1;
          etapas.set(a.etapa.texto, e);
        }

        return {
          // El hash del dispositivo no se manda al navegador: se numera dentro de la página.
          clave: clave.startsWith("n") ? `n${++dispositivo}` : clave,
          participante: anonimo ? "Anónimo" : primera?.participant_name ?? "",
          anonimo,
          usuarioId: primera?.user_id != null ? String(primera.user_id) : null,
          total: Number(primera?.total_grupo ?? 0),
          ultimoEnvio: primera?.enviado_en ?? "",
          campanas: [...campanas].map(([id, nombre]) => ({ id, nombre })),
          porEtapa: [...etapas.values()],
          aportes,
        };
      }),
    };
  } catch (error) {
    console.error("Error buscando aportes por participante", error);
    return { grupos: [], totalDeGrupos: 0 };
  }
}

/** Conteo por etapa con la búsqueda y la campaña actuales. */
export async function contarPorEtapa(f: FiltrosDeAportes): Promise<Record<FiltroDeEtapa | "todos", number>> {
  await exigirRoot();
  const { condiciones, valores } = filtrosBase(f);
  try {
    const { rows } = await pool.query<{ todos: string; pendientes: string; aceptado: string; rechazado: string }>(
      `SELECT COUNT(*) AS todos,
              COUNT(*) FILTER (WHERE ${CONDICION_DE_ETAPA.pendientes}) AS pendientes,
              COUNT(*) FILTER (WHERE ${CONDICION_DE_ETAPA.aceptado}) AS aceptado,
              COUNT(*) FILTER (WHERE ${CONDICION_DE_ETAPA.rechazado}) AS rechazado
       FROM aportes a JOIN campanas c ON c.id = a.campaign_id
       ${donde(condiciones)}`,
      valores,
    );
    const r = rows[0];
    return {
      todos: Number(r?.todos ?? 0),
      pendientes: Number(r?.pendientes ?? 0),
      aceptado: Number(r?.aceptado ?? 0),
      rechazado: Number(r?.rechazado ?? 0),
    };
  } catch {
    return { todos: 0, pendientes: 0, aceptado: 0, rechazado: 0 };
  }
}

/** Campañas que han recibido al menos un aporte, para el filtro. */
export async function listarCampanasConAportes(): Promise<{ id: string; nombre: string }[]> {
  await exigirRoot();
  try {
    const { rows } = await pool.query<{ id: number; name: string }>(
      `SELECT c.id, c.name FROM campanas c
       WHERE EXISTS (SELECT 1 FROM aportes a WHERE a.campaign_id = c.id)
       ORDER BY c.name`,
    );
    return rows.map((r) => ({ id: String(r.id), nombre: r.name }));
  } catch {
    return [];
  }
}

/** Si la campaña tiene un revisor de aportes aceptado (primera instancia). */
export async function campanaTieneRevisor(campanaId: string): Promise<boolean> {
  await exigirRoot();
  try {
    const { rows } = await pool.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM campana_revisores WHERE campana_id = $1 AND estado = 'aceptado'
       ) AS existe`,
      [Number(campanaId)],
    );
    return Boolean(rows[0]?.existe);
  } catch {
    return false;
  }
}
