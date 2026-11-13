// Contrato de lo que arma lib/gamificacion/mi-progreso.ts en el servidor: la Trayectoria, el calendario de racha y las
// calificaciones de Mis aportes. Todo es serializable y sin imports de servidor (nada de `pg`). Complementa a
// ResumenDeProgreso (./progreso-tipos.ts), que usa /inicio. (El Resumen de /progreso se eliminó el 2026-11-12.)

import type { CalificacionDeAporte } from "@/lib/aportes/calificacion";
import type { EstadoDeDiaDeRacha } from "./progreso-tipos";
import type { EstadoDeRango, FichaDeRango, ValoresPorRequisito } from "./rangos";

/** Una ficha del camino. `nombreCorto` es null en avistado y por descubrir: el nombre no sale del servidor. */
export type EslabonDelCamino = {
  numero: number;
  estado: EstadoDeRango;
  nombreCorto: string | null;
  /** «21 oct», «Tu rango», «2 de 6», «Avistado» o «Por descubrir». */
  detalle: string;
};

export type FilaDeCalificacion = {
  estrellas: CalificacionDeAporte;
  /** Nombre del nivel, solo de interfaz (RF-GAM-99). */
  nombre: string;
  cuenta: number;
  /** Ancho de la barra: 0 a 100, respecto a la fila con más aportes. */
  porcentaje: number;
};

export type ResumenDeCalificaciones = {
  /** De 5★ a 1★. */
  filas: FilaDeCalificacion[];
  /** Aportes aceptados con calificación. */
  calificados: number;
  /** De 4★ o más; un aporte de 5★ cuenta aquí y en `maximos` (RN-GAM-07). */
  altos: number;
  maximos: number;
  /** Aceptados antes de que existieran las estrellas: no entran en las barras. */
  sinCalificacion: number;
};

// ------------------------------------
// Trayectoria (/progreso/trayectoria
// ------------------------------------

/** Una tarjeta del camino de los 20 rangos: un eslabón más la EXP que pide (dato público, RF-GAM-80). */
export type EslabonDeLaTrayectoria = EslabonDelCamino & { expQuePide: number };

/** Un rango alcanzado (o el actual) en «Tu recorrido» (RF-GAM-83). */
export type HitoDelRecorrido = {
  numero: number;
  nombre: string;
  /** «hoy», «21 oct» o "" sin fecha registrada. */
  fecha: string;
  /** «11 días después», «El mismo día», «Al crear tu cuenta» o "". */
  lapso: string;
};

/** Una fila de «Requisitos de los 20 rangos» (RF-GAM-80). `nombre` es null en avistado y por descubrir. */
export type FilaDeRequisitosDeRango = {
  numero: number;
  estado: EstadoDeRango;
  nombre: string | null;
  requisitos: ValoresPorRequisito;
};

export type DatosDeTrayectoria = {
  eslabones: EslabonDeLaTrayectoria[];
  /** Del rango actual al 1. */
  recorrido: HitoDelRecorrido[];
  tabla: FilaDeRequisitosDeRango[];
  /** Una ficha por rango (RF-GAM-78, RNF-GAM-14). */
  fichas: FichaDeRango[];
};

// ------------------------
// Calendario de la racha.
// ------------------------

export type AporteDelDia = {
  id: number;
  campana: string;
  descripcion: string;
  estado: string;
  tono: "default" | "ok" | "warn" | "danger";
  calificacion: CalificacionDeAporte | null;
  /** EXP concedida (exp_movimientos); null si no produjo EXP. */
  exp: number | null;
};

export type DiaDelCalendario = {
  /** YYYY-MM-DD. */
  dia: string;
  numero: number;
  /** Los días que aún no llegan no tienen estado. */
  estado: EstadoDeDiaDeRacha | "por_venir";
  hoy: boolean;
  /** Primer día de la racha actual. */
  inicioDeRacha: boolean;
  aportes: AporteDelDia[];
};

export type EventoDeRacha = {
  id: string;
  /** «23 oct». */
  fecha: string;
  texto: string;
  /** Descripción del aporte relacionado, si lo hay (RF-GAM-86). */
  aporte: string | null;
};

/** El aporte con el que empezó la racha actual; descripción y campaña son null si el aporte ya no existe. */
export type InicioDeRacha = {
  /** «2 nov». */
  fecha: string;
  descripcion: string | null;
  campana: string | null;
};

export type CalendarioDeRachaDelMes = {
  /** YYYY-MM. */
  mes: string;
  /** «Octubre 2026». */
  titulo: string;
  /** null en el primer mes de la cuenta y en el mes en curso: no hay nada que ver más allá. */
  mesAnterior: string | null;
  mesSiguiente: string | null;
  /** Celdas vacías antes del día 1, en una semana que empieza en lunes. */
  desfase: number;
  dias: DiaDelCalendario[];
  eventos: EventoDeRacha[];
  /** null sin racha activa. */
  inicioDeRacha: InicioDeRacha | null;
};
