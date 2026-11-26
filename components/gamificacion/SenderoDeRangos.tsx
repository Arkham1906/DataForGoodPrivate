"use client";

// Sendero de rangos de la Trayectoria (2026-11-12; prototipo A «Ventana del sendero», SRS v1.3: RF-GAM-22, 78 a 83).
// 2026-11-22 (pedido del responsable): el camino va de arriba abajo, del rango 1 al 20, y los 20 rangos están en un
// área con desplazamiento que abre centrada en el rango actual; «Ir a tu rango» vuelve a él. Así se recorre todo el
// camino completado sin tapas plegables (antes: ventana de 5 rangos, de abajo arriba, con el resto plegado).
//
// Cada fila es un solo botón (círculo + textos) que abre la ficha del rango (FichaDeRango, el estado vive en
// TrayectoriaDeRangos). Solo pinta lo que el servidor envió (RNF-GAM-14): un rango avistado u oculto no trae nombre.
// Las animaciones están en app/globals.css («Sendero de rangos») y respetan el movimiento reducido.

import { TEXTOS } from "@/lib/gamificacion/textos";
import Ayuda from "./Ayuda";
import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import type { EslabonDeLaTrayectoria, HitoDelRecorrido } from "@/lib/gamificacion/mi-progreso-tipos";
import type { EstadoDeRango } from "@/lib/gamificacion/rangos";
import AvatarDeGamificacion from "./AvatarDeGamificacion";

const nf = new Intl.NumberFormat("es-MX");

/** Alto del área con desplazamiento: unas cinco filas y media, así se nota que sigue. */
const ALTO_VISIBLE = 560;
/** Las filas lejanas aparecen todas a la vez: el retraso de entrada se corta en este número de filas. */
const RETRASO_MAXIMO = 6;
/** Alto de cada fila del camino y geometría del trazo, en px. */
const ALTO_DE_FILA = 104;
/** Aire arriba y abajo del camino, para que el halo del rango actual no toque el borde. */
const MARGEN = 14;
const CENTRO_X = 72;
const ONDA = 24;
const TAMANO: Record<EstadoDeRango, number> = { actual: 76, siguiente: 58, avistado: 50, alcanzado: 46, oculto: 40 };
/** Donde empiezan los textos: a la derecha del círculo más grande en su punto más alejado. */
const COLUMNA_DE_TEXTO = CENTRO_X + ONDA + TAMANO.actual / 2 + 18;
const ANCHO_DEL_TRAZO = CENTRO_X * 2;

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

/** El camino serpentea según el número del rango, así cada rango cae siempre en el mismo sitio. */
function xDe(numero: number): number {
  return CENTRO_X + Math.round(ONDA * Math.sin(numero * 0.9));
}

type Punto = { x: number; y: number };

/** Curva suave que une los puntos en orden, con tangentes verticales en cada uno. */
function curvaPor(puntos: Punto[]): string {
  if (puntos.length === 0) return "";
  let d = `M${puntos[0].x} ${puntos[0].y}`;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const medio = (a.y + b.y) / 2;
    d += ` C${a.x} ${medio} ${b.x} ${medio} ${b.x} ${b.y}`;
  }
  return d;
}

const CIRCULO: Record<EstadoDeRango, string> = {
  alcanzado: "bg-brand-700 text-white",
  actual: "bg-brand-950 text-white ring-4 ring-white shadow-[0_10px_24px_rgba(1,23,69,.35)]",
  siguiente: "border-[3px] border-brand-600 bg-white text-brand-700 shadow-[0_6px_16px_rgba(46,90,172,.25)]",
  avistado: "border-2 border-dashed border-system-400 bg-white text-system-700",
  oculto: "border-2 border-system-300 bg-white text-system-500",
};

const ANTETITULO: Record<EstadoDeRango, string> = {
  alcanzado: "text-success-800",
  actual: "text-brand-950",
  siguiente: "text-brand-600",
  avistado: "text-system-600",
  oculto: "text-system-600",
};

type Textos = { antes: string; titulo: string; nota: string | null };

function fechaDe(hito: HitoDelRecorrido | undefined): string {
  if (!hito?.fecha) return "";
  return hito.fecha === "hoy" ? "hoy" : `el ${hito.fecha}`;
}

function textosDe(e: EslabonDeLaTrayectoria, hito: HitoDelRecorrido | undefined, nombreActual: string, pista: string | null): Textos {
  const nombre = e.nombreCorto ? `Investigador ${e.nombreCorto}` : "Nombre por descubrir";
  switch (e.estado) {
    case "alcanzado":
      return { antes: `Rango ${e.numero}${hito?.fecha ? ` · ${hito.fecha}` : ""}`, titulo: nombre, nota: null };
    case "actual":
      return {
        antes: fechaDe(hito) ? `Estás aquí · desde ${fechaDe(hito)}` : "Estás aquí",
        titulo: nombreActual,
        // Presentación «completar tu rango» (2026-11-22): el avance es de tu rango, no del siguiente.
        nota: e.expQuePide === null ? TEXTOS.camino.notaUltimo : `Para completarlo cumples ${e.detalle}.`,
      };
    case "siguiente":
      return { antes: "Tu siguiente parada", titulo: nombre, nota: "Llegas cuando completes tu rango." };
    case "avistado":
      return {
        antes: `Rango ${e.numero} · a la vista`,
        titulo: pista ?? "Nombre por descubrir",
        nota: TEXTOS.camino.notaAvistado(e.numero - 1),
      };
    case "oculto":
      return { antes: `Rango ${e.numero}`, titulo: "Por descubrir", nota: null };
  }
}

function etiquetaDe(e: EslabonDeLaTrayectoria, textos: Textos): string {
  const estado = {
    alcanzado: "alcanzado",
    actual: e.expQuePide === null ? "tu rango actual, el último" : `tu rango actual, para completarlo cumples ${e.detalle}`,
    siguiente: "tu siguiente rango, llegas cuando completes el tuyo",
    avistado: "a la vista, con pista",
    oculto: "por descubrir",
  }[e.estado];
  const nombre = e.nombreCorto ? `Investigador ${e.nombreCorto}` : "nombre por descubrir";
  return `Rango ${e.numero}, ${nombre}, ${estado}${e.estado === "avistado" ? `: ${textos.titulo}` : ""}. ${e.expQuePide === null ? "Es el último rango" : `Completarlo pide ${nf.format(e.expQuePide)} EXP`}. Abre su ficha.`;
}

export default function SenderoDeRangos({
  actual,
  total,
  nombre,
  eslabones,
  recorrido,
  pista,
  onAbrir,
}: {
  actual: number;
  total: number;
  /** Nombre completo del rango actual. */
  nombre: string;
  eslabones: EslabonDeLaTrayectoria[];
  recorrido: HitoDelRecorrido[];
  /** Pista del rango avistado, si hay (RF-GAM-79). */
  pista: string | null;
  onAbrir: (numero: number) => void;
}) {
  // De arriba abajo: del rango 1 al último, como un camino que se recorre hacia adelante.
  const filas = [...eslabones].sort((a, b) => a.numero - b.numero);
  const hitoDe = (numero: number) => recorrido.find((h) => h.numero === numero);

  const alto = filas.length * ALTO_DE_FILA + MARGEN * 2;
  const puntos = new Map(filas.map((e, i) => [e.numero, { x: xDe(e.numero), y: MARGEN + ALTO_DE_FILA / 2 + i * ALTO_DE_FILA }]));
  const punto = (n: number): Punto => puntos.get(n) ?? { x: CENTRO_X, y: 0 };
  // Recorrido: del rango 1 al actual, en ese orden para que se dibuje bajando. Lo que falta, punteado.
  const hecho = curvaPor(filas.filter((e) => e.numero <= actual).map((e) => punto(e.numero)));
  const porVenir = curvaPor(filas.filter((e) => e.numero >= actual).map((e) => punto(e.numero)));

  const area = useRef<HTMLDivElement>(null);
  const irATuRango = useCallback(
    (suave: boolean) => {
      const caja = area.current;
      if (!caja) return;
      const top = Math.max(0, punto(actual).y - caja.clientHeight / 2);
      const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      caja.scrollTo({ top, behavior: suave && !reducido ? "smooth" : "auto" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- punto() depende solo de los eslabones y del actual
    [actual, eslabones],
  );
  // Abre centrado en el rango actual.
  useEffect(() => irATuRango(false), [irATuRango]);

  return (
    <section aria-labelledby="sendero-titulo" className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-system-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sendero-titulo" className="text-[15px] font-extrabold text-system-900">
          Tu sendero · rangos 1 a {total}
        </h2>
        <button
          type="button"
          onClick={() => irATuRango(true)}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-brand-200 bg-brand-50 px-3 text-[13px] font-bold text-brand-800 transition-colors duration-150 hover:bg-brand-100 ${FOCO}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          Ir a tu rango
        </button>
      </div>

      {/* El área se desplaza con la rueda, el dedo o el teclado (tabIndex: se puede enfocar y mover con las flechas). */}
      <div
        ref={area}
        tabIndex={0}
        role="region"
        aria-label={`Sendero de los ${total} rangos, del 1 arriba al ${total} abajo. Desplázate para recorrerlo.`}
        className={`relative overflow-y-auto overscroll-contain rounded-lg [mask-image:linear-gradient(to_bottom,transparent,black_20px,black_calc(100%-20px),transparent)] ${FOCO}`}
        style={{ maxHeight: `min(${ALTO_VISIBLE}px, 70vh)` }}
      >
        <ol aria-label={`Rangos 1 a ${total}`} className="relative" style={{ height: alto }}>
          <svg
            aria-hidden="true"
            width={ANCHO_DEL_TRAZO}
            height={alto}
            viewBox={`0 0 ${ANCHO_DEL_TRAZO} ${alto}`}
            className="sendero-entra pointer-events-none absolute top-0 left-0 overflow-visible"
          >
            <path d={porVenir} fill="none" className="stroke-system-300" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 12" />
            {hecho && <path className="sendero-trazo stroke-brand-600" pathLength={1} d={hecho} fill="none" strokeWidth="8" strokeLinecap="round" />}
          </svg>

          {filas.map((e) => {
            const { x, y } = punto(e.numero);
            const tamano = TAMANO[e.estado];
            const textos = textosDe(e, hitoDe(e.numero), nombre, e.estado === "avistado" ? pista : null);
            const esActual = e.estado === "actual";
            return (
              <li key={e.numero} className="absolute inset-x-0" style={{ top: y - ALTO_DE_FILA / 2, height: ALTO_DE_FILA }}>
                <button
                  type="button"
                  onClick={() => onAbrir(e.numero)}
                  aria-haspopup="dialog"
                  aria-current={esActual ? "step" : undefined}
                  aria-label={etiquetaDe(e, textos)}
                  className={`sendero-entra group relative block h-full w-full rounded-lg text-left ${FOCO} ${e.estado === "oculto" ? "opacity-70" : ""}`}
                  style={{ "--i": Math.min(RETRASO_MAXIMO, Math.abs(e.numero - actual)) } as CSSProperties}
                >
                  <span
                    aria-hidden="true"
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: x, top: ALTO_DE_FILA / 2, width: tamano, height: tamano }}
                  >
                    {esActual && <span className="sendero-halo absolute -inset-3 rounded-pill bg-brand-200 opacity-35" />}
                    <span
                      className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-pill text-[17px] font-extrabold transition-transform duration-150 ease-salida group-hover:scale-[1.06] group-active:scale-[0.97] motion-reduce:transition-none ${CIRCULO[e.estado]}`}
                    >
                      {esActual ? <AvatarDeGamificacion etapa={actual} tamano="md" /> : e.estado === "avistado" ? "?" : e.numero}
                    </span>
                    {esActual && (
                      <span className="absolute -right-1.5 -bottom-1 flex h-[26px] min-w-[26px] items-center justify-center rounded-pill border-2 border-white bg-success-700 px-1 text-[12px] font-extrabold text-white">
                        {e.numero}
                      </span>
                    )}
                  </span>
                  <span className="absolute top-1/2 right-2 -translate-y-1/2" style={{ left: COLUMNA_DE_TEXTO }}>
                    <span className={`block text-[12px] font-bold ${ANTETITULO[e.estado]}`}>{textos.antes}</span>
                    <span
                      className={`block font-extrabold leading-snug text-system-900 [overflow-wrap:anywhere] ${esActual || e.estado === "siguiente" ? "text-[17px] max-sm:text-[15px]" : "text-[14.5px]"}`}
                    >
                      {textos.titulo}
                    </span>
                    {/* En teléfono la nota no cabe: la tarjeta de tu rango y la ficha ya la dicen. */}
                    {textos.nota && <span className="block text-[12.5px] text-system-600 max-sm:hidden">{textos.nota}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="flex items-center gap-1 text-[12.5px] text-system-600">
        {TEXTOS.camino.guia}
        <Ayuda concepto="nombreOculto" />
      </p>
    </section>
  );
}

/** Banda superior de la Trayectoria: el rango actual, una frase de dónde estás y la barra de los 20 rangos. */
export function EncabezadoDeTrayectoria({ actual, total, nombre }: { actual: number; total: number; nombre: string }) {
  return (
    <section
      aria-labelledby="trayectoria-titulo"
      className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 rounded-lg bg-brand-950 px-7 py-6 text-white max-md:px-4 max-md:py-5"
    >
      <div className="min-w-0 flex-[1_1_360px]">
        <p className="text-[13px] font-semibold text-brand-300">
          Tu rango · {actual} de {total}
        </p>
        <h2 id="trayectoria-titulo" className="mt-1 text-[28px] font-extrabold leading-tight max-md:text-[22px]">
          {nombre}
        </h2>
        <p className="mt-1.5 max-w-xl text-[14.5px] text-brand-200 max-md:text-[13.5px]">{TEXTOS.camino.intro(actual, total)}</p>
      </div>
      <div className="flex min-w-[220px] flex-[0_1_300px] flex-col gap-2 max-md:min-w-0 max-md:flex-[1_1_100%]">
        <p className="flex justify-between text-[12.5px] text-brand-200">
          <span>Rangos alcanzados</span>
          <span className="font-mono font-bold text-white">
            {actual} / {total}
          </span>
        </p>
        <div aria-hidden="true" className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className={`h-2 rounded-sm ${n <= actual ? "bg-success-400" : n === actual + 1 ? "bg-brand-400" : "bg-brand-300/20"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
