// Aporte de una persona SIN cuenta, desde el enlace público de una campaña (/c/[token]).
// Lo llaman POST /api/c/[token]/aportes (enviar) y la página /c/[token] (cuántos le quedan).
//
// Reglas (decididas el 2026-10-01, dominio.md § 6 y puntos abiertos 7 y 18):
//   - Solo con un enlace VIGENTE de una campaña ACTIVA que permita aportes sin cuenta
//     (campanas.permite_anonimos). Sin enlace no hay forma de aportar sin cuenta: la
//     persona anónima no ve ni toca nada más del sistema.
//   - El aporte no lleva datos personales: user_id NULL, participante "Anónimo", sin correo,
//     sin nombre de archivo, y fotos y documentos sin metadatos (lib/aportes/limpiar-archivo.ts;
//     video y audio se guardan tal cual).
//   - Cuota por dispositivo: la misma cuota por persona de la campaña, contada por una cookie
//     anónima (lib/aportes/anonimato.ts). En la BD solo va su sha256 (aportes.anonimo_id).
//   - La IP no se guarda en la BD de ninguna forma. Los límites por IP viven en memoria
//     (se reinician con cada despliegue): el tope por hora y la espera sin cookie.
//   - Tope por IP (TOPE_POR_IP_POR_HORA) contra quien borre la cookie para inundar la campaña.
//   - Espera entre aportes (ESPERA_ENTRE_APORTES_SEGUNDOS) por dispositivo, en cualquier
//     campaña: frena a quien manda uno tras otro. Se mide con aportes.submitted_at. Un envío
//     SIN cookie (dispositivo nuevo) además espera desde el último aporte anónimo de su IP.
//   - Un dispositivo bloqueado en la campaña o en la plataforma no puede aportar.

import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { LARGO_MAXIMO_DESCRIPCION, errorDeArchivo, guardarArchivoDelAporte, insertarAporteConCuota } from "@/lib/aportes/comun";
import { hashDeDispositivo } from "@/lib/aportes/anonimato";
import { bloqueoDelDispositivo } from "@/lib/aportes/sanciones-anonimas";
import { registrarAuditoria } from "@/lib/auditoria";
import { respuestasValidas } from "@/lib/campanas/checklist";
import { buscarEnlacePorToken } from "@/lib/campanas/enlaces";

// TODO(dominio): valor elegido sin consulta. Aportes anónimos por IP en una hora, sumando
// todas las campañas. Holgado para varias personas en la misma red (escuela, oficina).
export const TOPE_POR_IP_POR_HORA = 20;
const VENTANA_MS = 60 * 60 * 1000;

// TODO(dominio): valor elegido sin consulta (2026-10-01). Segundos mínimos entre dos aportes
// sin cuenta del mismo dispositivo, en cualquier campaña.
export const ESPERA_ENTRE_APORTES_SEGUNDOS = 60;

/**
 * Ventana en memoria, como el límite de /root: se reinicia con cada despliegue y no se
 * comparte entre instancias. Basta para frenar abuso; la cuota por dispositivo sí persiste.
 * Las IPs vencidas se podan como mucho una vez por minuto, para que el Map no crezca sin fin.
 */
const enviosPorIp = new Map<string, { n: number; desde: number }>();
/** Último aporte anónimo por IP, para la espera de los envíos sin cookie. Solo en memoria. */
const ultimoEnvioPorIp = new Map<string, number>();
let ultimaPoda = 0;

function podarVencidas(ahora: number): void {
  if (ahora - ultimaPoda < 60_000) return;
  ultimaPoda = ahora;
  for (const [ip, registro] of enviosPorIp) {
    if (ahora - registro.desde > VENTANA_MS) enviosPorIp.delete(ip);
  }
  for (const [ip, momento] of ultimoEnvioPorIp) {
    if (ahora - momento > ESPERA_ENTRE_APORTES_SEGUNDOS * 1000) ultimoEnvioPorIp.delete(ip);
  }
}

/**
 * Espera de un envío SIN cookie: sin ella cada envío es un "dispositivo nuevo" y se saltaba
 * la espera. Si ya puede, reserva el turno de esa IP en el mismo paso (síncrono: dos envíos
 * simultáneos no pasan los dos). Quien ya tiene cookie no espera por otros de su red.
 */
function reservarEsperaSinCookie(ip: string): number {
  if (!ip || ip === "desconocida") return 0;
  const ahora = Date.now();
  podarVencidas(ahora);
  const ultimo = ultimoEnvioPorIp.get(ip);
  const faltan = ultimo === undefined ? 0 : Math.ceil((ultimo + ESPERA_ENTRE_APORTES_SEGUNDOS * 1000 - ahora) / 1000);
  if (faltan > 0) return faltan;
  ultimoEnvioPorIp.set(ip, ahora);
  return 0;
}

function topeAlcanzado(ip: string): boolean {
  const registro = enviosPorIp.get(ip);
  return Boolean(registro && Date.now() - registro.desde <= VENTANA_MS && registro.n >= TOPE_POR_IP_POR_HORA);
}

function contarEnvio(ip: string): void {
  const ahora = Date.now();
  podarVencidas(ahora);
  const registro = enviosPorIp.get(ip);
  if (!registro || ahora - registro.desde > VENTANA_MS) enviosPorIp.set(ip, { n: 1, desde: ahora });
  else registro.n += 1;
  if (ip && ip !== "desconocida") ultimoEnvioPorIp.set(ip, ahora);
}

/** Aportes que este dispositivo ya envió a la campaña (0 si no tiene cookie). */
export async function aportesDelDispositivo(campanaId: number, dispositivo: string | null): Promise<number> {
  if (!dispositivo) return 0;
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM aportes WHERE campaign_id = $1 AND anonimo_id = $2`,
    [campanaId, hashDeDispositivo(dispositivo)]
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Segundos que le faltan a este dispositivo para poder enviar otro aporte (0 si ya puede).
 * Recibe el hash (aportes.anonimo_id). Se calcula en la BD para no depender del reloj de la app.
 */
export async function segundosDeEspera(
  anonimoId: string | null,
  client: Pick<PoolClient, "query"> = pool
): Promise<number> {
  if (!anonimoId) return 0;
  const { rows } = await client.query<{ faltan: number | null }>(
    `SELECT CEIL(EXTRACT(EPOCH FROM (MAX(submitted_at) + make_interval(secs => $2) - LOCALTIMESTAMP)))::int AS faltan
     FROM aportes WHERE anonimo_id = $1`,
    [anonimoId, ESPERA_ENTRE_APORTES_SEGUNDOS]
  );
  return Math.max(0, Number(rows[0]?.faltan ?? 0));
}

function mensajeDeEspera(segundos: number): string {
  return `Espera ${segundos} ${segundos === 1 ? "segundo" : "segundos"} antes de enviar otro aporte.`;
}

/** Para /c/[token]: segundos de espera del dispositivo de la cookie (0 si no tiene). */
export async function esperaDelDispositivo(dispositivo: string | null): Promise<number> {
  return segundosDeEspera(dispositivo ? hashDeDispositivo(dispositivo) : null);
}

/** Lo que ve /c/[token] para decidir si muestra el formulario. */
export async function bloqueoParaLaPagina(campanaId: number, dispositivo: string | null) {
  return bloqueoDelDispositivo({ campanaId, anonimoId: dispositivo ? hashDeDispositivo(dispositivo) : null });
}

export const MENSAJE_BLOQUEADO = "No puedes enviar aportes sin cuenta a esta campaña.";

export type ResultadoDeAporteAnonimo =
  | { ok: true; restantes: number; esperaSegundos: number; dispositivo: string; dispositivoNuevo: boolean }
  | { ok: false; status: number; error: string; esperaSegundos?: number };

export async function enviarAporteAnonimo(entrada: {
  token: string;
  dispositivo: string | null;
  ip: string;
  descripcion: string;
  caracteristicas: string[];
  archivo: FormDataEntryValue | null;
}): Promise<ResultadoDeAporteAnonimo> {
  const resultado = await buscarEnlacePorToken(entrada.token.toLowerCase());
  if (resultado.tipo === "inexistente") return { ok: false, status: 404, error: "Enlace no válido" };
  if (resultado.tipo !== "valido") return { ok: false, status: 410, error: "Este enlace ya no permite aportar" };
  const { campana, enlace } = resultado;
  if (campana.status === "pausada") return { ok: false, status: 409, error: "Quien organiza esta campaña la pausó; vuelve a intentarlo más tarde" };
  if (campana.status !== "activa") return { ok: false, status: 409, error: "Esta campaña ya no está recibiendo aportes" };
  if (!campana.permiteAnonimos) {
    return { ok: false, status: 403, error: "Esta campaña solo recibe aportes con cuenta." };
  }

  if (topeAlcanzado(entrada.ip)) {
    return { ok: false, status: 429, error: "Se enviaron demasiados aportes desde tu red. Intenta más tarde." };
  }

  const dispositivoNuevo = entrada.dispositivo === null;
  const dispositivo = entrada.dispositivo ?? randomBytes(32).toString("hex");
  const anonimoId = hashDeDispositivo(dispositivo);
  if (await bloqueoDelDispositivo({ campanaId: campana.id, anonimoId })) {
    return { ok: false, status: 403, error: MENSAJE_BLOQUEADO };
  }

  // Aviso rápido de la espera, antes de subir nada; la comprobación que cuenta va en la transacción.
  const faltan = await segundosDeEspera(anonimoId);
  if (faltan > 0) return { ok: false, status: 429, error: mensajeDeEspera(faltan), esperaSegundos: faltan };

  const descripcion = entrada.descripcion.trim();
  if (!descripcion) return { ok: false, status: 400, error: "La descripción es obligatoria" };
  if (descripcion.length > LARGO_MAXIMO_DESCRIPCION) {
    return { ok: false, status: 400, error: "La descripción no puede superar 1000 caracteres" };
  }
  const errorArchivo = errorDeArchivo(entrada.archivo, campana.tiposDeArchivo);
  if (errorArchivo) return { ok: false, status: 400, error: errorArchivo };

  // Aviso rápido antes de subir nada; la comprobación que cuenta va dentro de la transacción.
  const MENSAJE_CUOTA = "Ya enviaste todos los aportes que permite esta campaña";
  if ((await aportesDelDispositivo(campana.id, dispositivo)) >= campana.cuotaPorPersona) {
    return { ok: false, status: 400, error: MENSAJE_CUOTA };
  }

  // Sin cookie: espera por IP (en memoria). Se reserva aquí, ya validado el envío.
  if (dispositivoNuevo) {
    const faltanRed = reservarEsperaSinCookie(entrada.ip);
    if (faltanRed > 0) return { ok: false, status: 429, error: mensajeDeEspera(faltanRed), esperaSegundos: faltanRed };
  }

  // Solo respuestas que existen en los checklists de la campaña ("Título: opción").
  const caracteristicas = respuestasValidas(entrada.caracteristicas, campana.secciones);
  const subida = await guardarArchivoDelAporte(entrada.archivo, campana.id, campana.tiposDeArchivo);
  if (!subida.ok) return { ok: false, status: 400, error: subida.error };
  const { tipo, guardado } = subida.archivo;

  const insertado = await insertarAporteConCuota({
    campaignId: campana.id,
    persona: `dispositivo:${anonimoId}`,
    cuota: campana.cuotaPorPersona,
    archivoSubido: guardado?.relativePath ?? null,
    comprobar: async (client) => {
      // Candado por dispositivo (el de la cuota es por campaña): dos envíos simultáneos a
      // campañas distintas tampoco se saltan la espera.
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`espera:${anonimoId}`]);
      const segundos = await segundosDeEspera(anonimoId, client);
      return segundos > 0 ? { error: mensajeDeEspera(segundos), esperaSegundos: segundos } : null;
    },
    contar: async (client) => {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS n FROM aportes WHERE campaign_id = $1 AND anonimo_id = $2`,
        [campana.id, anonimoId]
      );
      return Number(rows[0]?.n ?? 0);
    },
    insertar: async (client) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO aportes (
          campaign_id, user_id, participant_name, participant_email, description,
          file_type, file_path, file_original_name, file_mime_type, file_size_bytes,
          caracteristicas, enlace_id, anonimo_id, consentimiento_en
        ) VALUES ($1, NULL, 'Anónimo', NULL, $2, $9, $3, NULL, $4, $5, $6::jsonb, $7, $8, NOW())
        RETURNING id`,
        // file_original_name va NULL: el nombre del archivo puede traer datos personales.
        // Sin archivo (solo texto): file_path '' y sin tipo MIME ni tamaño.
        [
          campana.id,
          descripcion,
          guardado?.relativePath ?? "",
          guardado?.mimeType ?? null,
          guardado?.sizeBytes ?? null,
          JSON.stringify(caracteristicas),
          enlace.id,
          anonimoId,
          tipo,
        ]
      );
      return rows[0].id;
    },
  });
  if (!insertado.ok) {
    return insertado.motivo === "espera"
      ? { ok: false, status: 429, error: insertado.error, esperaSegundos: insertado.esperaSegundos }
      : { ok: false, status: 400, error: MENSAJE_CUOTA };
  }
  contarEnvio(entrada.ip);

  // Sin IP: la persona anónima no deja su IP en ningún lado de la BD.
  await registrarAuditoria({
    actor: { tipo: "anonimo" },
    accion: "aporte.anonimo_enviar",
    objetivo: { tipo: "aporte", id: insertado.fila },
    detalle: { campanaId: campana.id, enlaceId: enlace.id },
    guardarIp: false,
  });

  return {
    ok: true,
    restantes: campana.cuotaPorPersona - insertado.yaEnviados - 1,
    esperaSegundos: ESPERA_ENTRE_APORTES_SEGUNDOS,
    dispositivo,
    dispositivoNuevo,
  };
}
