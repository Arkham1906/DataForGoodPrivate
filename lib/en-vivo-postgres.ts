// Cambios de contenido desde Postgres (2026-10-19): triggers en las tablas que se ven en pantalla
// mandan NOTIFY dfg_cambios con el nombre de la tabla, y una conexión propia con LISTEN los pasa a
// publicarCambio() (lib/en-vivo.ts). Así cualquier escritura (route handler, server action, tarea de
// cada minuto o un UPDATE a mano) actualiza las pantallas abiertas sin tocar cada acción.
//
// pg_notify junta los avisos iguales de una misma transacción: un UPDATE de 100 filas avisa una vez.
// Solo corre en Node (lo llama instrumentation-node.ts al arrancar).

import { Client } from "pg";
import { pool } from "@/lib/db";
import { publicarCambio } from "@/lib/en-vivo";

const CANAL = "dfg_cambios";

/** Tablas cuyo contenido se ve en alguna pantalla. No van las de sesiones, bitácora ni notificaciones. */
const TABLAS_CON_AVISO = [
  "campanas",
  "aportes",
  "campana_revisores",
  "campana_supervisores",
  "campana_inscripciones",
  "campana_baneados",
  "campana_enlaces",
  "campanas_guardadas",
  "sanciones",
  "reportes",
  "dispositivos_bloqueados",
  "lista_negra_correos",
  "tematicas",
  "medallas_usuario",
];

/**
 * Función y triggers que avisan de los cambios. En `usuarios` solo avisan los cambios que se ven
 * (nombre, rol, ubicación, ícono, XP, baja): no cada inicio de sesión ni cada código enviado.
 * Lo llama ensureCoreSchema() después de crear todas las tablas.
 */
export async function ensureAvisosDeCambios(): Promise<void> {
  await pool.query(`
    CREATE OR REPLACE FUNCTION dfg_avisar_cambio() RETURNS trigger AS $$
    BEGIN
      PERFORM pg_notify('${CANAL}', TG_TABLE_NAME);
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);
  for (const tabla of TABLAS_CON_AVISO) {
    await pool.query(
      `CREATE OR REPLACE TRIGGER dfg_avisar_cambio AFTER INSERT OR UPDATE OR DELETE ON ${tabla}
       FOR EACH ROW EXECUTE FUNCTION dfg_avisar_cambio()`,
    );
  }
  await pool.query(`
    CREATE OR REPLACE TRIGGER dfg_avisar_cambio AFTER INSERT OR DELETE ON usuarios
      FOR EACH ROW EXECUTE FUNCTION dfg_avisar_cambio();
    CREATE OR REPLACE TRIGGER dfg_avisar_cambio_visible AFTER UPDATE ON usuarios
      FOR EACH ROW WHEN (
        OLD.nombre IS DISTINCT FROM NEW.nombre OR OLD.apellidos IS DISTINCT FROM NEW.apellidos
        OR OLD.role IS DISTINCT FROM NEW.role OR OLD.state IS DISTINCT FROM NEW.state
        OR OLD.city IS DISTINCT FROM NEW.city OR OLD.avatar IS DISTINCT FROM NEW.avatar
        OR OLD.avatar_foto IS DISTINCT FROM NEW.avatar_foto OR OLD.xp_total IS DISTINCT FROM NEW.xp_total
        OR OLD.level IS DISTINCT FROM NEW.level OR OLD.email_verificado IS DISTINCT FROM NEW.email_verificado
        OR OLD.baja_solicitada_en IS DISTINCT FROM NEW.baja_solicitada_en OR OLD.eliminada_en IS DISTINCT FROM NEW.eliminada_en
      ) EXECUTE FUNCTION dfg_avisar_cambio();
  `);
}

/**
 * Abre la conexión con LISTEN y la mantiene: si se cae (Postgres reinició), reintenta a los 5 s.
 * La marca en globalThis evita dos conexiones si Next recarga el módulo en desarrollo.
 */
export function escucharCambiosDeLaBase(): void {
  const marca = globalThis as typeof globalThis & { __escuchaDeCambios?: boolean };
  if (marca.__escuchaDeCambios) return;
  marca.__escuchaDeCambios = true;

  const conectar = async () => {
    const cliente = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL });
    let reintentando = false;
    const reintentar = (error?: unknown) => {
      if (reintentando) return;
      reintentando = true;
      if (error) console.error("Se perdió la escucha de cambios de la base; reintentando en 5 s", error);
      cliente.end().catch(() => undefined);
      setTimeout(() => void conectar(), 5_000).unref();
    };
    cliente.on("notification", (mensaje) => {
      if (mensaje.channel === CANAL) publicarCambio(mensaje.payload ?? "");
    });
    cliente.on("error", reintentar);
    cliente.on("end", () => reintentar());
    try {
      await cliente.connect();
      await cliente.query(`LISTEN ${CANAL}`);
      // Lo que cambió mientras no se escuchaba: que las pantallas abiertas se pongan al día.
      publicarCambio("reconexion");
    } catch (error) {
      reintentar(error);
    }
  };
  void conectar();
}
