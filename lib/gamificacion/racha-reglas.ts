// Reglas de la racha (2026-11-04; SRS v1.3: RF-GAM-25, 27, 31). Lógica pura, sin base de datos ni reloj propio. Un día
// cuenta en cuanto se envía un aporte, sea cual sea el resultado de su revisión, y ya no se pierde: ni el rechazo ni la
// eliminación del aporte lo descuentan.
//
// Protectores (2026-11-20; SRS v1.4: RF-GAM-28, decisión del responsable del 19 nov): un día sin aportes cubierto por un
// protector une la racha, pero no suma. Lunes y martes con aportes, miércoles protegido y jueves con aporte: racha de 3.

export type RachaCalculada = {
  /** Días con aporte: los que suman. */
  dias: Set<string>;
  /** Días con aporte y días protegidos: los que mantienen la racha. */
  cubiertos: Set<string>;
  actual: number;
  /** Primer día con aporte de la racha actual; null sin racha. */
  inicio: string | null;
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
  /** Días cubiertos por un protector: unen la racha, pero no suman (decisión del 19 nov). */
  diasProtegidos?: readonly string[];
  /** YYYY-MM-DD. */
  hoy: string;
}): RachaCalculada {
  const { diasConAporte, diasGuardados, diasProtegidos = [], hoy } = entrada;
  const dias = new Set([...diasConAporte, ...diasGuardados]);
  const cubiertos = new Set([...dias, ...diasProtegidos]);

  // Hoy aún puede contar: si no tiene aportes, la racha sigue viva desde ayer. Los días protegidos se cruzan sin sumar.
  let actual = 0;
  let inicio: string | null = null;
  let cursor = cubiertos.has(hoy) ? hoy : sumarDias(hoy, -1);
  while (cubiertos.has(cursor)) {
    if (dias.has(cursor)) {
      actual++;
      inicio = cursor;
    }
    cursor = sumarDias(cursor, -1);
  }

  const ordenados = [...cubiertos].sort();
  let mayor = 0;
  let tramo = 0;
  ordenados.forEach((dia, i) => {
    if (i > 0 && sumarDias(ordenados[i - 1], 1) !== dia) tramo = 0;
    if (dias.has(dia)) tramo++;
    mayor = Math.max(mayor, tramo);
  });

  const conAporte = [...dias].sort();
  return { dias, cubiertos, actual, inicio: actual > 0 ? inicio : null, mayor, ultimoDia: conAporte[conAporte.length - 1] ?? null };
}

/**
 * Días terminados sin aportes que un protector debe cubrir (RF-GAM-28): los que siguen al último día cubierto, en orden,
 * mientras la racha siga viva y queden protectores. Si faltan más días que protectores, se cubren los primeros y la
 * racha se rompe en el siguiente, como dice el SRS. Hoy no cuenta: todavía puede tener aportes.
 */
export function diasAProteger(entrada: { racha: RachaCalculada; hoy: string; protectores: number }): string[] {
  const { racha, hoy, protectores } = entrada;
  const anteriores = [...racha.cubiertos].filter((d) => d < hoy).sort();
  const ultimo = anteriores[anteriores.length - 1];
  if (!ultimo || protectores <= 0) return [];
  // La racha que llegaba a ese día debe tener al menos un día con aporte.
  let viva = false;
  for (let d = ultimo; racha.cubiertos.has(d); d = sumarDias(d, -1)) {
    if (racha.dias.has(d)) {
      viva = true;
      break;
    }
  }
  if (!viva) return [];
  const proteger: string[] = [];
  for (let d = sumarDias(ultimo, 1); d < hoy && proteger.length < protectores; d = sumarDias(d, 1)) proteger.push(d);
  return proteger;
}

/**
 * Primer día ya terminado, después del último con aporte, que no está cubierto: ahí se rompió la racha guardada. null si
 * sigue viva. Hoy no cuenta: todavía puede tener aportes.
 */
export function diaDeRuptura(entrada: {
  rachaAnterior: number;
  ultimoDiaAnterior: string | null;
  cubiertos: ReadonlySet<string>;
  hoy: string;
}): string | null {
  const { rachaAnterior, ultimoDiaAnterior, cubiertos, hoy } = entrada;
  if (rachaAnterior <= 0 || !ultimoDiaAnterior) return null;
  for (let dia = sumarDias(ultimoDiaAnterior, 1); dia < hoy; dia = sumarDias(dia, 1)) {
    if (!cubiertos.has(dia)) return dia;
  }
  return null;
}
