// EXP reciente del Resumen de Mi progreso;

import Link from "next/link";
import type { MovimientoDeExp } from "@/lib/gamificacion/historial-exp-tipos";
import { ZONA_DE_CAMPANAS } from "@/lib/fecha-de-tepic";
import { TEXTOS } from "@/lib/gamificacion/textos";

const T = TEXTOS.resumen.exp;
const H = TEXTOS.historialDeExp;
const nf = new Intl.NumberFormat("es-MX");
const FECHA = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_DE_CAMPANAS, day: "numeric", month: "short" });

function tituloDe(m: MovimientoDeExp): string {
  if (m.tipo === "mision") return m.mision ? H.periodicidad(m.mision.periodicidad) : H.tipos.mision;
  return H.tipos[m.tipo];
}

function detalleDe(m: MovimientoDeExp): string | null {
  if (m.tipo === "mision") return m.mision?.nombre ?? m.motivo;
  return m.campana?.nombre ?? m.motivo;
}

export default function ExpReciente({ movimientos, enlace }: { movimientos: MovimientoDeExp[]; enlace: string | null }) {
  return (
    <section aria-labelledby="resumen-exp" className="flex min-w-0 flex-col gap-2 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="resumen-exp" className="text-lg font-extrabold text-system-900">
          {T.titulo}
        </h2>
        {enlace && (
          <Link href={enlace} className="text-[13px] font-semibold text-brand-700 hover:underline">
            {T.verHistorial}
          </Link>
        )}
      </div>
      {movimientos.length === 0 ? (
        <p className="text-[13px] text-system-600">{T.vacio}</p>
      ) : (
        <ul className="divide-y divide-system-100">
          {movimientos.map((m) => {
            const detalle = detalleDe(m);
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13.5px] font-bold text-system-900">{tituloDe(m)}</span>
                  <span className="truncate text-[12.5px] text-system-600">
                    {detalle ? `${detalle} · ` : ""}
                    {FECHA.format(new Date(m.creadoEn)).replace(/\./g, "")}
                  </span>
                </span>
                <span className={`shrink-0 font-mono text-sm font-extrabold ${m.exp < 0 ? "text-error-700" : "text-success-800"}`}>
                  {m.exp > 0 ? "+" : ""}
                  {nf.format(m.exp)} EXP
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
