"use client";

// Gráfica de columnas por tiempo (2026-11-22, a pedido del usuario: todas las gráficas con su fecha y con
// histórico). La comparten /aportes/dashboard, /usuarios/dashboard, el panel de una campaña (creador,
// supervisión y SuperUsuario) y los dashboards del revisor y del supervisor. Los datos salen de
// serieDeTiempo() (lib/series-de-tiempo.ts): una cubeta por hora, día, semana, mes o año.
// - Eje Y con cifras redondas (0, la mitad y el tope) y líneas guía punteadas, recesivas.
// - Bajo las columnas, su fecha ("9:00", "9 nov", "nov", "2026") con el año (o, por hora, el día) en la primera
//   que se ve y donde cambia. Si no
//   caben todas, se ven cada cierta cantidad (12 en escritorio, 6 en el teléfono), siempre la última.
// - Una o dos series apiladas (brand-600 y error-500, la pareja ya validada para daltonismo en
//   la gráfica del revisor el 2026-11-13); con dos, leyenda. 2 px de separación entre segmentos y la punta redondeada.
// - Al pasar el cursor por una columna, su detalle (fecha completa y cada valor). Para el lector de pantalla, los
//   mismos datos en una tabla oculta (sr-only). "Ver los datos", la tabla visible, se quitó a pedido del usuario.

import { useState } from "react";
import type { SerieDeTiempo } from "@/lib/periodo";

const nf = new Intl.NumberFormat("es-MX");

export type SerieDeLaGrafica = { nombre: string; color: "brand" | "error" };

const COLOR: Record<SerieDeLaGrafica["color"], string> = { brand: "bg-brand-600", error: "bg-error-500" };

const ETIQUETAS_EN_ESCRITORIO = 12;
const ETIQUETAS_EN_TELEFONO = 6;

/** Tope redondo del eje: 1, 2, 5, 10, 20, 50... */
function topeRedondo(maximo: number): number {
  if (maximo <= 1) return 1;
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  for (const paso of [1, 2, 5, 10]) if (paso * potencia >= maximo) return paso * potencia;
  return 10 * potencia;
}

/** Qué columnas llevan fecha: cada `paso` contando desde la última, para que siempre se vea la más reciente. */
function visibles(total: number, maximo: number): boolean[] {
  const paso = Math.max(1, Math.ceil(total / maximo));
  return Array.from({ length: total }, (_, i) => (total - 1 - i) % paso === 0);
}

/** El año va bajo la primera fecha visible y bajo cada una cuyo año cambia respecto a la anterior visible. */
function conAnio(anios: string[], visible: boolean[]): boolean[] {
  let anterior: string | null = null;
  return anios.map((anio, i) => {
    if (!visible[i] || !anio) return false;
    const mostrar = anio !== anterior;
    anterior = anio;
    return mostrar;
  });
}

export default function GraficaDeTiempo({
  serie,
  series,
  descripcion,
  vacio,
}: {
  serie: SerieDeTiempo;
  series: SerieDeLaGrafica[];
  /** Qué muestra, para la tabla y el lector de pantalla: "Aportes recibidos por día". */
  descripcion: string;
  /** Texto cuando el periodo no tiene ningún dato. */
  vacio: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const cubetas = serie.cubetas;
  const total = cubetas.reduce((suma, c) => suma + c.valores.reduce((s, v) => s + v, 0), 0);
  const tope = topeRedondo(Math.max(0, ...cubetas.map((c) => c.valores.reduce((s, v) => s + v, 0))));
  const marcas = tope % 2 === 0 ? [tope, tope / 2, 0] : [tope, 0];
  const enEscritorio = visibles(cubetas.length, ETIQUETAS_EN_ESCRITORIO);
  const enTelefono = visibles(cubetas.length, ETIQUETAS_EN_TELEFONO);
  const anios = cubetas.map((c) => c.anio);
  const anioEnEscritorio = conAnio(anios, enEscritorio);
  const anioEnTelefono = conAnio(anios, enTelefono);
  const elegido = activo === null ? null : cubetas[activo];
  const separacion = cubetas.length > 40 ? 1 : cubetas.length > 20 ? 2 : 4;

  return (
    <figure className="m-0">
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-system-600">
          {series.map((s) => (
            <span key={s.nombre} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={`size-2.5 rounded-sm ${COLOR[s.color]}`} />
              {s.nombre}
            </span>
          ))}
        </div>
      )}

      {total === 0 ? (
        <p className="rounded-lg bg-system-100 p-4 text-center text-[13px] text-system-600">{vacio}</p>
      ) : (
        <div className="flex gap-2" aria-hidden="true">
          {/* Eje Y: cifras redondas, alineadas con sus líneas guía. */}
          <div className="relative h-40 w-8 shrink-0 font-mono text-[10.5px] tabular-nums text-system-500">
            {marcas.map((m) => (
              <span key={m} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - m / tope) * 100}%` }}>
                {nf.format(m)}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1" onMouseLeave={() => setActivo(null)}>
            {marcas
              .filter((m) => m > 0)
              .map((m) => (
                <div
                  key={m}
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-system-200"
                  // h-40 = 160 px: la línea queda a la altura de su cifra en el eje.
                  style={{ top: `${(1 - m / tope) * 160}px` }}
                />
              ))}
            <div className="relative flex h-40 items-end border-b border-system-300" style={{ gap: `${separacion}px` }}>
              {cubetas.map((c, i) => {
                const suma = c.valores.reduce((s, v) => s + v, 0);
                // De abajo hacia arriba: la primera serie abajo. La de más arriba lleva la punta redondeada.
                const ultima = c.valores.reduce((u, v, k) => (v > 0 ? k : u), -1);
                return (
                  <div
                    key={c.inicio}
                    onMouseEnter={() => setActivo(i)}
                    className={`flex h-full min-w-0 flex-1 flex-col-reverse justify-start rounded-t-[4px] ${activo === i ? "bg-system-100" : ""}`}
                  >
                    {suma === 0 ? (
                      <span className="block h-[2px] w-full bg-system-200" />
                    ) : (
                      c.valores.map((v, k) =>
                        v > 0 ? (
                          <span
                            key={k}
                            className={`block w-full ${COLOR[series[k]?.color ?? "brand"]} ${k === ultima ? "rounded-t-[4px]" : "border-t-2 border-white"}`}
                            style={{ height: `${(v / tope) * 100}%` }}
                          />
                        ) : null,
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {/* Fechas bajo las columnas; las que no caben se omiten, pero están en el detalle y en la tabla. */}
            <div className="relative mt-1.5 h-8">
              {cubetas.map((c, i) => {
                if (!enEscritorio[i] && !enTelefono[i]) return null;
                const centro = ((i + 0.5) / cubetas.length) * 100;
                const alineacion = centro < 6 ? "translate-x-0 text-left" : centro > 94 ? "-translate-x-full text-right" : "-translate-x-1/2 text-center";
                const visibilidad = enEscritorio[i] && enTelefono[i] ? "" : enEscritorio[i] ? "max-sm:hidden" : "sm:hidden";
                return (
                  <span
                    key={c.inicio}
                    className={`absolute top-0 whitespace-nowrap font-mono text-[10px] leading-4 text-system-500 ${alineacion} ${visibilidad}`}
                    style={{ left: centro < 6 ? 0 : centro > 94 ? "100%" : `${centro}%` }}
                  >
                    {c.eje}
                    {(anioEnEscritorio[i] || anioEnTelefono[i]) && (
                      <span
                        className={`block font-semibold text-system-600 ${
                          anioEnEscritorio[i] && anioEnTelefono[i] ? "" : anioEnEscritorio[i] ? "max-sm:hidden" : "sm:hidden"
                        }`}
                      >
                        {c.anio}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>

            {elegido && activo !== null && (
              // Al lado de la columna (a la izquierda en la mitad derecha), para no tapar la que se está viendo.
              <div
                className="pointer-events-none absolute top-4 z-10 w-52 rounded-lg border border-system-200 bg-white p-2.5 text-[12px] shadow-md"
                style={
                  (activo + 0.5) / cubetas.length > 0.5
                    ? { right: `calc(${100 - (activo / cubetas.length) * 100}% + 6px)` }
                    : { left: `calc(${((activo + 1) / cubetas.length) * 100}% + 6px)` }
                }
              >
                <p className="mb-1 font-semibold text-system-900">{elegido.detalle}</p>
                {series.map((s, k) => (
                  <p key={s.nombre} className="flex items-center justify-between gap-2 text-system-700">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-0.5 w-3 rounded-full ${COLOR[s.color]}`} />
                      {s.nombre}
                    </span>
                    <span className="font-mono font-semibold text-system-900">{nf.format(elegido.valores[k] ?? 0)}</span>
                  </p>
                ))}
                {series.length > 1 && (
                  <p className="mt-1 flex justify-between gap-2 border-t border-system-200 pt-1 text-system-600">
                    <span>Total</span>
                    <span className="font-mono">{nf.format(elegido.valores.reduce((s, v) => s + v, 0))}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Solo para el lector de pantalla: las columnas van con aria-hidden. "Ver los datos" (la tabla visible) se
          quitó el 2026-11-22 a pedido del usuario. */}
      <table className="sr-only">
        <caption>{descripcion}</caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            {series.map((s) => (
              <th key={s.nombre} scope="col">
                {s.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cubetas.map((c) => (
            <tr key={c.inicio}>
              <th scope="row">{c.detalle}</th>
              {c.valores.map((v, k) => (
                <td key={k}>{nf.format(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
