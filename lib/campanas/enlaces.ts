// Enlace público de participación de una campaña (/c/[token]) y su código QR.
// Tabla campana_enlaces (lib/db-schema.ts). El enlace se genera solo cuando la
// campaña queda activa (asegurarEnlaceVigente) y el creador puede regenerarlo.
// Lo usan el cuadro "Compartir" de /campanas/[id], la ruta pública /c/[token],
// los route handlers /api/campanas/[id]/{enlace,qr}, POST /api/aportes (para
// saber por qué enlace entró un aporte) y las transiciones a "activa"
// (lib/supervision/decision.ts, lib/campaign-date.ts, PATCH/PUT de campañas).
// Aquí no se autoriza: cada llamador comprueba antes la sesión y el permiso.

import { randomInt } from "node:crypto";
import QRCode from "qrcode";
import { absoluteUrl } from "@/lib/app-url";
import { tiposAceptados, type TipoDeArchivo } from "@/lib/aportes/archivo";
import { normalizeCampaignDate } from "@/lib/campaign-date";
import { seccionesDesdeFila, type SeccionDeChecklist } from "@/lib/campanas/checklist";
import { pausaDesdeFila, type PausaDeCampana } from "@/lib/campanas/pausa";
import { pool } from "@/lib/db";
import { quienOrganiza } from "@/lib/campanas/organizacion";

/** Ventana durante la cual el enlace sirve; al vencer hay que regenerarlo. */
export const HORAS_DE_VIGENCIA = 24;

// Sin 0/o, 1/l/i para que el token se pueda dictar o teclear sin confusión.
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";
const LARGO_DEL_TOKEN = 10;
const FORMATO_DE_TOKEN = /^[a-z0-9]{6,32}$/;

export type EnlaceDeCampana = {
  id: number;
  campanaId: number;
  token: string;
  creadoEn: Date;
  expiraEn: Date;
  revocadoEn: Date | null;
  visitas: number;
  /** Aportes que llegaron con este token (aportes.enlace_id). */
  aportesRecibidos: number;
};

export type CampanaDelCreador = { id: number; nombre: string; status: string };
export type CampanaParaCompartir = CampanaDelCreador & { creadorId: number; permiteAnonimos: boolean };

export function urlPublica(token: string): string {
  return absoluteUrl(`/c/${token}`).toString();
}

export function estaVigente(enlace: EnlaceDeCampana, ahora = new Date()): boolean {
  return enlace.revocadoEn === null && enlace.expiraEn.getTime() > ahora.getTime();
}

function nuevoToken(): string {
  let token = "";
  for (let i = 0; i < LARGO_DEL_TOKEN; i++) token += ALFABETO[randomInt(ALFABETO.length)];
  return token;
}

function mapEnlace(row: Record<string, unknown>): EnlaceDeCampana {
  return {
    id: Number(row.id),
    campanaId: Number(row.campana_id),
    token: String(row.token),
    creadoEn: new Date(row.creado_en as string),
    expiraEn: new Date(row.expira_en as string),
    revocadoEn: row.revocado_en ? new Date(row.revocado_en as string) : null,
    visitas: Number(row.visitas ?? 0),
    aportesRecibidos: Number(row.aportes_recibidos ?? 0),
  };
}

const SELECT_ENLACE = `
  SELECT e.*, (SELECT COUNT(*) FROM aportes a WHERE a.enlace_id = e.id)::int AS aportes_recibidos
  FROM campana_enlaces e`;

/** Datos mínimos de la campaña para el cuadro "Compartir"; null si no existe. */
export async function obtenerCampanaParaCompartir(campanaId: string): Promise<CampanaParaCompartir | null> {
  if (!/^\d+$/.test(campanaId)) return null;
  const { rows } = await pool.query(
    `SELECT id, name, status, creator_id, permite_anonimos FROM campanas WHERE id = $1 LIMIT 1`,
    [campanaId]
  );
  if (rows.length === 0) return null;
  return {
    id: Number(rows[0].id),
    nombre: String(rows[0].name),
    status: String(rows[0].status),
    creadorId: Number(rows[0].creator_id),
    permiteAnonimos: rows[0].permite_anonimos !== false,
  };
}

/** Interruptor del creador "Permitir aportes sin cuenta" (campanas.permite_anonimos). */
export async function cambiarPermiteAnonimos(campanaId: number, permitir: boolean): Promise<void> {
  await pool.query(`UPDATE campanas SET permite_anonimos = $2, updated_at = NOW() WHERE id = $1`, [campanaId, permitir]);
}

/** La campaña si `usuarioId` es su creador; null si no existe o es ajena. */
export async function obtenerCampanaDelCreador(campanaId: string, usuarioId: string | number): Promise<CampanaDelCreador | null> {
  if (!/^\d+$/.test(campanaId)) return null;
  const { rows } = await pool.query(
    `SELECT id, name, status FROM campanas WHERE id = $1 AND creator_id = $2 LIMIT 1`,
    [campanaId, usuarioId]
  );
  if (rows.length === 0) return null;
  return { id: Number(rows[0].id), nombre: String(rows[0].name), status: String(rows[0].status) };
}

/** El último enlace no revocado de la campaña (vigente o caducado), o null si nunca se generó. */
export async function obtenerEnlaceActual(campanaId: number): Promise<EnlaceDeCampana | null> {
  const { rows } = await pool.query(
    `${SELECT_ENLACE} WHERE e.campana_id = $1 AND e.revocado_en IS NULL ORDER BY e.creado_en DESC LIMIT 1`,
    [campanaId]
  );
  return rows.length ? mapEnlace(rows[0]) : null;
}

/**
 * Revoca el enlace actual (sin borrarlo: conserva sus visitas y aportes) y
 * crea uno nuevo que vence en HORAS_DE_VIGENCIA. Todo en una transacción para
 * que nunca haya dos enlaces sin revocar de la misma campaña.
 *
 * Con `soloSiNoHayVigente`, si ya existe un enlace vigente no toca nada y
 * devuelve null (lo usa asegurarEnlaceVigente al activar una campaña).
 */
async function crearEnlace(
  campanaId: number,
  usuarioId: string | number | null,
  soloSiNoHayVigente: boolean
): Promise<EnlaceDeCampana | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Bloquea la campaña: dos regeneraciones o activaciones simultáneas se hacen una tras otra.
    await client.query(`SELECT id FROM campanas WHERE id = $1 FOR NO KEY UPDATE`, [campanaId]);
    if (soloSiNoHayVigente) {
      const vigente = await client.query(
        `SELECT 1 FROM campana_enlaces
         WHERE campana_id = $1 AND revocado_en IS NULL AND expira_en > NOW() LIMIT 1`,
        [campanaId]
      );
      if (vigente.rowCount) {
        await client.query("COMMIT");
        return null;
      }
    }
    await client.query(
      `UPDATE campana_enlaces SET revocado_en = NOW() WHERE campana_id = $1 AND revocado_en IS NULL`,
      [campanaId]
    );
    const { rows } = await client.query(
      `INSERT INTO campana_enlaces (campana_id, token, creado_por, expira_en)
       VALUES ($1, $2, $3, NOW() + make_interval(hours => $4::int))
       RETURNING *, 0 AS aportes_recibidos`,
      [campanaId, nuevoToken(), usuarioId, HORAS_DE_VIGENCIA]
    );
    await client.query("COMMIT");
    return mapEnlace(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** El creador pide un token nuevo: revoca el actual (si hay) y crea otro. */
export async function regenerarEnlace(campanaId: number, usuarioId: string | number): Promise<EnlaceDeCampana> {
  return (await crearEnlace(campanaId, usuarioId, false)) as EnlaceDeCampana;
}

/**
 * Se llama cuando una campaña queda `activa` (la acepta el supervisor y ya
 * empezó, llega su fecha de inicio o se reactiva): genera su enlace público
 * para que cualquiera pueda compartirla, salvo que ya tenga uno vigente.
 * Un fallo aquí no debe deshacer la activación: se reporta y se sigue; el
 * creador puede generarlo después desde "Compartir".
 */
export async function asegurarEnlaceVigente(campanaId: number): Promise<void> {
  try {
    const { rows } = await pool.query(`SELECT creator_id FROM campanas WHERE id = $1`, [campanaId]);
    await crearEnlace(campanaId, rows[0]?.creator_id ?? null, true);
  } catch (error) {
    console.error(`No se pudo generar el enlace público de la campaña ${campanaId}`, error);
  }
}

export type CampanaDelEnlace = {
  id: number;
  nombre: string;
  descripcion: string;
  tematica: string;
  organizador: string;
  ciudad: string;
  estado: string;
  /** Para todo el país (lib/campanas/ubicacion.ts). */
  todoElPais: boolean;
  status: string;
  meta: number;
  /** Los que cuentan para la meta (./meta.ts). */
  aportesAprobados: number;
  cuotaPorPersona: number;
  /** Reparto de la cuota por tipo de dato; null = solo la cuota general. */
  fechaFin: string | null;
  /** Checklists que el participante puede marcar (el formulario anónimo los muestra). */
  secciones: SeccionDeChecklist[];
  /** Interruptor del creador: si es false, /c/[token] no acepta aportes sin cuenta. */
  permiteAnonimos: boolean;
  /** Tipos de archivo que acepta (campanas.data_types; lib/aportes/archivo.ts). */
  tiposDeArchivo: TipoDeArchivo[];
  /** Quién la pausó y por qué, o null si no está pausada. */
  pausa: PausaDeCampana | null;
};

export type ResultadoDeToken =
  | { tipo: "inexistente" }
  | { tipo: "revocado" | "caducado" | "valido"; enlace: EnlaceDeCampana; campana: CampanaDelEnlace };

/** Busca un token de /c/[token] y dice si sirve. No cuenta la visita: eso es registrarVisita(). */
export async function buscarEnlacePorToken(token: string): Promise<ResultadoDeToken> {
  if (!FORMATO_DE_TOKEN.test(token)) return { tipo: "inexistente" };
  const { rows } = await pool.query(
    `SELECT e.*, (SELECT COUNT(*) FROM aportes a WHERE a.enlace_id = e.id)::int AS aportes_recibidos,
            c.name, c.description, c.tematica, c.tag, c.organizer, c.creator_name, c.location_city, c.location_state, c.todo_el_pais,
            c.status, c.goal_contributions, c.approved_contributions, c.quota_per_user, c.end_date,
            c.checklist_secciones, c.checklist_opciones, c.collection_mode, c.permite_anonimos, c.data_types,
            c.pausa_por, c.pausa_motivo, c.pausada_en
     FROM campana_enlaces e
     JOIN campanas c ON c.id = e.campana_id
     WHERE e.token = $1
     LIMIT 1`,
    [token]
  );
  if (rows.length === 0) return { tipo: "inexistente" };

  const row = rows[0];
  const enlace = mapEnlace(row);
  const campana: CampanaDelEnlace = {
    id: enlace.campanaId,
    nombre: String(row.name ?? ""),
    descripcion: String(row.description ?? ""),
    tematica: String(row.tematica || row.tag || ""),
    organizador: quienOrganiza({ organizer: row.organizer as string | null, creatorName: row.creator_name as string | null }),
    ciudad: String(row.location_city ?? ""),
    estado: String(row.location_state ?? ""),
    todoElPais: row.todo_el_pais === true,
    status: String(row.status ?? ""),
    meta: Number(row.goal_contributions ?? 0),
    aportesAprobados: Number(row.approved_contributions ?? 0),
    cuotaPorPersona: Number(row.quota_per_user ?? 0),
    fechaFin: normalizeCampaignDate(row.end_date),
    secciones: seccionesDesdeFila(row),
    permiteAnonimos: row.permite_anonimos !== false,
    tiposDeArchivo: tiposAceptados(row.data_types),
    pausa: pausaDesdeFila(row),
  };

  if (enlace.revocadoEn) return { tipo: "revocado", enlace, campana };
  if (!estaVigente(enlace)) return { tipo: "caducado", enlace, campana };
  return { tipo: "valido", enlace, campana };
}

/**
 * Visitas ya contadas, por enlace y visitante, en memoria (se reinicia con cada despliegue,
 * como el tope por IP). Antes cada recarga sumaba una visita y la métrica se inflaba.
 */
const VENTANA_DE_VISITA_MS = 30 * 60 * 1000;
const visitasRecientes = new Map<string, number>();
let ultimaPodaDeVisitas = 0;

function yaContada(enlaceId: number, visitante: string): boolean {
  const ahora = Date.now();
  if (ahora - ultimaPodaDeVisitas > 60_000) {
    ultimaPodaDeVisitas = ahora;
    for (const [clave, desde] of visitasRecientes) if (ahora - desde > VENTANA_DE_VISITA_MS) visitasRecientes.delete(clave);
  }
  const clave = `${enlaceId}:${visitante}`;
  const desde = visitasRecientes.get(clave);
  if (desde !== undefined && ahora - desde <= VENTANA_DE_VISITA_MS) return true;
  visitasRecientes.set(clave, ahora);
  return false;
}

/**
 * Suma una visita a un enlace vigente. El mismo visitante (IP) cuenta una vez cada
 * 30 minutos por enlace: son aperturas aproximadas, no personas exactas.
 */
export async function registrarVisita(enlaceId: number, visitante: string): Promise<void> {
  if (yaContada(enlaceId, visitante)) return;
  await pool.query(
    `UPDATE campana_enlaces SET visitas = visitas + 1
     WHERE id = $1 AND revocado_en IS NULL AND expira_en > NOW()`,
    [enlaceId]
  );
}

/**
 * Id del enlace si `token` es el enlace vigente de esa campaña; si no, null.
 * POST /api/aportes lo usa para registrar por qué enlace llegó el aporte; un
 * token inválido no bloquea el aporte, solo no se atribuye.
 */
export async function idDeEnlaceVigente(token: string, campanaId: string | number): Promise<number | null> {
  if (!FORMATO_DE_TOKEN.test(token)) return null;
  const { rows } = await pool.query(
    `SELECT id FROM campana_enlaces
     WHERE token = $1 AND campana_id = $2 AND revocado_en IS NULL AND expira_en > NOW()
     LIMIT 1`,
    [token, campanaId]
  );
  return rows.length ? Number(rows[0].id) : null;
}

const OPCIONES_DE_QR = {
  errorCorrectionLevel: "M" as const,
  margin: 1,
  width: 512,
  color: { dark: "#12131A", light: "#FFFFFF" },
};

/** QR del enlace público como SVG (texto), generado en el servidor. */
export function generarQrSvg(token: string): Promise<string> {
  return QRCode.toString(urlPublica(token), { ...OPCIONES_DE_QR, type: "svg" });
}

/** QR del enlace público como PNG de 512 × 512 px. */
export function generarQrPng(token: string): Promise<Buffer> {
  return QRCode.toBuffer(urlPublica(token), { ...OPCIONES_DE_QR, type: "png" });
}
