// Contrato de /api/progreso/enfoque (lib/gamificacion/enfoque.ts). Serializable y sin imports de servidor: lo usan
// las pantallas del registro, la ventana para cuentas sin enfoque y Mi cuenta.

export type OpcionDeEnfoque = {
  clave: string;
  nombre: string;
  subtitulo: string;
  descripcion: string;
};

export type EstadoDelEnfoque = {
  /** null mientras la persona no ha elegido (la ventana que no se puede omitir lo pide). */
  actual: OpcionDeEnfoque | null;
  /** Cuándo eligió el actual, en ISO. */
  elegidoEn: string | null;
  /** Desde cuándo puede volver a cambiarlo, en ISO; null si ya puede (o si aún no elige). Lo decide el servidor. */
  puedeCambiarDesde: string | null;
  esperaParaCambiarDias: number;
  /** Los que se pueden elegir, en el orden del catálogo. */
  opciones: OpcionDeEnfoque[];
};

export type ResultadoDeElegirEnfoque =
  | { ok: true; cambio: boolean; estado: EstadoDelEnfoque }
  | { ok: false; motivo: "no_disponible" }
  | { ok: false; motivo: "en_espera"; puedeCambiarDesde: string }
  | { ok: false; motivo: "sin_cuenta" };
