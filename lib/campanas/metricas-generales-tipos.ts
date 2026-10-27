// Forma de las "Métricas generales" del panel de una campaña (2026-10-27): métricas según los
// atributos de la campaña (tipos de dato, ubicación, checklists) y de cómo llegan y se
// revisan sus aportes. Las calcula lib/campanas/metricas-generales.ts y las dibuja
// components/campanas/MetricasGenerales.tsx. Sin imports de servidor.

export type MetricasGenerales = {
  /** Por cada tipo de dato que pide la campaña. */
  tipos: {
    tipo: string;
    etiqueta: string;
    recibidos: number;
    aprobados: number;
    rechazados: number;
    /** % de aprobados sobre los ya decididos (aprobados + rechazados); null si no hay decididos. */
    tasaDeAprobacion: number | null;
    /** Peso promedio del archivo; null si no hay archivos (p. ej. textos sin .txt). */
    pesoPromedioBytes: number | null;
  }[];
  ubicacion: {
    /** "Tepic, Nayarit", "Todo el país" o "" (sin ubicación). */
    zona: string;
    todoElPais: boolean;
    participantesConCuenta: number;
    /** Participantes con cuenta que viven en la zona de la campaña; null si es para todo el país o no tiene zona. */
    enLaZona: number | null;
    /** Participantes con cuenta sin estado en su perfil. */
    sinUbicacion: number;
    /** Dispositivos distintos que aportaron sin cuenta (no se sabe dónde viven). */
    sinCuenta: number;
    /** Participantes con cuenta por estado, de más a menos (hasta 6). */
    porEstado: { estado: string; participantes: number }[];
  };
  /** Por aporte: con cuenta o sin cuenta, y si llegó por el enlace público. */
  origen: { conCuenta: number; sinCuenta: number; porEnlace: number; total: number };
  revision: {
    aprobados: number;
    rechazados: number;
    pendientes: number;
    tasaDeAprobacion: number | null;
    /** Horas promedio entre que se envía y se decide; null si no hay decididos con fecha. */
    horasPromedio: number | null;
    /** Motivos de rechazo más frecuentes (texto idéntico agrupado, hasta 3). */
    motivos: { motivo: string; aportes: number }[];
  };
  participacion: {
    cuota: number;
    /** Aportes promedio por participante (con y sin cuenta); null sin participantes. */
    promedioPorParticipante: number | null;
    /** Participantes que ya llegaron a la cuota por persona. */
    llegaronALaCuota: number;
    participantes: number;
  };
  /** Respuestas de cada checklist entre los aportes aprobados. */
  checklists: {
    titulo: string;
    opciones: { opcion: string; aportes: number; porcentaje: number }[];
  }[];
  aprobadosParaChecklists: number;
};
