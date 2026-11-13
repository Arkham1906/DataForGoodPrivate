"use client";

// Columnas apiladas con las decisiones del revisor por día (2026-11-13, dashboard de /revisiones).
// Aceptados abajo en brand-600 y rechazados arriba en error-500: pareja validada con el validador de la guía
// de visualización (pasa daltonismo: ΔE 20 en protanopía; el verde de éxito con el rojo daba 3.3). Leyenda siempre
// visible, 2 px de separación entre segmentos y la punta de arriba redondeada. Al pasar el cursor por una columna
// sale el detalle del día; para teclado y lectores de pantalla, la misma información va en una tabla oculta.
// En móvil las etiquetas van un día sí y otro no (siempre la de hoy).

import { useState } from "react";
import type { DiaDeActividad } from "@/lib/revisiones/dashboard";

const nf = new Intl.NumberFormat("es-MX");
const fechaCorta = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const fechaLarga = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function fecha(dia: string) {
  return new Date(`${dia}T00:00:00Z`);
}

export default function GraficaDeDecisiones({ dias }: { dias: DiaDeActividad[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const tope = Math.max(1, ...dias.map((d) => d.aceptados + d.rechazados));
  const total = dias.reduce((suma, d) => suma + d.aceptados + d.rechazados, 0);
  const elegido = activo === null ? null : dias[activo];

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-system-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-brand-600" />
          Aceptados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-error-500" />
          Rechazados
        </span>
      </div>

      {total === 0 ? (
        <p className="rounded-lg bg-system-100 p-4 text-center text-[13px] text-system-600">
          Aún no decides aportes en estos {dias.length} días.
        </p>
      ) : (
        <div className="relative" aria-hidden="true" onMouseLeave={() => setActivo(null)}>
          {/* Una sola línea guía, la del máximo: recesiva. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-system-200" />
          <span className="pointer-events-none absolute -top-2 right-0 bg-white pl-1 font-mono text-[10.5px] text-system-500">
            {nf.format(tope)}
          </span>
          <div className="flex h-40 items-end gap-1 border-b border-system-300 sm:gap-1.5">
            {dias.map((d, i) => {
              const suma = d.aceptados + d.rechazados;
              return (
                <div
                  key={d.dia}
                  onMouseEnter={() => setActivo(i)}
                  className={`flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-[4px] ${activo === i ? "bg-system-100" : ""}`}
                >
                  {d.rechazados > 0 && (
                    <span
                      className={`block w-full bg-error-500 ${d.aceptados > 0 ? "border-b-2 border-white" : ""} rounded-t-[4px]`}
                      style={{ height: `${(d.rechazados / tope) * 100}%` }}
                    />
                  )}
                  {d.aceptados > 0 && (
                    <span
                      className={`block w-full bg-brand-600 ${d.rechazados > 0 ? "" : "rounded-t-[4px]"}`}
                      style={{ height: `${(d.aceptados / tope) * 100}%` }}
                    />
                  )}
                  {suma === 0 && <span className="block h-[2px] w-full bg-system-200" />}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1 sm:gap-1.5">
            {dias.map((d, i) => (
              <span
                key={d.dia}
                className={`min-w-0 flex-1 truncate text-center font-mono text-[10px] text-system-500 ${
                  (dias.length - 1 - i) % 2 === 1 ? "max-sm:invisible" : ""
                }`}
              >
                {fecha(d.dia).getUTCDate()}
              </span>
            ))}
          </div>

          {elegido && activo !== null && (
            // Al lado de la columna (a la izquierda en la mitad derecha), para no tapar la barra que se está viendo.
            <div
              className="pointer-events-none absolute top-6 z-10 w-44 rounded-lg border border-system-200 bg-white p-2.5 text-[12px] shadow-md"
              style={
                (activo + 0.5) / dias.length > 0.5
                  ? { right: `calc(${100 - (activo / dias.length) * 100}% + 6px)` }
                  : { left: `calc(${((activo + 1) / dias.length) * 100}% + 6px)` }
              }
            >
              <p className="mb-1 font-semibold text-system-900 first-letter:uppercase">{fechaLarga.format(fecha(elegido.dia))}</p>
              <p className="flex items-center justify-between gap-2 text-system-700">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-brand-600" />
                  Aceptados
                </span>
                <span className="font-mono">{nf.format(elegido.aceptados)}</span>
              </p>
              <p className="flex items-center justify-between gap-2 text-system-700">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-error-500" />
                  Rechazados
                </span>
                <span className="font-mono">{nf.format(elegido.rechazados)}</span>
              </p>
            </div>
          )}
        </div>
      )}

      <table className="sr-only">
        <caption>Tus decisiones por día, últimos {dias.length} días</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Aceptados</th>
            <th scope="col">Rechazados</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.dia}>
              <th scope="row">{fechaCorta.format(fecha(d.dia))}</th>
              <td>{d.aceptados}</td>
              <td>{d.rechazados}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
