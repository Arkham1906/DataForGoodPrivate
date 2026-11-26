// Solo corre en el runtime de Node (lo importa instrumentation.ts). Está en
// su propio archivo porque Next también analiza instrumentation.ts para el
// runtime Edge, donde process.exit y `pg` no existen.
import { ensureCoreSchema } from "@/lib/db-schema";
import { problemasDeAppOrigin } from "@/lib/app-url";
import { ejecutarBajasVencidas } from "@/lib/usuarios/baja";
import { enviarAvisosPeriodicos } from "@/lib/notificaciones/periodicas";
import { activateScheduledCampaigns, finalizeExpiredCampaigns } from "@/lib/campaign-date";
import { escucharCambiosDeLaBase } from "@/lib/en-vivo-postgres";
import { marcarDatosPorDecidir } from "@/lib/supervision/datos-abiertos";
import { avisarRachas, revisarRachas } from "@/lib/gamificacion/racha";
import { repararRecompensasPendientes } from "@/lib/gamificacion/recompensas";
import { pool } from "@/lib/db";

const UNA_HORA_MS = 60 * 60 * 1000;
const UN_MINUTO_MS = 60 * 1000;

/** Claves de los candados de Postgres de cada tarea periódica (pg_try_advisory_lock). */
const CANDADOS = { campanas: 7_101, bajas: 7_102, avisos: 7_103, gamificacion: 7_104 } as const;

/**
 * Corre la tarea solo si esta instancia obtiene su candado de Postgres. Con varias instancias de la app, cada minuto la
 * corre una sola y las demás se la saltan; con una sola instancia no cambia nada. Si no hay base, no corre.
 */
async function conCandado(clave: number, tarea: () => Promise<unknown>): Promise<void> {
  const client = await pool.connect().catch(() => null);
  if (!client) return;
  try {
    const { rows } = await client.query<{ obtenido: boolean }>("SELECT pg_try_advisory_lock($1) AS obtenido", [clave]);
    if (!rows[0]?.obtenido) return;
    try {
      await tarea();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [clave]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

/**
 * Activa las campañas programadas (aceptada → activa) y finaliza las vencidas (activa → finalizada)
 * a su hora, sin esperar a que alguien abra una pantalla que lea /api/campanas. Antes solo
 * cambiaban en esas lecturas: una programada seguía "aceptada" pasada su hora de inicio y no
 * salía en /explorar ni en la landing (2026-10-16). Las lecturas siguen haciéndolo también.
 */
function programarEstadosDeCampanas(): void {
  const marca = globalThis as typeof globalThis & { __estadosDeCampanasProgramados?: boolean };
  if (marca.__estadosDeCampanasProgramados) return;
  marca.__estadosDeCampanasProgramados = true;

  const correr = () =>
    conCandado(CANDADOS.campanas, () =>
      activateScheduledCampaigns()
        .then(() => finalizeExpiredCampaigns())
        .then(() => marcarDatosPorDecidir()),
    ).catch((error) => console.error("Error al actualizar el estado de las campañas por fecha", error));
  void correr();
  setInterval(correr, UN_MINUTO_MS).unref();
}

/**
 * Borrado definitivo de las cuentas cuyo plazo de baja venció (lib/usuarios/baja.ts) y avisos
 * periódicos de Preferencias (lib/notificaciones/periodicas.ts). No hay cron en el servidor: corren
 * al arrancar y luego en este mismo proceso. Las bajas, cada minuto (desde el 2026-10-19 el plazo
 * es de 3 minutos: cada hora tardaría hasta una hora en borrarse); los avisos, cada hora.
 * La marca en globalThis evita dos temporizadores si Next recarga el módulo en desarrollo.
 */
function programarBajasVencidas(): void {
  const marca = globalThis as typeof globalThis & { __bajasProgramadas?: boolean };
  if (marca.__bajasProgramadas) return;
  marca.__bajasProgramadas = true;

  const bajas = () =>
    conCandado(CANDADOS.bajas, ejecutarBajasVencidas).catch((error) => console.error("Error al ejecutar las bajas de cuenta vencidas", error));
  const avisos = () =>
    conCandado(CANDADOS.avisos, enviarAvisosPeriodicos).catch((error) => console.error("Error al enviar los avisos periódicos", error));
  void bajas().then(avisos);
  setInterval(bajas, UN_MINUTO_MS).unref();
  setInterval(avisos, UNA_HORA_MS).unref();
}

/**
 * Lo que la gamificación hace sola, cada minuto: la racha que cambia con el paso del tiempo (los días sin aportes,
 * lib/gamificacion/racha.ts), los avisos para cuidar o empezar la racha (desde las 16:00, uno por día) y las
 * recompensas de aportes aceptados que quedaron sin dar por un fallo (lib/gamificacion/recompensas.ts, RNF-GAM-08).
 */
function programarRachas(): void {
  const marca = globalThis as typeof globalThis & { __rachasProgramadas?: boolean };
  if (marca.__rachasProgramadas) return;
  marca.__rachasProgramadas = true;

  // Primero la racha (una rota ayer queda en 0), después los avisos de las 16:00 y las recompensas pendientes.
  const correr = () =>
    conCandado(CANDADOS.gamificacion, () => revisarRachas().then(() => avisarRachas()).then(repararRecompensasPendientes)).catch((error) =>
      console.error("Error en las tareas periódicas de gamificación", error),
    );
  void correr();
  setInterval(correr, UN_MINUTO_MS).unref();
}

export async function crearEsquemaAlArrancar(): Promise<void> {
  // APP_ORIGIN mal puesta no tumba la app, pero rompe enlaces, redirecciones, Google y las
  // mutaciones detrás de un proxy: se avisa al arrancar (2026-11-20, lib/app-url.ts).
  for (const problema of problemasDeAppOrigin()) console.error(`Configuración: ${problema}`);

  // Falta de configuración: reintentar no sirve de nada, así que se avisa
  // de inmediato (antes esperaba 30 intentos para decir lo mismo).
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error(
      "Falta DATABASE_URL en el entorno. Levanta la app con `docker compose up -d` " +
        "(que la arma desde .env) o pásala con `docker run --env-file .env ...`.",
    );
    if (process.env.NODE_ENV === "production") process.exit(1);
    return;
  }

  // Postgres puede tardar en aceptar conexiones justo al levantar el stack.
  const INTENTOS = 30;
  for (let intento = 1; ; intento++) {
    try {
      await ensureCoreSchema();
      programarBajasVencidas();
      programarEstadosDeCampanas();
      programarRachas();
      escucharCambiosDeLaBase();
      return;
    } catch (error) {
      if (intento >= INTENTOS) {
        console.error("No se pudo crear el esquema de la base de datos:", error);
        // En producción, que el contenedor se reinicie (restart: always) en
        // vez de quedar arriba sin esquema. En desarrollo se deja seguir para
        // ver el error en pantalla.
        if (process.env.NODE_ENV === "production") process.exit(1);
        return;
      }
      console.warn(`Base de datos no disponible (intento ${intento}/${INTENTOS}), reintentando...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
