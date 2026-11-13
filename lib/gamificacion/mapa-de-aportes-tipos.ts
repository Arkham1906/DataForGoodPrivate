// Contrato del mapa de aportes de /mis-aportes (2026-11-13; SRS v1.3: RF-GAM-15, 87, 88; diseño V10). Sin imports de
// servidor: lo importa el componente cliente. Los datos los arma lib/gamificacion/mapa-de-aportes.ts y solo los recibe
// quien aportó (RF-GAM-77): la EXP de cada aporte es privada.

import type { CalificacionDeAporte } from "@/lib/aportes/calificacion";

export type EstadoDelAporteEnElMapa = "aceptado" | "pendiente" | "rechazado";

/** Cómo se llegó a la EXP de un aporte (RF-GAM-07): lo guardado en exp_movimientos al aceptarlo. */
export type DesgloseDeExp = {
  base: number;
  multCalidad: number;
  /** base × calidad × factor = EXP. El factor junta potenciador y campaña especial, con tope (exp-reglas.ts). */
  factor: number;
  conPotenciador: boolean;
  conCampanaEspecial: boolean;
};

export type AporteEnElMapa = {
  id: number;
  campanaId: number;
  tipo: string;
  /** Texto corto para la lista (la descripción del aporte, recortada). Vacío si no tiene. */
  descripcion: string;
  estado: EstadoDelAporteEnElMapa;
  calificacion: CalificacionDeAporte | null;
  /** null: aún no se procesa; 0: no le tocó EXP; > 0: la EXP ganada. Solo para aceptados. */
  exp: number | null;
  desglose: DesgloseDeExp | null;
  /** ISO de submitted_at. */
  enviadoEn: string;
};

export type CampanaEnElMapa = {
  id: number;
  nombre: string;
  tematica: string;
  /**
   * Subtemáticas aprobadas de la campaña (campana_etiquetas; 0 a 5), en orden alfabético. El mapa cuelga la campaña de
   * una sola, la principal (mapa-de-aportes-geometria.ts, subtematicaPrincipal), y muestra las demás al elegirla.
   */
  subtematicas: string[];
  /** Meta de aportes de la campaña (RF-GAM-88); null si no tiene. */
  meta: number | null;
  /** Aportes aceptados de todas las personas (RF-GAM-88). */
  aprobadosDeTodos: number;
  /** Cuántos de esos son tuyos. */
  aprobadosTuyos: number;
  cuota: number | null;
  /** Bono de cuota concedido (RF-GAM-37); null si no hay. */
  bonoDeCuota: number | null;
  /** Multiplicador de campaña especial vigente hoy; null si no es especial ahora. */
  especial: number | null;
  /** Aportes tuyos de la campaña, del más reciente al más antiguo. */
  aportes: AporteEnElMapa[];
};

export type DatosDelMapaDeAportes = {
  campanas: CampanaEnElMapa[];
  /** Temáticas con campañas, de la que tiene más aportes tuyos a la que tiene menos. */
  tematicas: string[];
  /** Temáticas de interés del perfil: solo se dibujan en una cuenta sin aportes. */
  intereses: string[];
  /** Subtemáticas de interés del perfil (usuario_etiquetas): desempatan la subtemática principal de una campaña. */
  subtematicasDeInteres: string[];
};
