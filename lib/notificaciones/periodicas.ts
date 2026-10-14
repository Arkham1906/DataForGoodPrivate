// Avisos periódicos de Preferencias (2026-10-14, decisiones del usuario; dominio.md § 11):
//   - recordatorio_semanal ("Recordatorios", apagado por defecto): los lunes desde las 9:00 de
//     Tepic, si a la persona le falta cuota en campañas activas donde ya aportó, o que guardó y
//     cierran en 7 días o menos. Sin nada pendiente no se manda.
//   - resumen_mensual ("Newsletter", encendido por defecto): el día 1 desde las 9:00, lo del mes
//     anterior: sus aportes aceptados, campañas nuevas de sus temáticas en su zona y conjuntos de
//     datos abiertos publicados. Si todo es cero no se manda.
// No hay cron: instrumentation-node.ts llama a enviarAvisosPeriodicos() al arrancar y cada hora.
// usuarios.ultimo_recordatorio / ultimo_resumen guardan el periodo ya enviado; se marcan con un
// UPDATE ... RETURNING antes de enviar, así cada persona recibe uno por periodo aunque la tarea
// corra dos veces. Si el servidor estuvo apagado, el recordatorio sale en cuanto arranca (esa
// semana) y el resumen solo hasta el día 3 (después ya no tiene sentido).

import { pool } from "@/lib/db";
import { SQL_SANCION_BLOQUEANTE } from "@/lib/sanciones";
import { ZONA_DE_CAMPANAS, ahoraEnZona } from "@/lib/campaign-date";
import { fechaCorta } from "@/lib/campanas/especial-reglas";
import { coincideConPersona } from "./campanas-por-interes";
import { notificar } from "./notificaciones";

const HORA_DE_ENVIO = 9;
const ULTIMO_DIA_DEL_RESUMEN = 3;
const CAMPANAS_EN_EL_RECORDATORIO = 3;
const TAMANO_DE_TANDA = 10;

/** Cuentas que pueden recibir avisos: verificadas, sin baja y sin bloqueo (alias `u`). */
const CUENTA_ACTIVA = `u.email_verificado AND u.eliminada_en IS NULL AND u.baja_solicitada_en IS NULL AND NOT ${SQL_SANCION_BLOQUEANTE}`;

function fecha(y: number, m: number, d: number): string {
  const v = new Date(Date.UTC(y, m - 1, d));
  return v.toISOString().slice(0, 10);
}

/** Lunes (YYYY-MM-DD) de la semana cuyo recordatorio ya toca: antes del lunes 9:00, el de la anterior. */
export function semanaDelRecordatorio(a = ahoraEnZona()): string {
  const hoy = new Date(Date.UTC(a.year, a.month - 1, a.day));
  let desdeElLunes = (hoy.getUTCDay() + 6) % 7;
  if (desdeElLunes === 0 && a.hour < HORA_DE_ENVIO) desdeElLunes = 7;
  return fecha(a.year, a.month, a.day - desdeElLunes);
}

/** Mes del resumen que toca enviar ahora ({ periodo: día 1 de este mes, inicio: día 1 del anterior }), o null. */
export function mesDelResumen(a = ahoraEnZona()): { periodo: string; inicio: string; nombre: string } | null {
  if (a.day > ULTIMO_DIA_DEL_RESUMEN || (a.day === 1 && a.hour < HORA_DE_ENVIO)) return null;
  const nombre = new Date(Date.UTC(a.year, a.month - 2, 1)).toLocaleDateString("es-MX", { month: "long", timeZone: "UTC" });
  return { periodo: fecha(a.year, a.month, 1), inicio: fecha(a.year, a.month - 1, 1), nombre };
}

async function enTandas<T>(lista: T[], enviar: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < lista.length; i += TAMANO_DE_TANDA) {
    await Promise.all(lista.slice(i, i + TAMANO_DE_TANDA).map(enviar));
  }
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function enLista(partes: string[]): string {
  return partes.length <= 1 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

async function enviarRecordatorios(): Promise<void> {
  const semana = semanaDelRecordatorio();
  const a = ahoraEnZona();
  const enUnaSemana = fecha(a.year, a.month, a.day + 7);
  const { rows: personas } = await pool.query<{ id: number }>(
    `UPDATE usuarios u SET ultimo_recordatorio = $1
      WHERE u.recordatorio_semanal AND ${CUENTA_ACTIVA}
        AND u.ultimo_recordatorio IS DISTINCT FROM $1::date
      RETURNING u.id`,
    [semana],
  );

  await enTandas(personas, async ({ id }) => {
    const { rows } = await pool.query<{ id: number; name: string; faltan: number; end_date: Date | string | null }>(
      `SELECT c.id, c.name, (c.quota_per_user - COUNT(a.id))::int AS faltan, c.end_date
         FROM campanas c
         LEFT JOIN aportes a ON a.campaign_id = c.id AND a.user_id = $1
        WHERE c.status = 'activa' AND c.creator_id <> $1
          AND NOT EXISTS (SELECT 1 FROM campana_baneados b WHERE b.campana_id = c.id AND b.usuario_id = $1)
          AND (EXISTS (SELECT 1 FROM aportes x WHERE x.campaign_id = c.id AND x.user_id = $1)
               OR (EXISTS (SELECT 1 FROM campanas_guardadas g WHERE g.campana_id = c.id AND g.usuario_id = $1)
                   AND c.end_date <= $2::date))
        GROUP BY c.id
        HAVING COUNT(a.id) < c.quota_per_user
        ORDER BY c.end_date ASC NULLS LAST
        LIMIT $3`,
      [id, enUnaSemana, CAMPANAS_EN_EL_RECORDATORIO],
    );
    if (rows.length === 0) return;

    const renglones = rows.map((c) => {
      const cierre = c.end_date ? ` (cierra el ${fechaCorta(normalizar(c.end_date))})` : "";
      return `te ${c.faltan === 1 ? "falta" : "faltan"} ${plural(c.faltan, "aporte", "aportes")} en "${c.name}"${cierre}`;
    });
    const texto = renglones.join("; ");
    await notificar({
      usuarioId: id,
      tipo: "recordatorio_semanal",
      titulo: rows.length === 1 ? "Te faltan aportes" : "Tienes campañas por completar",
      mensaje: `${texto[0].toUpperCase()}${texto.slice(1)}.`,
      campanaId: rows.length === 1 ? rows[0].id : null,
      enlace: rows.length === 1 ? `/campanas/${rows[0].id}` : "/mis-aportes",
      metadata: { semana },
    });
  });
}

/** DATE de pg (Date a medianoche local o texto) a "YYYY-MM-DD". */
function normalizar(valor: Date | string): string {
  if (typeof valor === "string") return valor.slice(0, 10);
  return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}-${String(valor.getDate()).padStart(2, "0")}`;
}

async function enviarResumenes(): Promise<void> {
  const mes = mesDelResumen();
  if (!mes) return;
  const { rows: personas } = await pool.query<{ id: number; intereses: unknown; state: string | null; city: string | null }>(
    `UPDATE usuarios u SET ultimo_resumen = $1
      WHERE u.resumen_mensual AND ${CUENTA_ACTIVA}
        AND u.ultimo_resumen IS DISTINCT FROM $1::date
      RETURNING u.id, u.intereses, u.state, u.city`,
    [mes.periodo],
  );
  if (personas.length === 0) return;

  // Lo de toda la plataforma se lee una vez. Las fechas de campaña son días de Tepic.
  const [campanas, datos] = await Promise.all([
    pool.query<{ creator_id: number; tematica: string; location_state: string; location_city: string }>(
      `SELECT creator_id, tematica, location_state, location_city FROM campanas
        WHERE status IN ('activa', 'pausada', 'finalizada') AND start_date >= $1::date AND start_date < $2::date`,
      [mes.inicio, mes.periodo],
    ),
    pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM campanas WHERE status = 'finalizada' AND end_date >= $1::date AND end_date < $2::date`,
      [mes.inicio, mes.periodo],
    ),
  ]);
  const conjuntos = datos.rows[0]?.n ?? 0;

  await enTandas(personas, async (persona) => {
    // reviewed_at es TIMESTAMP en UTC: el mes de Tepic se pasa a UTC para comparar.
    const aceptados = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM aportes
        WHERE user_id = $1 AND status = 'aceptado'
          AND reviewed_at >= (($2::timestamp AT TIME ZONE $4) AT TIME ZONE 'UTC')
          AND reviewed_at < (($3::timestamp AT TIME ZONE $4) AT TIME ZONE 'UTC')`,
      [persona.id, mes.inicio, mes.periodo, ZONA_DE_CAMPANAS],
    );
    const misAceptados = aceptados.rows[0]?.n ?? 0;
    const deMiZona = campanas.rows.filter((c) => Number(c.creator_id) !== Number(persona.id) && coincideConPersona(c, persona)).length;
    if (misAceptados === 0 && deMiZona === 0 && conjuntos === 0) return;

    const partes: string[] = [];
    if (misAceptados > 0) partes.push(`te aceptaron ${plural(misAceptados, "aporte", "aportes")}`);
    if (deMiZona > 0) partes.push(`${deMiZona === 1 ? "salió" : "salieron"} ${plural(deMiZona, "campaña", "campañas")} de tus temáticas en tu zona`);
    if (conjuntos > 0) partes.push(`se ${conjuntos === 1 ? "publicó" : "publicaron"} ${plural(conjuntos, "conjunto", "conjuntos")} de datos abiertos`);
    await notificar({
      usuarioId: persona.id,
      tipo: "resumen_mensual",
      titulo: `Tu resumen de ${mes.nombre}`,
      mensaje: `En ${mes.nombre} ${enLista(partes)}.`,
      enlace: conjuntos > 0 && misAceptados === 0 && deMiZona === 0 ? "/datos" : "/campanas",
      metadata: { mes: mes.inicio },
    });
  });
}

/** Lo llama instrumentation-node.ts al arrancar y cada hora. Nunca lanza. */
export async function enviarAvisosPeriodicos(): Promise<void> {
  const marca = globalThis as typeof globalThis & { __avisosPeriodicosCorriendo?: boolean };
  if (marca.__avisosPeriodicosCorriendo) return;
  marca.__avisosPeriodicosCorriendo = true;
  try {
    await enviarRecordatorios().catch((error) => console.error("Error enviando los recordatorios semanales", error));
    await enviarResumenes().catch((error) => console.error("Error enviando los resúmenes mensuales", error));
  } finally {
    marca.__avisosPeriodicosCorriendo = false;
  }
}
