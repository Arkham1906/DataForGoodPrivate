// Aporte de una persona SIN cuenta: desde el enlace público de una campaña (/c/[token]) o, desde el
// 2026-11-11, desde su ficha (/participa/[id], sin enlace). Lo llaman POST /api/c/[token]/aportes y
// POST /api/campanas/[id]/aporte-sin-cuenta (enviar), y esas dos páginas (cuántos le quedan).
//
// Reglas (decididas el 2026-10-01, dominio.md § 6 y puntos abiertos 7 y 18):
//   - Solo en una campaña ACTIVA que permita aportes sin cuenta (campanas.permite_anonimos), con un
//     enlace VIGENTE (/c/[token]) o desde su ficha pública (/participa/[id]). La persona anónima no ve
//     ni toca nada más del sistema.
//   - El aporte no lleva datos personales: user_id NULL, participante "Anónimo", sin correo,
//     sin nombre de archivo, y fotos y documentos sin metadatos (lib/aportes/limpiar-archivo.ts;
//     video y audio se guardan tal cual).
//   - Cuota por dispositivo: UN aporte por campaña (APORTES_SIN_CUENTA_POR_CAMPANA, 2026-11-09, a
//     pedido del usuario; antes era la misma cuota por persona de la campaña). Para enviar más hay
//     que crear una cuenta o iniciar sesión. Se cuenta por una cookie anónima
//     (lib/aportes/anonimato.ts). En la BD solo va su sha256 (aportes.anonimo_id).
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
import {
  LARGO_MAXIMO_DESCRIPCION,
  archivoDelTexto,
  errorDeArchivo,
  guardarArchivoDelAporte,
  insertarAporteConCuota,
  tiposConLugarParaElAporte,
  tiposDentroDeLaCuotaParaElAporte,
  aportesDeLaPersonaPorTipo,
} from "@/lib/aportes/comun";
import { hashDeDispositivo } from "@/lib/aportes/anonimato";
import { registrarArchivo } from "@/lib/aportes/tabla-archivos";
import { guardarRespuestas } from "@/lib/campanas/tabla-checklists";
import { bloqueoDelDispositivo } from "@/lib/aportes/sanciones-anonimas";
import { registrarAuditoria } from "@/lib/auditoria";
import { respuestasValidas, seccionesDelTipo } from "@/lib/campanas/checklist";
import { buscarCampanaParaAportarSinCuenta, buscarEnlacePorToken, type CampanaDelEnlace } from "@/lib/campanas/enlaces";
import { avisoDePausa } from "@/lib/campanas/pausa";

// TODO(dominio): valor elegido sin consulta. Aportes anónimos por IP en una hora, sumando
// todas las campañas. Holgado para varias personas en la misma red (escuela, oficina).
export const TOPE_POR_IP_POR_HORA = 20;
const VENTANA_MS = 60 * 60 * 1000;

// TODO(dominio): valor elegido sin consulta (2026-10-01). Segundos mínimos entre dos aportes
// sin cuenta del mismo dispositivo, en cualquier campaña.
export const ESPERA_ENTRE_APORTES_SEGUNDOS = 60;

// Tope de aportes sin cuenta por campaña (2026-11-10): el 10% de la meta, redondeado hacia abajo.
// No limita los aportes con cuenta. Esta es la única copia de la regla y de su mensaje.
const PORCENTAJE_MAXIMO_DE_APORTES_ANONIMOS = 0.1;
// Sin la invitación a la cuenta: /c/[token] y la ficha la ponen debajo, con sus botones.
const AVISO_TOPE_ANONIMO_LLENO = "Esta campaña alcanzó su límite de aportes anónimos (10% de la meta).";
const MENSAJE_LIMITE_ANONIMOS = `${AVISO_TOPE_ANONIMO_LLENO} Aún puedes aportar con una cuenta.`;

/** Tope de aportes anónimos para la campaña; no limita aportes enviados con cuenta. */
function limiteDeAportesAnonimos(meta: number): number {
  return Math.floor(meta * PORCENTAJE_MAXIMO_DE_APORTES_ANONIMOS);
}

/**
 * Lugares ocupados del tope: los anónimos aceptados y los que esperan revisión (decisión del
 * usuario, 2026-11-10). Solo un rechazo libera el lugar. Como el pendiente ya ocupa su lugar al
 * enviarse, aceptarlo no cambia la cuenta y la revisión no vuelve a comprobar el tope.
 */
async function contarAportesAnonimos(
  campanaId: number,
  client: Pick<PoolClient, "query"> = pool,
): Promise<number> {
  const { rows } = await client.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
       FROM aportes
      WHERE campaign_id = $1 AND user_id IS NULL AND anonimo_id IS NOT NULL AND status <> 'rechazado'`,
    [campanaId],
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * El aviso del tope si ya no cabe otro aporte anónimo, o null si cabe. Lo usan /c/[token] (en vez del
 * formulario) y la ficha /campanas/[id] sin sesión (en vez de "Aportar sin cuenta"), para que nadie llene
 * el formulario y suba el archivo para enterarse al enviar (2026-11-11, a pedido del usuario).
 */
export async function avisoDeTopeAnonimoLleno(campanaId: number, meta: number): Promise<string | null> {
  return (await contarAportesAnonimos(campanaId)) >= limiteDeAportesAnonimos(meta) ? AVISO_TOPE_ANONIMO_LLENO : null;
}

/**
 * Aportes sin cuenta que un dispositivo puede enviar a cada campaña (2026-11-09, decisión del usuario:
 * uno por campaña; el siguiente pide registrarse). Si la cuota por persona de la campaña es menor, manda esa.
 */
export const APORTES_SIN_CUENTA_POR_CAMPANA = 1;

/** Cuántos aportes sin cuenta acepta la campaña por dispositivo. */
export function cuotaSinCuenta(cuotaPorPersona: number): number {
  return Math.max(0, Math.min(APORTES_SIN_CUENTA_POR_CAMPANA, cuotaPorPersona));
}

export const MENSAJE_CUOTA_SIN_CUENTA =
  "Ya enviaste tu aporte sin cuenta a esta campaña. Para enviar más, crea una cuenta o inicia sesión.";

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
  | { ok: false; status: number; error: string; esperaSegundos?: number; pideCuenta?: boolean };

/**
 * De dónde viene: el enlace del creador (/c/[token]; el aporte guarda enlace_id) o la ficha de la
 * campaña (/participa/[id], 2026-11-11; sin enlace_id: no cuenta como aporte recibido por el enlace).
 */
export type OrigenDelAporteAnonimo = { token: string } | { campanaId: number };

async function campanaDelOrigen(
  origen: OrigenDelAporteAnonimo,
): Promise<{ campana: CampanaDelEnlace; enlaceId: number | null } | { ok: false; status: number; error: string }> {
  if ("campanaId" in origen) {
    const campana = await buscarCampanaParaAportarSinCuenta(origen.campanaId);
    return campana ? { campana, enlaceId: null } : { ok: false, status: 404, error: "Campaña no encontrada" };
  }
  const resultado = await buscarEnlacePorToken(origen.token.toLowerCase());
  if (resultado.tipo === "inexistente") return { ok: false, status: 404, error: "Enlace no válido" };
  if (resultado.tipo !== "valido") return { ok: false, status: 410, error: "Este enlace ya no permite aportar" };
  return { campana: resultado.campana, enlaceId: resultado.enlace.id };
}

export async function enviarAporteAnonimo(entrada: {
  origen: OrigenDelAporteAnonimo;
  dispositivo: string | null;
  ip: string;
  descripcion: string;
  /** Solo texto (2026-11-11): el texto, que se guarda como .txt; `descripcion` es su título. */
  texto?: string;
  caracteristicas: string[];
  archivo: FormDataEntryValue | null;
}): Promise<ResultadoDeAporteAnonimo> {
  const delOrigen = await campanaDelOrigen(entrada.origen);
  if ("ok" in delOrigen) return delOrigen;
  const { campana, enlaceId } = delOrigen;
  if (campana.status === "pausada") return { ok: false, status: 409, error: avisoDePausa(campana.pausa, "Vuelve a intentarlo más tarde.") };
  if (campana.status !== "activa") return { ok: false, status: 409, error: "Esta campaña ya no está recibiendo aportes" };
  if (!campana.permiteAnonimos) {
    return { ok: false, status: 403, error: "Esta campaña solo recibe aportes con cuenta." };
  }
  // Aviso rápido antes de subir nada; la comprobación que cuenta va dentro de la transacción.
  if ((await contarAportesAnonimos(campana.id)) >= limiteDeAportesAnonimos(campana.meta)) {
    return { ok: false, status: 400, error: MENSAJE_LIMITE_ANONIMOS };
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

  // Aviso rápido antes de subir nada; la comprobación que cuenta va dentro de la transacción. Antes que la
  // espera: si ya usó su aporte sin cuenta en esta campaña, lo que toca es pedirle la cuenta, no que espere.
  const cuota = cuotaSinCuenta(campana.cuotaPorPersona);
  if ((await aportesDelDispositivo(campana.id, dispositivo)) >= cuota) {
    return { ok: false, status: 403, error: MENSAJE_CUOTA_SIN_CUENTA, pideCuenta: true };
  }

  // Aviso rápido de la espera, antes de subir nada; la comprobación que cuenta va en la transacción.
  const faltan = await segundosDeEspera(anonimoId);
  if (faltan > 0) return { ok: false, status: 429, error: mensajeDeEspera(faltan), esperaSegundos: faltan };

  const descripcion = entrada.descripcion.trim();
  if (!descripcion) return { ok: false, status: 400, error: "La descripción es obligatoria" };
  if (descripcion.length > LARGO_MAXIMO_DESCRIPCION) {
    return { ok: false, status: 400, error: "La descripción no puede superar 1000 caracteres" };
  }
  // Solo texto (2026-11-11): el texto se vuelve un .txt y sigue el camino de un archivo subido.
  const conTexto = archivoDelTexto(entrada.archivo, { texto: entrada.texto ?? "", titulo: descripcion, tipos: campana.tiposDeArchivo });
  if (!conTexto.ok) return { ok: false, status: 400, error: conTexto.error };
  const archivo = conTexto.archivo;
  const errorArchivo = errorDeArchivo(archivo, campana.tiposDeArchivo, campana.formatosDeDocumento);
  if (errorArchivo) return { ok: false, status: 400, error: errorArchivo };
  // Límite total por tipo de dato (2026-10-28): aviso antes de subir; solo se aceptan los tipos con lugar.
  const conLugar = tiposConLugarParaElAporte(archivo, campana.tiposDeArchivo, campana.limitePorTipo, campana.enviadosPorTipo);
  if (!conLugar.ok) return { ok: false, status: 400, error: conLugar.error };

  // Sin cookie: espera por IP (en memoria). Se reserva aquí, ya validado el envío.
  if (dispositivoNuevo) {
    const faltanRed = reservarEsperaSinCookie(entrada.ip);
    if (faltanRed > 0) return { ok: false, status: 429, error: mensajeDeEspera(faltanRed), esperaSegundos: faltanRed };
  }

  // Tope por persona de cada tipo (2026-10-31), contado por dispositivo como la cuota general.
  const dentroDeSuCuota = tiposDentroDeLaCuotaParaElAporte(
    archivo,
    conLugar.tipos,
    campana.tiposDeArchivo,
    campana.cuotaPorTipo,
    await aportesDeLaPersonaPorTipo(campana.id, { anonimoId }),
  );
  if (!dentroDeSuCuota.ok) return { ok: false, status: 400, error: dentroDeSuCuota.error };

  const subida = await guardarArchivoDelAporte(archivo, campana.id, dentroDeSuCuota.tipos, campana.formatosDeDocumento);
  if (!subida.ok) return { ok: false, status: 400, error: subida.error };
  const { tipo, guardado } = subida.archivo;
  // Solo respuestas de los checklists del tipo real del archivo ("Título: opción"; 2026-10-28).
  const caracteristicas = respuestasValidas(entrada.caracteristicas, seccionesDelTipo(campana.secciones, tipo));

  const insertado = await insertarAporteConCuota({
    campaignId: campana.id,
    persona: `dispositivo:${anonimoId}`,
    tipo,
    cuota,
    limiteAnonimos: limiteDeAportesAnonimos,
    contarAnonimos: (client) => contarAportesAnonimos(campana.id, client),
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
    contarDelTipo: async (client) => (await aportesDeLaPersonaPorTipo(campana.id, { anonimoId }, client))[tipo] ?? 0,
    insertar: async (client) => {
      // El archivo va a la tabla archivos (2026-10-30), sin nombre original: puede traer datos
      // personales. Sin archivo (solo texto): archivo_id NULL.
      const archivoId = await registrarArchivo(client, guardado);
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO aportes (
          campaign_id, user_id, participant_name, participant_email, description,
          file_type, archivo_id, enlace_id, anonimo_id, consentimiento_en
        ) VALUES ($1, NULL, 'Anónimo', NULL, $2, $6, $3, $4, $5, NOW())
        RETURNING id`,
        [
          campana.id,
          descripcion,
          archivoId,
          enlaceId,
          anonimoId,
          tipo,
        ]
      );
      // Lo que marcó en los checklists (tabla aporte_respuestas, 2026-10-30).
      await guardarRespuestas(client, { id: rows[0].id, campanaId: campana.id, tipo }, caracteristicas);
      return rows[0].id;
    },
  });
  if (!insertado.ok) {
    if (insertado.motivo === "limite_anonimos") {
      return { ok: false, status: 400, error: MENSAJE_LIMITE_ANONIMOS };
    }
    if (insertado.motivo === "espera") {
      return { ok: false, status: 429, error: insertado.error, esperaSegundos: insertado.esperaSegundos };
    }
    if (insertado.motivo === "tipo_lleno" || insertado.motivo === "cuota_del_tipo") return { ok: false, status: 400, error: insertado.error };
    return {
      ok: false,
      status: 403,
      error: MENSAJE_CUOTA_SIN_CUENTA,
      pideCuenta: true,
    };
  }
  contarEnvio(entrada.ip);

  // Sin IP: la persona anónima no deja su IP en ningún lado de la BD.
  await registrarAuditoria({
    actor: { tipo: "anonimo" },
    accion: "aporte.anonimo_enviar",
    objetivo: { tipo: "aporte", id: insertado.fila },
    detalle: { campanaId: campana.id, enlaceId, desde: enlaceId === null ? "ficha" : "enlace" },
    guardarIp: false,
  });

  return {
    ok: true,
    restantes: Math.max(0, cuota - insertado.yaEnviados - 1),
    esperaSegundos: ESPERA_ENTRE_APORTES_SEGUNDOS,
    dispositivo,
    dispositivoNuevo,
  };
}
