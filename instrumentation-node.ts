// Solo corre en el runtime de Node (lo importa instrumentation.ts). Está en
// su propio archivo porque Next también analiza instrumentation.ts para el
// runtime Edge, donde process.exit y `pg` no existen.
import { ensureCoreSchema } from "@/lib/db-schema";
import { ejecutarBajasVencidas } from "@/lib/usuarios/baja";
import { enviarAvisosPeriodicos } from "@/lib/notificaciones/periodicas";
import { activateScheduledCampaigns, finalizeExpiredCampaigns } from "@/lib/campaign-date";
import { escucharCambiosDeLaBase } from "@/lib/en-vivo-postgres";

const UNA_HORA_MS = 60 * 60 * 1000;
const UN_MINUTO_MS = 60 * 1000;

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
    activateScheduledCampaigns()
      .then(() => finalizeExpiredCampaigns())
      .catch((error) => console.error("Error al actualizar el estado de las campañas por fecha", error));
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
    ejecutarBajasVencidas().catch((error) => console.error("Error al ejecutar las bajas de cuenta vencidas", error));
  const avisos = () => enviarAvisosPeriodicos();
  void bajas().then(avisos);
  setInterval(bajas, UN_MINUTO_MS).unref();
  setInterval(avisos, UNA_HORA_MS).unref();
}

export async function crearEsquemaAlArrancar(): Promise<void> {
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
