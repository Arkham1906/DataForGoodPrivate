// Datos del Resumen de /progreso y del calendario de racha (2026-11-04; diseño v10, SRS v1.2). Solo lectura y solo de
// la persona con sesión. Lo común con /inicio sigue en obtenerResumenDeProgreso() (./progreso.ts); esto agrega las
// fichas de los 20 rangos, el camino, la distribución de calificaciones, las medallas y el calendario.
//
// Esta función NO calcula ni concede nada (RNF-GAM-06): lee lo guardado. Mientras no exista el proceso que otorga EXP,
// rangos y rachas, esas tablas siguen en sus valores iniciales. La distribución de calificaciones es la excepción: sale
// de aportes.calificacion, que ya se guarda al revisar, así que puede mostrar aportes que el rango aún no cuenta.
//
// Visibilidad (RF-GAM-78, RNF-GAM-14): la consulta lee el catálogo, pero de un rango avistado o por descubrir solo
// salen el número y los requisitos: fichas y eslabones se arman aquí, con tipos que no admiten más.

import { pool } from "@/lib/db";
import { NOMBRES_DE_ESTRELLAS, calificacionDesde, type CalificacionDeAporte } from "@/lib/aportes/calificacion";
import { ZONA_DE_CAMPANAS, hoyEnTepic } from "@/lib/fecha-de-tepic";
import { medallasMasCercanas, type MedallaConAvance, type NivelDeMedalla } from "./medallas";
import { RANGOS_EN_EL_CAMINO } from "./mi-progreso-tipos";
import type {
  AporteDelDia,
  CalendarioDeRachaDelMes,
  CaminoDeRangos,
  DatosDeResumen,
  DiaDelCalendario,
  EventoDeRacha,
  ResumenDeCalificaciones,
} from "./mi-progreso-tipos";
import { requisitosDe, type FilaDeRango } from "./progreso";
import type { EstadoDeDiaDeRacha, ResumenDeProgreso } from "./progreso-tipos";
import {
  estadoDeRango,
  fechaCortaDeAscenso,
  nombreCortoDeRango,
  requisitosDeRango,
  textoDeAscenso,
  type FichaDeRango,
} from "./rangos";

const MEDALLAS_CERCA = 3;
const ESTRELLAS: readonly CalificacionDeAporte[] = [5, 4, 3, 2, 1];
const ESTADOS_DE_DIA = new Set<string>(["confirmado", "provisional", "protegido", "sin_actividad", "suspendido"]);

/** Las mismas palabras que /mis-aportes e /inicio. */
const ESTADO_DE_APORTE: Record<string, Pick<AporteDelDia, "estado" | "tono">> = {
  pendiente: { estado: "En revisión", tono: "warn" },
  espera_final: { estado: "En revisión", tono: "warn" },
  aceptado: { estado: "Aceptado", tono: "ok" },
  rechazado: { estado: "Rechazado", tono: "danger" },
};

const TEXTO_DE_EVENTO: Record<string, string> = {
  protector_consumido: "Protector consumido.",
  protector_devuelto: "Protector devuelto.",
  dia_consolidado: "Día consolidado a las 72 horas.",
  dia_descartado: "Día descartado por el rechazo de un aporte pendiente.",
  racha_interrumpida: "Racha interrumpida.",
};

/** Una ficha por rango: los alcanzados se completan aquí; actual, siguiente y avistado ya vienen armadas. */
function fichasDeLaTrayectoria(
  rangos: FilaDeRango[],
  actual: number,
  ascenso: (rango: number) => Date | null,
  armadas: FichaDeRango[],
): FichaDeRango[] {
  const fichas: FichaDeRango[] = [];
  for (const r of rangos) {
    const estado = estadoDeRango(r.numero, actual);
    const requisitos = requisitosDeRango(requisitosDe(r));
    if (estado === "alcanzado") {
      fichas.push({
        estado,
        numero: r.numero,
        nombre: r.nombre,
        descripcion: r.descripcion,
        etapaDelAvatar: r.etapa_avatar ?? r.numero,
        requisitos,
        textoDeAscenso: textoDeAscenso(r.numero, ascenso(r.numero), ascenso(r.numero - 1)),
      });
    } else if (estado === "oculto") {
      fichas.push({ estado, numero: r.numero, requisitos });
    } else {
      const armada = armadas.find((f) => f.numero === r.numero);
      if (armada) fichas.push(armada);
    }
  }
  return fichas;
}

function caminoDeRangos(
  rangos: FilaDeRango[],
  progreso: ResumenDeProgreso,
  ascenso: (rango: number) => Date | null,
): CaminoDeRangos {
  const actual = progreso.rangoActual;
  const total = progreso.totalDeRangos;
  const primero = Math.max(1, Math.min(actual - 2, total - RANGOS_EN_EL_CAMINO + 1));
  const ultimo = Math.min(total, primero + RANGOS_EN_EL_CAMINO - 1);
  const eslabones = rangos
    .filter((r) => r.numero >= primero && r.numero <= ultimo)
    .map((r) => {
      const estado = estadoDeRango(r.numero, actual);
      const visible = estado === "alcanzado" || estado === "actual" || estado === "siguiente";
      const detalle =
        estado === "alcanzado"
          ? fechaCortaDeAscenso(ascenso(r.numero)) || "Alcanzado"
          : estado === "actual"
            ? "Tu rango"
            : estado === "siguiente"
              ? `${progreso.siguiente?.cumplidos ?? 0} de ${progreso.siguiente?.activos ?? 0}`
              : estado === "avistado"
                ? "Avistado"
                : "Por descubrir";
      return { numero: r.numero, estado, nombreCorto: visible ? nombreCortoDeRango(r.nombre) : null, detalle };
    });
  return { eslabones, antes: primero - 1, despues: total - ultimo };
}

function resumenDeCalificaciones(filas: { calificacion: number | null; cuenta: number }[]): ResumenDeCalificaciones {
  const cuentas: Record<CalificacionDeAporte, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sinCalificacion = 0;
  for (const f of filas) {
    const estrellas = calificacionDesde(f.calificacion);
    if (estrellas === null) sinCalificacion += f.cuenta;
    else cuentas[estrellas] += f.cuenta;
  }
  const mayor = Math.max(1, ...Object.values(cuentas));
  return {
    filas: ESTRELLAS.map((estrellas) => ({
      estrellas,
      nombre: NOMBRES_DE_ESTRELLAS[estrellas],
      cuenta: cuentas[estrellas],
      porcentaje: Math.round((cuentas[estrellas] / mayor) * 100),
    })),
    calificados: ESTRELLAS.reduce((suma, e) => suma + cuentas[e], 0),
    altos: cuentas[4] + cuentas[5],
    maximos: cuentas[5],
    sinCalificacion,
  };
}

/** Lo que el Resumen muestra además de ResumenDeProgreso; null si falla (se loguea el error). */
export async function obtenerDatosDeResumen(
  usuarioId: number | string,
  progreso: ResumenDeProgreso,
): Promise<DatosDeResumen | null> {
  try {
    const [cifrasR, rangosR, ascensosR, calificacionesR, medallasR, nivelesR, contadoresR] = await Promise.all([
      pool.query<{
        exp_total: number;
        aportes_aceptados: number;
        aportes_excepcionales: number;
        racha_maxima: number;
        campanas_completadas: number;
      }>(
        `SELECT exp_total, aportes_aceptados, aportes_excepcionales, racha_maxima, campanas_completadas
         FROM usuario_progreso WHERE usuario_id = $1`,
        [usuarioId],
      ),
      pool.query<FilaDeRango>(
        `SELECT numero, nombre, descripcion, etapa_avatar, req_exp, req_aportes, req_excelentes,
                req_excepcionales, req_racha, req_misiones
         FROM rangos ORDER BY numero`,
      ),
      pool.query<{ rango: number; alcanzado_en: Date }>(
        `SELECT rango, alcanzado_en FROM rango_ascensos WHERE usuario_id = $1`,
        [usuarioId],
      ),
      // Los aportes anónimos no llevan user_id: quedan fuera (RN-GAM-26).
      pool.query<{ calificacion: number | null; cuenta: number }>(
        `SELECT calificacion, COUNT(*)::int AS cuenta
         FROM aportes WHERE user_id = $1 AND status = 'aceptado'
         GROUP BY calificacion`,
        [usuarioId],
      ),
      pool.query<{
        id: number;
        clave: string;
        nombre: string;
        mide: string | null;
        nivel_actual: number;
        valor_actual: number;
      }>(
        `SELECT m.id, m.clave, m.nombre, m.mide, COALESCE(mu.nivel_actual, 0)::int AS nivel_actual,
                COALESCE(mu.valor_actual, 0)::int AS valor_actual
         FROM medallas m
         LEFT JOIN medallas_usuario mu ON mu.medalla_id = m.id AND mu.usuario_id = $1
         WHERE m.activa AND m.clave IS NOT NULL
         ORDER BY m.id`,
        [usuarioId],
      ),
      pool.query<NivelDeMedalla & { medalla_id: number }>(
        `SELECT medalla_id, nivel, nombre, umbral FROM medalla_niveles ORDER BY medalla_id, nivel`,
      ),
      pool.query<{ dimension: string; cuantos: number }>(
        `SELECT dimension, COUNT(*)::int AS cuantos
         FROM usuario_contadores WHERE usuario_id = $1 AND valor > 0
         GROUP BY dimension`,
        [usuarioId],
      ),
    ]);

    const cifras = cifrasR.rows[0];
    if (!cifras) return null;
    const ascenso = (rango: number) => ascensosR.rows.find((a) => a.rango === rango)?.alcanzado_en ?? null;
    const contador = (dimension: string) => contadoresR.rows.find((c) => c.dimension === dimension)?.cuantos ?? 0;

    // Lo que ya se lleva en otras tablas se lee de ahí; lo demás, del valor guardado en la medalla.
    const valorPorMedida: Record<string, number> = {
      aportes_aceptados: cifras.aportes_aceptados,
      aportes_excepcionales: cifras.aportes_excepcionales,
      racha_maxima: cifras.racha_maxima,
      campanas_completadas: cifras.campanas_completadas,
      exp_total: cifras.exp_total,
      campanas_distintas: contador("campana"),
      tipos_distintos: contador("tipo"),
      tematicas_distintas: contador("tematica"),
    };
    const medallas: MedallaConAvance[] = medallasR.rows.map((m) => ({
      clave: m.clave,
      nombre: m.nombre,
      mide: m.mide,
      nivelActual: m.nivel_actual,
      valor: Math.max(m.valor_actual, (m.mide && valorPorMedida[m.mide]) || 0),
      niveles: nivelesR.rows.filter((n) => n.medalla_id === m.id),
    }));

    return {
      expTotal: cifras.exp_total,
      camino: caminoDeRangos(rangosR.rows, progreso, ascenso),
      fichas: fichasDeLaTrayectoria(rangosR.rows, progreso.rangoActual, ascenso, progreso.fichas),
      calificaciones: resumenDeCalificaciones(calificacionesR.rows),
      medallasCerca: medallasMasCercanas(medallas, MEDALLAS_CERCA),
    };
  } catch (error) {
    console.error("Error armando el resumen de Mi progreso", error);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------
// Calendario de la racha (RF-GAM-85, 86).
// ---------------------------------------------------------------------------------------------------

const FORMATO_DE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const TITULO_DE_MES = new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" });
const FECHA_CORTA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

export function esMesValido(mes: string): boolean {
  return FORMATO_DE_MES.test(mes);
}

/** El mes `desplazamiento` meses después de `mes` (YYYY-MM). */
function otroMes(mes: string, desplazamiento: number): string {
  const [anio, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(anio, numero - 1 + desplazamiento, 1)).toISOString().slice(0, 7);
}

function tituloDeMes(mes: string): string {
  const nombre = TITULO_DE_MES.format(new Date(`${mes}-01T00:00:00Z`));
  return `${nombre.charAt(0).toLocaleUpperCase("es-MX")}${nombre.slice(1)} ${mes.slice(0, 4)}`;
}

/** Sin `mes`, o con uno fuera de la vida de la cuenta, devuelve el mes en curso o el más cercano. null si falla. */
export async function obtenerCalendarioDeRacha(
  usuarioId: number | string,
  mesPedido?: string,
): Promise<CalendarioDeRachaDelMes | null> {
  try {
    const hoy = hoyEnTepic();
    const mesActual = hoy.slice(0, 7);
    const cuentaR = await pool.query<{ primer_mes: string }>(
      `SELECT to_char(creado_en AT TIME ZONE $2, 'YYYY-MM') AS primer_mes FROM usuario_progreso WHERE usuario_id = $1`,
      [usuarioId, ZONA_DE_CAMPANAS],
    );
    const primerMes = cuentaR.rows[0]?.primer_mes;
    if (!primerMes) return null;

    const pedido = mesPedido ?? mesActual;
    const mes = pedido > mesActual ? mesActual : pedido < primerMes ? primerMes : pedido;
    const inicio = `${mes}-01`;
    const fin = `${otroMes(mes, 1)}-01`;

    const [diasR, aportesR, eventosR] = await Promise.all([
      pool.query<{ dia: string; estado: string }>(
        `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, estado
          FROM racha_dias WHERE usuario_id = $1 AND dia >= $2::date AND dia < $3::date`,
        [usuarioId, inicio, fin],
      ),
      pool.query<{
        id: number;
        campana: string;
        description: string;
        status: string;
        calificacion: number | null;
        dia: string;
        exp: number | null;
      }>(
        `SELECT a.id, c.name AS campana, a.description, a.status, a.calificacion,
                to_char(a.submitted_at AT TIME ZONE $4, 'YYYY-MM-DD') AS dia,
                (SELECT SUM(m.exp)::int FROM exp_movimientos m
                  WHERE m.aporte_id = a.id AND m.usuario_id = $1 AND m.tipo = 'aporte') AS exp
          FROM aportes a JOIN campanas c ON c.id = a.campaign_id
          WHERE a.user_id = $1
            AND a.submitted_at >= ($2::date::timestamp AT TIME ZONE $4)
            AND a.submitted_at < ($3::date::timestamp AT TIME ZONE $4)
          ORDER BY a.submitted_at, a.id`,
        [usuarioId, inicio, fin, ZONA_DE_CAMPANAS],
      ),
      pool.query<{ id: string; tipo: string; fecha: string; aporte: string | null }>(
        `SELECT e.id::text AS id, e.tipo,
                to_char(COALESCE(e.dia, (e.creado_en AT TIME ZONE $4)::date), 'YYYY-MM-DD') AS fecha,
                a.description AS aporte
         FROM racha_eventos e
         LEFT JOIN aportes a ON a.id = e.aporte_id
         WHERE e.usuario_id = $1
           AND COALESCE(e.dia, (e.creado_en AT TIME ZONE $4)::date) >= $2::date
           AND COALESCE(e.dia, (e.creado_en AT TIME ZONE $4)::date) < $3::date
         ORDER BY e.creado_en DESC, e.id DESC`,
        [usuarioId, inicio, fin, ZONA_DE_CAMPANAS],
      ),
    ]);

    const estados = new Map(diasR.rows.map((d) => [d.dia, d.estado]));
    const aportesPorDia = new Map<string, AporteDelDia[]>();
    for (const a of aportesR.rows) {
      const aporte: AporteDelDia = {
        id: a.id,
        campana: a.campana,
        descripcion: a.description,
        ...(ESTADO_DE_APORTE[a.status] ?? { estado: a.status, tono: "default" as const }),
        calificacion: a.status === "aceptado" ? calificacionDesde(a.calificacion) : null,
        exp: a.exp,
      };
      aportesPorDia.set(a.dia, [...(aportesPorDia.get(a.dia) ?? []), aporte]);
    }

    const diasDelMes = new Date(`${fin}T00:00:00Z`);
    diasDelMes.setUTCDate(0);
    const dias: DiaDelCalendario[] = [];
    for (let numero = 1; numero <= diasDelMes.getUTCDate(); numero++) {
      const dia = `${mes}-${String(numero).padStart(2, "0")}`;
      const guardado = estados.get(dia);
      const estado: DiaDelCalendario["estado"] =
        dia > hoy ? "por_venir" : guardado && ESTADOS_DE_DIA.has(guardado) ? (guardado as EstadoDeDiaDeRacha) : "sin_actividad";
      dias.push({ dia, numero, estado, hoy: dia === hoy, aportes: aportesPorDia.get(dia) ?? [] });
    }

    const eventos: EventoDeRacha[] = eventosR.rows.map((e) => ({
      id: e.id,
      fecha: FECHA_CORTA.format(new Date(`${e.fecha}T00:00:00Z`)),
      texto: TEXTO_DE_EVENTO[e.tipo] ?? e.tipo,
      aporte: e.aporte,
    }));

    return {
      mes,
      titulo: tituloDeMes(mes),
      mesAnterior: mes > primerMes ? otroMes(mes, -1) : null,
      mesSiguiente: mes < mesActual ? otroMes(mes, 1) : null,
      desfase: (new Date(`${inicio}T00:00:00Z`).getUTCDay() + 6) % 7,
      dias,
      eventos,
    };
  } catch (error) {
    console.error("Error armando el calendario de la racha", error);
    return null;
  }
}
