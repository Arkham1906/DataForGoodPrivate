"use client";

// Cabecera de la Trayectoria (2026-11-10; diseño v11, SRS v1.3: RF-GAM-22, 78): el rango actual, la barra de rangos
// alcanzados y el camino de los 20 rangos. Cada tarjeta es un botón que abre su ficha (el estado de la ficha lo lleva
// TrayectoriaDeRangos). En escritorio es una pista horizontal con ‹ › e «Ir a mi rango»; en teléfono los rangos se
// agrupan en tramos de 5 que solo ordenan la lista y no tienen nombre ni reglas (anexo B).
//
// Solo pinta lo que el servidor envió (RNF-GAM-14): un eslabón avistado o por descubrir no trae nombre.

import { useEffect, useRef, useState } from "react";
import { RANGOS_POR_TRAMO, type EslabonDeLaTrayectoria } from "@/lib/gamificacion/mi-progreso-tipos";
import type { EstadoDeRango } from "@/lib/gamificacion/rangos";
import InsigniaDeRango from "./InsigniaDeRango";

const nf = new Intl.NumberFormat("es-MX");

/** Ancho de una tarjeta del camino y separación entre tarjetas, en px. */
const ANCHO = 168;
const SEPARACION = 12;

const ESTILO: Record<EstadoDeRango, { caja: string; tenue: string }> = {
  alcanzado: { caja: "border border-brand-800 bg-brand-900 text-brand-100", tenue: "text-brand-300" },
  actual: { caja: "border border-transparent bg-white text-brand-950 ring-[6px] ring-brand-300/25", tenue: "text-system-700" },
  siguiente: { caja: "border-2 border-dashed border-success-400 bg-brand-950 text-white", tenue: "text-brand-200" },
  avistado: { caja: "border-2 border-dashed border-brand-500 bg-brand-900 text-brand-100", tenue: "text-brand-300" },
  oculto: { caja: "border-[1.5px] border-dashed border-brand-800 bg-transparent text-brand-200", tenue: "text-brand-300" },
};

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300";

function etiquetaDe(e: EslabonDeLaTrayectoria): string {
  const nombre = e.nombreCorto ? `Investigador ${e.nombreCorto}` : "nombre por descubrir";
  const estado = {
    alcanzado: `alcanzado: ${e.detalle}`,
    actual: "tu rango actual",
    siguiente: `siguiente, cumples ${e.detalle}`,
    avistado: "avistado, con pista",
    oculto: "por descubrir",
  }[e.estado];
  return `Rango ${e.numero}, ${nombre}, ${estado}, pide ${nf.format(e.expQuePide)} EXP. Abre su ficha.`;
}

function introDe(actual: number, total: number): string {
  // Texto aprobado para la cuenta nueva (v11): el rango 2 pide un aporte aceptado (tabla 4.3).
  if (actual === 1 && total > 2) return "Tu primer aporte aceptado te lleva al rango 2. Los demás se revelan conforme avanzas.";
  if (actual >= total) return `Llegaste al último rango. Ya puedes ver los ${total} completos.`;
  if (actual === total - 1) return `Del rango ${total}, el último, ya puedes ver todo.`;
  const resto = actual + 3 <= total ? " Los demás se revelan conforme avanzas." : "";
  return `Del rango ${actual + 1} ya puedes ver todo y del ${actual + 2}, una pista.${resto}`;
}

function Nombre({ eslabon, clase }: { eslabon: EslabonDeLaTrayectoria; clase: string }) {
  return eslabon.nombreCorto ? (
    <span className={`font-extrabold leading-tight [overflow-wrap:anywhere] ${clase}`}>{eslabon.nombreCorto}</span>
  ) : (
    <span aria-hidden="true" className="my-1 inline-block h-2.5 w-[72px] rounded-pill bg-brand-300/40 blur-[2px]" />
  );
}

function Flecha({ lado }: { lado: "izquierda" | "derecha" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={lado === "izquierda" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}

/** Desplaza la pista para que la tarjeta del rango quede al centro. */
function centrarEn(caja: HTMLDivElement | null, numero: number, suave: boolean) {
  const item = caja?.querySelector<HTMLElement>(`[data-rango="${numero}"]`);
  if (!caja || !item) return;
  const desdeElInicio = item.getBoundingClientRect().left - caja.getBoundingClientRect().left + caja.scrollLeft;
  const izquierda = desdeElInicio - (caja.clientWidth - item.offsetWidth) / 2;
  caja.scrollTo({ left: Math.max(0, izquierda), behavior: suave ? "smooth" : "auto" });
}

const BOTON_OSCURO = `inline-flex min-h-11 items-center justify-center gap-2 rounded-pill border border-brand-200/35 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10 ${FOCO}`;

export default function CaminoDeLaTrayectoria({
  actual,
  total,
  nombre,
  eslabones,
  onAbrir,
}: {
  actual: number;
  total: number;
  /** Nombre del rango actual. */
  nombre: string;
  eslabones: EslabonDeLaTrayectoria[];
  onAbrir: (numero: number) => void;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const [tramo, setTramo] = useState(() => Math.ceil(actual / RANGOS_POR_TRAMO));
  const tramos = Array.from({ length: Math.ceil(total / RANGOS_POR_TRAMO) }, (_, i) => i + 1);
  const delTramo = eslabones.filter((e) => Math.ceil(e.numero / RANGOS_POR_TRAMO) === tramo);

  const sinMovimiento = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const centrar = (numero: number, suave: boolean) => centrarEn(pista.current, numero, suave && !sinMovimiento());

  // El camino abre centrado en el rango actual, no en el rango 1.
  useEffect(() => {
    centrarEn(pista.current, actual, false);
  }, [actual]);

  const mover = (dx: number) => pista.current?.scrollBy({ left: dx, behavior: sinMovimiento() ? "auto" : "smooth" });

  return (
    <section aria-labelledby="trayectoria-titulo" className="flex flex-col gap-5 rounded-lg bg-brand-950 p-7 text-white max-md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-[1_1_380px]">
          <p className="text-[13px] font-semibold text-brand-300">
            Tu rango · {actual} de {total}
          </p>
          <h2 id="trayectoria-titulo" className="mt-1 text-[30px] font-extrabold leading-tight max-md:text-[23px]">
            {nombre}
          </h2>
          <p className="mt-2.5 max-w-xl text-[15px] text-brand-200 max-md:text-[13.5px]">{introDe(actual, total)}</p>
        </div>
        <div className="flex min-w-[240px] flex-[0_1_300px] flex-col gap-2 max-md:min-w-0 max-md:flex-[1_1_100%]">
          <p className="flex justify-between text-[12.5px] text-brand-200">
            <span>Rangos alcanzados</span>
            <span className="font-mono font-bold text-white">
              {actual} / {total}
            </span>
          </p>
          <div aria-hidden="true" className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {eslabones.map((e) => (
              <span
                key={e.numero}
                className={`h-2 rounded-sm ${e.numero < actual ? "bg-brand-300" : e.numero === actual ? "bg-white" : "bg-brand-300/20"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Escritorio: pista horizontal con los 20 rangos. */}
      <div className="hidden flex-col gap-3.5 md:flex">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-brand-300">Toca un rango para ver su ficha.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => mover(-540)} aria-label="Rangos anteriores" className={`${BOTON_OSCURO} w-11 px-0`}>
              <Flecha lado="izquierda" />
            </button>
            <button type="button" onClick={() => mover(540)} aria-label="Rangos siguientes" className={`${BOTON_OSCURO} w-11 px-0`}>
              <Flecha lado="derecha" />
            </button>
            <button type="button" onClick={() => centrar(actual, true)} className={BOTON_OSCURO}>
              Ir a mi rango
            </button>
          </div>
        </div>
        <div ref={pista} className="-mx-7 snap-x snap-proximity overflow-x-auto px-7 pt-1.5 pb-2.5">
          <div className="relative" style={{ width: total * ANCHO + (total - 1) * SEPARACION }}>
            <span
              aria-hidden="true"
              className="absolute top-[58px] border-t-2 border-dashed border-brand-800"
              style={{ left: ANCHO / 2, right: ANCHO / 2 }}
            />
            <span
              aria-hidden="true"
              className="absolute top-[57px] h-1 rounded-pill bg-brand-300"
              style={{ left: ANCHO / 2, width: (actual - 1) * (ANCHO + SEPARACION) }}
            />
            <ol aria-label={`Los ${total} rangos`} className="relative flex" style={{ gap: SEPARACION }}>
              {eslabones.map((e) => {
                const estilo = ESTILO[e.estado];
                return (
                  <li key={e.numero} data-rango={e.numero} className="shrink-0 snap-center" style={{ width: ANCHO }}>
                    <button
                      type="button"
                      onClick={() => onAbrir(e.numero)}
                      aria-haspopup="dialog"
                      aria-label={etiquetaDe(e)}
                      className={`flex h-[212px] w-full flex-col items-center gap-1 rounded-lg px-3 pt-[18px] pb-3.5 text-center transition-transform active:scale-[.97] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none ${FOCO} ${estilo.caja}`}
                    >
                      <span className="mb-1.5 flex h-[60px] items-center">
                        <InsigniaDeRango numero={e.numero} estado={e.estado} tamano={e.estado === "actual" ? "md" : "sm"} />
                      </span>
                      <span className={`text-[12px] font-bold ${estilo.tenue}`}>Rango {e.numero}</span>
                      <Nombre eslabon={e} clase="text-base" />
                      <span className={`text-[12.5px] ${estilo.tenue}`}>{e.detalle}</span>
                      <span className={`mt-auto font-mono text-[12px] font-semibold ${estilo.tenue}`}>{nf.format(e.expQuePide)} EXP</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      {/* Teléfono: tramos de 5 que solo agrupan la lista (anexo B). */}
      <div className="flex flex-col gap-3 md:hidden">
        <div role="group" aria-label={`Grupos de ${RANGOS_POR_TRAMO} rangos`} className="flex gap-1 rounded-xl bg-brand-900 p-1">
          {tramos.map((t) => {
            const desde = (t - 1) * RANGOS_POR_TRAMO + 1;
            const hasta = Math.min(total, t * RANGOS_POR_TRAMO);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={t === tramo}
                onClick={() => setTramo(t)}
                className={`min-h-11 flex-1 rounded-[10px] text-[13px] font-bold ${FOCO} ${t === tramo ? "bg-white text-brand-950" : "text-brand-200"}`}
              >
                <span className="sr-only">Rangos </span>
                {desde}–{hasta}
              </button>
            );
          })}
        </div>
        <ol aria-label={`Rangos del tramo ${tramo}`} className="flex flex-col gap-2">
          {delTramo.map((e) => {
            const estilo = ESTILO[e.estado];
            return (
              <li key={e.numero}>
                <button
                  type="button"
                  onClick={() => onAbrir(e.numero)}
                  aria-haspopup="dialog"
                  aria-label={etiquetaDe(e)}
                  className={`grid min-h-16 w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2.5 text-left ${FOCO} ${estilo.caja}`}
                >
                  <InsigniaDeRango numero={e.numero} estado={e.estado} tamano="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className={`text-[11.5px] font-bold ${estilo.tenue}`}>Rango {e.numero}</span>
                    <Nombre eslabon={e} clase="text-[15px]" />
                    <span className={`text-[12px] ${estilo.tenue}`}>{e.detalle}</span>
                  </span>
                  <span className={`font-mono text-[11.5px] font-semibold ${estilo.tenue}`}>{nf.format(e.expQuePide)} EXP</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
