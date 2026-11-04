"use client";

// Camino de rangos cercanos del bloque de rango (2026-11-04; diseño v10, RF-GAM-78): seis rangos alrededor del actual,
// cada uno como botón que abre su ficha, con «1 a 6» y «+8 por descubrir» en los extremos. Recibe solo lo que el
// servidor decidió enviar (RNF-GAM-14): un eslabón oculto no trae nombre, así que aquí no hay forma de mostrarlo.
// En pantallas angostas el camino se desplaza de lado. Aquí vive el estado de «qué ficha está abierta».

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { rutaDePantalla } from "@/lib/gamificacion/pantallas-de-progreso";
import type { CaminoDeRangos as DatosDelCamino, EslabonDelCamino } from "@/lib/gamificacion/mi-progreso-tipos";
import type { EstadoDeRango, FichaDeRango as DatosDeFicha } from "@/lib/gamificacion/rangos";
import FichaDeRango from "./FichaDeRango";
import InsigniaDeRango from "./InsigniaDeRango";

const ESTILO: Record<EstadoDeRango, { caja: string; tenue: string }> = {
  alcanzado: { caja: "border border-brand-800 bg-brand-900 text-brand-100", tenue: "text-brand-300" },
  actual: { caja: "border border-transparent bg-white text-brand-950 ring-4 ring-brand-300/20", tenue: "text-system-700" },
  siguiente: { caja: "border-2 border-dashed border-success-400 bg-brand-950 text-white", tenue: "text-brand-200" },
  avistado: { caja: "border-2 border-dashed border-brand-500 bg-brand-900 text-brand-100", tenue: "text-brand-300" },
  oculto: { caja: "border border-dashed border-brand-500 bg-brand-950 text-brand-200", tenue: "text-brand-200" },
};

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300";

function etiquetaDe(e: EslabonDelCamino): string {
  const nombre = e.nombreCorto ? `Investigador ${e.nombreCorto}` : "nombre por descubrir";
  const estado = { alcanzado: ", alcanzado", actual: ", tu rango actual", siguiente: ", siguiente", avistado: ", avistado", oculto: "" }[e.estado];
  return `Rango ${e.numero}, ${nombre}${estado}. Abre su ficha.`;
}

/** Los extremos del camino: llevan a la trayectoria cuando esa pantalla exista. */
function Extremo({ href, className, children }: { href: string | null; className: string; children: ReactNode }) {
  const clase = `relative flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg p-2.5 text-center text-[12px] font-bold ${className}`;
  return href ? (
    <Link href={href} className={`${clase} ${FOCO}`}>
      {children}
    </Link>
  ) : (
    <div className={clase}>{children}</div>
  );
}

export default function CaminoDeRangos({
  camino,
  fichas,
  total,
}: {
  camino: DatosDelCamino;
  fichas: DatosDeFicha[];
  total: number;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const trayectoria = rutaDePantalla("trayectoria");
  const { eslabones, antes, despues } = camino;
  const desplazable = useRef<HTMLDivElement>(null);
  const rangoActual = useRef<HTMLLIElement>(null);

  // En pantallas angostas el camino abre centrado en el rango actual, no en el primer eslabón.
  useEffect(() => {
    const caja = desplazable.current;
    const actual = rangoActual.current;
    if (!caja || !actual) return;
    const izquierda = actual.getBoundingClientRect().left - caja.getBoundingClientRect().left;
    caja.scrollLeft = izquierda - (caja.clientWidth - actual.offsetWidth) / 2;
  }, []);

  return (
    <>
      <div ref={desplazable} className="-m-1.5 overflow-x-auto p-1.5">
        <div className="relative flex min-w-[880px] items-stretch gap-2">
          <span aria-hidden="true" className="absolute inset-x-8 top-1/2 border-t-2 border-dashed border-brand-800" />
          {antes > 0 && (
            <Extremo href={trayectoria} className="bg-brand-900 text-brand-300">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>
                <span className="sr-only">Rangos alcanzados: </span>
                {antes > 1 ? `1 a ${antes}` : "Rango 1"}
              </span>
            </Extremo>
          )}
          <ol aria-label="Rangos cercanos" className="relative flex min-w-0 flex-1 gap-3">
            {eslabones.map((e) => {
              const estilo = ESTILO[e.estado];
              return (
                <li key={e.numero} ref={e.estado === "actual" ? rangoActual : undefined} className="flex min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setAbierta(e.numero)}
                    aria-haspopup="dialog"
                    aria-label={etiquetaDe(e)}
                    className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 pb-3 pt-3.5 text-center transition-transform active:scale-95 motion-reduce:transition-none ${FOCO} ${estilo.caja}`}
                  >
                    <span className="flex h-[62px] items-center">
                      <InsigniaDeRango numero={e.numero} estado={e.estado} tamano={e.estado === "actual" ? "md" : "sm"} />
                    </span>
                    <span className={`text-[11.5px] font-bold ${estilo.tenue}`}>Rango {e.numero}</span>
                    {e.nombreCorto ? (
                      <span className="text-[13px] font-extrabold leading-tight [overflow-wrap:anywhere]">{e.nombreCorto}</span>
                    ) : (
                      <span aria-hidden="true" className="my-1 h-2.5 w-14 rounded-pill bg-brand-300/40 blur-[2px]" />
                    )}
                    <span className={`text-[11.5px] ${estilo.tenue}`}>{e.detalle}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {despues > 0 && (
            <Extremo href={trayectoria} className="border-[1.5px] border-dashed border-brand-500 bg-brand-950 text-brand-200">
              <span className="text-xl font-extrabold">+{despues}</span>
              por descubrir
            </Extremo>
          )}
        </div>
      </div>
      <FichaDeRango fichas={fichas} abierta={abierta} total={total} onIr={setAbierta} onCerrar={() => setAbierta(null)} />
    </>
  );
}
