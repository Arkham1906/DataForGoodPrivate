// Contrato del resumen de progreso de una persona (2026-11-02; SRS v1.1): lo que arma
// lib/gamificacion/progreso.ts en el servidor y pintan los componentes de components/gamificacion en /inicio
// y /progreso. Todo es serializable (pasa del Server Component a los componentes cliente) y no tiene
// imports de servidor (nada de `pg`).
//
// Qué se envía de cada rango lo decide el servidor (RF-GAM-78, RNF-GAM-14): ver FichaDeRango en ./rangos.ts.

import type { FichaDeRango } from "./rangos";

/** Protectores que se conservan como máximo (RF-GAM-30). */
export const MAXIMO_DE_PROTECTORES = 3;
/** Los protectores aún no existen (2026-11-04): la interfaz no los muestra y la racha se interrumpe con un día faltante. */
export const PROTECTORES_ACTIVOS = false;
/** Potenciadores en espera como máximo, además del activo (RF-GAM-35). */
export const MAXIMO_DE_POTENCIADORES_EN_ESPERA = 3;

export type PotenciadorActivo = {
  /** Lo que suma al factor de EXP (0.5). Se copia al obtenerlo (tabla potenciadores). */
  bonificacion: number;
  duracionMinutos: number;
  /** Segundos que quedan según el reloj del servidor (RNF-GAM-12); el cliente solo los descuenta. */
  segundosRestantes: number;
};

export type ResumenDePotenciadores = {
  activo: PotenciadorActivo | null;
  enEspera: number;
};

/** Misión diaria de la instancia vigente de la persona (RF-GAM-40, 41). */
export type MisionDeHoy = {
  id: string;
  nombre: string;
  progreso: number;
  objetivo: number;
  completada: boolean;
  recompensaEntregada: boolean;
  /** «15 EXP»; null sin recompensa. */
  recompensa: string | null;
};

export type ResumenDeMisiones = {
  diarias: MisionDeHoy[];
  /** Hora a la que termina el periodo vigente, «08:15», en la zona de las campañas; null sin misiones. */
  seRenuevanA: string | null;
};

/** Estado de un día de la racha (RF-GAM-85). */
export type EstadoDeDiaDeRacha = "confirmado" | "provisional" | "protegido" | "sin_actividad" | "suspendido";

export type DiaDeRacha = {
  /** YYYY-MM-DD. */
  dia: string;
  /** L, M, M, J, V, S, D. */
  letra: string;
  /** «lunes». */
  nombre: string;
  estado: EstadoDeDiaDeRacha;
  hoy: boolean;
};

export type ResumenDeRacha = {
  actual: number;
  maxima: number;
  protectores: number;
  /** Los últimos 7 días, el último es hoy. */
  dias: DiaDeRacha[];
};

export type RangoSiguiente = {
  numero: number;
  nombre: string;
  cumplidos: number;
  activos: number;
  /** Un valor por requisito, con los cumplidos primero (la barra de tramos). */
  pasos: boolean[];
  textoQueFalta: string;
};

export type ResumenDeProgreso = {
  rangoActual: number;
  totalDeRangos: number;
  nombreDelRango: string;
  /** Etapa del avatar de gamificación: la del mayor rango alcanzado (RF-GAM-23); no retrocede. */
  etapaDelAvatar: number;
  /** null en el último rango. */
  siguiente: RangoSiguiente | null;
  /** Rango actual, siguiente y avistado, en ese orden; los que no existan (fin de la trayectoria) no vienen. */
  fichas: FichaDeRango[];
  potenciadores: ResumenDePotenciadores;
  misiones: ResumenDeMisiones;
  racha: ResumenDeRacha;
  /** Aún sin aportes aceptados: la pantalla da la bienvenida a la trayectoria. */
  sinAportesAceptados: boolean;
};
