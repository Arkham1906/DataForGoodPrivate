// Resumen de progreso de una persona (2026-11-02; SRS v1.1): rango y requisitos del siguiente, potenciadores,
// misiones diarias y racha de los últimos 7 días. Solo lectura y solo de la persona con sesión: lo usan /inicio
// y /progreso. Las tablas están en lib/db-schema.ts (ensureGamificacion): usuario_progreso, rangos,
// rango_ascensos, potenciadores, mision_instancias y racha_dias. Los tipos están en ./progreso-tipos.ts y
// ./rangos.ts (sin imports de servidor).
//
// Esta función NO calcula ni concede nada (RNF-GAM-06): el servidor que otorgue EXP, rangos y rachas es otro
// proceso; aquí solo se lee lo que ya está guardado. Mientras ese proceso no exista, las tablas están en sus
// valores iniciales (rango 1, 0 EXP) y las misiones no tienen catálogo (DA-GAM-06): la pantalla lo muestra vacío.
//
// Visibilidad (RF-GAM-78, RNF-GAM-14): de los rangos que se leen, solo el actual y el siguiente salen con
// nombre y descripción; del avistado salen el número, la pista y los requisitos. Nunca se envía nada del resto.

import { pool } from "@/lib/db";
import { ZONA_DE_CAMPANAS, hoyEnTepic } from "@/lib/fecha-de-tepic";
import { asegurarMisionesVigentes } from "./misiones";
import { recompensaDesde, textoDeRecompensa } from "./misiones-reglas";
import type {
  DiaDeRacha,
  EstadoDeDiaDeRacha,
  MisionDeHoy,
  ResumenDeProgreso,
} from "./progreso-tipos";
import {
  avanceDeRequisitos,
  pistaDelRango,
  requisitosDeRango,
  textoDeAscenso,
  textoQueFalta,
  type FichaDeRango,
  type ValoresPorRequisito,
} from "./rangos";

type FilaDeProgreso = {
  rango_actual: number;
  exp_total: number;
  aportes_aceptados: number;
  aportes_excelentes: number;
  aportes_excepcionales: number;
  misiones_completadas: number;
  racha_actual: number;
  racha_maxima: number;
  protectores: number;
  total_rangos: number;
};

export type FilaDeRango = {
  numero: number;
  nombre: string;
  descripcion: string | null;
  etapa_avatar: number | null;
  req_exp: number;
  req_aportes: number;
  req_excelentes: number;
  req_excepcionales: number;
  req_racha: number;
  req_misiones: number;
};

const NOMBRES_DE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const LETRAS_DE_DIA = ["D", "L", "M", "M", "J", "V", "S"];
const ESTADOS_DE_DIA = new Set<string>(["confirmado", "provisional", "protegido", "sin_actividad", "suspendido"]);

export function requisitosDe(r: FilaDeRango): ValoresPorRequisito {
  return {
    exp: r.req_exp,
    aportes: r.req_aportes,
    excelentes: r.req_excelentes,
    excepcionales: r.req_excepcionales,
    racha: r.req_racha,
    misiones: r.req_misiones,
  };
}

export function sumarDias(dia: string, dias: number): string {
  const fecha = new Date(`${dia}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Los últimos 7 días (el último es hoy, en la zona de las campañas); un día sin fila es «sin actividad». */
function diasDeRacha(hoy: string, filas: { dia: string; estado: string }[]): DiaDeRacha[] {
  const porDia = new Map(filas.map((f) => [f.dia, f.estado]));
  const dias: DiaDeRacha[] = [];
  for (let atras = 6; atras >= 0; atras--) {
    const dia = sumarDias(hoy, -atras);
    const diaDeSemana = new Date(`${dia}T00:00:00Z`).getUTCDay();
    const guardado = porDia.get(dia);
    dias.push({
      dia,
      letra: LETRAS_DE_DIA[diaDeSemana],
      nombre: NOMBRES_DE_DIA[diaDeSemana],
      estado: (guardado && ESTADOS_DE_DIA.has(guardado) ? guardado : "sin_actividad") as EstadoDeDiaDeRacha,
      hoy: atras === 0,
    });
  }
  return dias;
}

/** null si la persona no tiene fila de progreso o el catálogo de rangos no la contiene (se loguea el error). */
export async function obtenerResumenDeProgreso(usuarioId: number | string): Promise<ResumenDeProgreso | null> {
  try {
    await asegurarMisionesVigentes(usuarioId);
    const hoy = hoyEnTepic();
    const [progresoR, rangosR, ascensosR, potenciadoresR, misionesR, rachaR] = await Promise.all([
      pool.query<FilaDeProgreso>(
        `SELECT p.rango_actual, p.exp_total, p.aportes_aceptados, p.aportes_excelentes, p.aportes_excepcionales,
                p.misiones_completadas, p.racha_actual, p.racha_maxima, p.protectores,
                (SELECT MAX(numero) FROM rangos)::int AS total_rangos
         FROM usuario_progreso p WHERE p.usuario_id = $1`,
        [usuarioId],
      ),
      // Actual, siguiente y avistado: el avistado necesita al siguiente para calcular su pista.
      pool.query<FilaDeRango>(
        `SELECT r.numero, r.nombre, r.descripcion, r.etapa_avatar, r.req_exp, r.req_aportes, r.req_excelentes,
                r.req_excepcionales, r.req_racha, r.req_misiones
         FROM rangos r
         WHERE r.numero BETWEEN (SELECT rango_actual FROM usuario_progreso WHERE usuario_id = $1)
                            AND (SELECT rango_actual FROM usuario_progreso WHERE usuario_id = $1) + 2
         ORDER BY r.numero`,
        [usuarioId],
      ),
      pool.query<{ rango: number; alcanzado_en: Date }>(
        `SELECT a.rango, a.alcanzado_en
         FROM rango_ascensos a
         WHERE a.usuario_id = $1
           AND a.rango >= (SELECT rango_actual FROM usuario_progreso WHERE usuario_id = $1) - 1`,
        [usuarioId],
      ),
      // Los segundos salen del reloj de la base (RNF-GAM-12), no del navegador.
      pool.query<{ estado: string; bonificacion: number; duracion_minutos: number; segundos: number | null }>(
        `SELECT estado, bonificacion::float8 AS bonificacion, duracion_minutos,
                CASE WHEN estado = 'activo' THEN GREATEST(0, EXTRACT(EPOCH FROM (vence_en - NOW())))::int END AS segundos
         FROM potenciadores
         WHERE usuario_id = $1 AND estado IN ('activo', 'espera')`,
        [usuarioId],
      ),
      pool.query<{
        id: string;
        nombre: string;
        objetivo: number;
        progreso: number;
        completada: boolean;
        entregada: boolean;
        renueva_a: string;
        recompensa: unknown;
      }>(
        `SELECT mi.id::text AS id, m.nombre, m.recompensa, mi.objetivo, mi.progreso,
                (mi.completada_en IS NOT NULL) AS completada,
                (mi.recompensa_entregada_en IS NOT NULL) AS entregada,
                to_char(mi.periodo_fin AT TIME ZONE $2, 'HH24:MI') AS renueva_a
         FROM mision_instancias mi
         JOIN misiones m ON m.id = mi.mision_id
         WHERE mi.usuario_id = $1 AND m.periodicidad = 'diaria'
           AND mi.periodo_inicio <= NOW() AND mi.periodo_fin > NOW()
         ORDER BY mi.periodo_fin, mi.id`,
        [usuarioId, ZONA_DE_CAMPANAS],
      ),
      pool.query<{ dia: string; estado: string }>(
        `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, estado
         FROM racha_dias
         WHERE usuario_id = $1 AND dia BETWEEN ($2::date - 6) AND $2::date`,
        [usuarioId, hoy],
      ),
    ]);

    const p = progresoR.rows[0];
    if (!p) return null;
    const actual = p.rango_actual;
    const filaActual = rangosR.rows.find((r) => r.numero === actual);
    if (!filaActual) {
      console.error(`El catálogo de rangos no tiene el rango ${actual}`);
      return null;
    }
    const filaSiguiente = rangosR.rows.find((r) => r.numero === actual + 1);
    const filaAvistado = rangosR.rows.find((r) => r.numero === actual + 2);

    const progreso: ValoresPorRequisito = {
      exp: p.exp_total,
      aportes: p.aportes_aceptados,
      excelentes: p.aportes_excelentes,
      excepcionales: p.aportes_excepcionales,
      racha: p.racha_actual,
      misiones: p.misiones_completadas,
    };

    const ascenso = (rango: number) => ascensosR.rows.find((a) => a.rango === rango)?.alcanzado_en ?? null;
    const fichas: FichaDeRango[] = [
      {
        estado: "actual",
        numero: actual,
        nombre: filaActual.nombre,
        descripcion: filaActual.descripcion,
        etapaDelAvatar: filaActual.etapa_avatar ?? actual,
        requisitos: requisitosDeRango(requisitosDe(filaActual)),
        textoDeAscenso: textoDeAscenso(actual, ascenso(actual), ascenso(actual - 1)),
      },
    ];

    let siguiente: ResumenDeProgreso["siguiente"] = null;
    if (filaSiguiente) {
      const avances = avanceDeRequisitos(requisitosDe(filaSiguiente), progreso);
      const cumplidos = avances.filter((a) => a.cumplido).length;
      const pasos = [...avances.filter((a) => a.cumplido), ...avances.filter((a) => !a.cumplido)].map((a) => a.cumplido);
      const queFalta = textoQueFalta(avances);
      fichas.push({
        estado: "siguiente",
        numero: filaSiguiente.numero,
        nombre: filaSiguiente.nombre,
        descripcion: filaSiguiente.descripcion,
        etapaDelAvatar: filaSiguiente.etapa_avatar ?? filaSiguiente.numero,
        requisitos: avances,
        cumplidos,
        textoQueFalta: queFalta,
      });
      siguiente = {
        numero: filaSiguiente.numero,
        nombre: filaSiguiente.nombre,
        cumplidos,
        activos: avances.length,
        pasos,
        textoQueFalta: queFalta,
      };
      if (filaAvistado) {
        // Del avistado solo salen el número, la pista y los requisitos (RF-GAM-78 c, RNF-GAM-14).
        fichas.push({
          estado: "avistado",
          numero: filaAvistado.numero,
          pista: pistaDelRango(requisitosDe(filaAvistado), requisitosDe(filaSiguiente)),
          requisitos: requisitosDeRango(requisitosDe(filaAvistado)),
        });
      }
    }

    const activoFila = potenciadoresR.rows.find((f) => f.estado === "activo" && (f.segundos ?? 0) > 0);
    const misiones: MisionDeHoy[] = misionesR.rows.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      progreso: m.progreso,
      objetivo: m.objetivo,
      completada: m.completada,
      recompensaEntregada: m.entregada,
      recompensa: textoDeRecompensa(recompensaDesde(m.recompensa)),
    }));

    return {
      rangoActual: actual,
      totalDeRangos: p.total_rangos,
      nombreDelRango: filaActual.nombre,
      etapaDelAvatar: filaActual.etapa_avatar ?? actual,
      siguiente,
      fichas,
      potenciadores: {
        activo: activoFila
          ? {
              bonificacion: activoFila.bonificacion,
              duracionMinutos: activoFila.duracion_minutos,
              segundosRestantes: activoFila.segundos ?? 0,
            }
          : null,
        enEspera: potenciadoresR.rows.filter((f) => f.estado === "espera").length,
      },
      misiones: { diarias: misiones, seRenuevanA: misionesR.rows[0]?.renueva_a ?? null },
      racha: {
        actual: p.racha_actual,
        maxima: p.racha_maxima,
        protectores: p.protectores,
        dias: diasDeRacha(hoy, rachaR.rows),
      },
      sinAportesAceptados: p.aportes_aceptados === 0,
    };
  } catch (error) {
    console.error("Error armando el resumen de progreso", error);
    return null;
  }
}
