// Reglas de la racha (2026-11-04; SRS v1.3: RF-GAM-25, 27, 31), sin protectores: un día faltante interrumpe la racha.
// Lógica pura, sin base de datos ni reloj propio. Un día cuenta en cuanto se envía un aporte, sea cual sea el resultado
// de su revisión, y ya no se pierde: ni el rechazo ni la eliminación del aporte lo descuentan.

export type RachaCalculada = {
  /** Días que cuentan para la racha. */
  dias: Set<string>;
  actual: number;
  /** La racha más larga dentro de esos días. */
  mayor: number;
  ultimoDia: string | null;
};

export function sumarDias(dia: string, dias: number): string {
  const fecha = new Date(`${dia}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export function calcularRacha(entrada: {
  /** Días con un aporte enviado. */
  diasConAporte: readonly string[];
  /** Días que ya contaban: su aporte pudo eliminarse después. */
  diasGuardados: readonly string[];
  /** YYYY-MM-DD. */
  hoy: string;
}): RachaCalculada {
  const { diasConAporte, diasGuardados, hoy } = entrada;
  const dias = new Set([...diasConAporte, ...diasGuardados]);

  // Hoy aún puede contar: si no tiene aportes, la racha sigue viva desde ayer.
  let actual = 0;
  let cursor = dias.has(hoy) ? hoy : sumarDias(hoy, -1);
  while (dias.has(cursor)) {
    actual++;
    cursor = sumarDias(cursor, -1);
  }

  const ordenados = [...dias].sort();
  let mayor = 0;
  let tramo = 0;
  ordenados.forEach((dia, i) => {
    tramo = i > 0 && sumarDias(ordenados[i - 1], 1) === dia ? tramo + 1 : 1;
    mayor = Math.max(mayor, tramo);
  });

  return { dias, actual, mayor, ultimoDia: ordenados[ordenados.length - 1] ?? null };
}

/** Primer día ya terminado que rompe la racha guardada; null si sigue viva. Hoy no cuenta: todavía puede tener aportes. */
export function diaDeRuptura(entrada: {
  rachaAnterior: number;
  ultimoDiaAnterior: string | null;
  dias: ReadonlySet<string>;
  hoy: string;
}): string | null {
  const { rachaAnterior, ultimoDiaAnterior, dias, hoy } = entrada;
  if (rachaAnterior <= 0 || !ultimoDiaAnterior) return null;
  for (let dia = sumarDias(ultimoDiaAnterior, 1 - rachaAnterior); dia < hoy; dia = sumarDias(dia, 1)) {
    if (!dias.has(dia)) return dia;
  }
  return null;
}
