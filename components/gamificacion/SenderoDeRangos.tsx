"use client";

// Sendero de rangos de la Trayectoria (2026-11-12; prototipo A «Ventana del sendero», SRS v1.3: RF-GAM-22, 78 a 83).
// En lugar de los 20 rangos en fila, muestra una ventana del camino centrada en el rango actual: dos rangos abajo,
// el actual, el siguiente y el avistado. Lo que queda fuera se pliega en dos tapas: «ya son tuyos» abajo y «por
// descubrir» arriba, con un botón por rango que abre su ficha. Así la pantalla cabe sin desplazarse y siempre abre
// donde está la persona.
//
// Cada fila es un solo botón (círculo + textos) que abre la ficha del rango (FichaDeRango, el estado vive en
// TrayectoriaDeRangos). Solo pinta lo que el servidor envió (RNF-GAM-14): un rango avistado u oculto no trae nombre.
// Las animaciones están en app/globals.css («Sendero de rangos») y respetan el movimiento reducido.

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import type { EslabonDeLaTrayectoria, HitoDelRecorrido } from "@/lib/gamificacion/mi-progreso-tipos";
import type { EstadoDeRango } from "@/lib/gamificacion/rangos";
import AvatarDeGamificacion from "./AvatarDeGamificacion";

const nf = new Intl.NumberFormat("es-MX");

/** Rangos que se ven a cada lado del actual (la ventana mide hasta 2 × VECINOS + 1). */
const VECINOS = 2;
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
        nota: "Este rango es tuyo para siempre.",
      };
    case "siguiente":
      return { antes: "Tu siguiente parada", titulo: nombre, nota: `Cumples ${e.detalle}.` };
    case "avistado":
      return {
        antes: `Rango ${e.numero} · a la vista`,
        titulo: pista ?? "Nombre por descubrir",
        nota: `Su nombre aparece cuando llegues al rango ${e.numero - 1}.`,
      };
    case "oculto":
      return { antes: `Rango ${e.numero}`, titulo: "Por descubrir", nota: null };
  }
}

function etiquetaDe(e: EslabonDeLaTrayectoria, textos: Textos): string {
  const estado = {
    alcanzado: "alcanzado",
    actual: "tu rango actual",
    siguiente: `tu siguiente rango, cumples ${e.detalle}`,
    avistado: "a la vista, con pista",
    oculto: "por descubrir",
  }[e.estado];
  const nombre = e.nombreCorto ? `Investigador ${e.nombreCorto}` : "nombre por descubrir";
  return `Rango ${e.numero}, ${nombre}, ${estado}${e.estado === "avistado" ? `: ${textos.titulo}` : ""}. Pide ${nf.format(e.expQuePide)} EXP. Abre su ficha.`;
}

function Chevron({ abierta, hacia }: { abierta: boolean; hacia: "arriba" | "abajo" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-4 w-4 transition-transform duration-200 ease-salida motion-reduce:transition-none ${abierta ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={hacia === "arriba" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

/**
 * Tapa plegable de los rangos que quedan fuera de la ventana. Se despliega con grid-template-rows (0fr → 1fr): es
 * el único caso en que se anima una altura, porque no hay transformación que la sustituya. Cerrada queda `inert`.
 */
function Tapa({
  titulo,
  resumen,
  hacia,
  tono,
  children,
}: {
  titulo: string;
  resumen: ReactNode;
  hacia: "arriba" | "abajo";
  tono: "neutro" | "logro";
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  const boton = (
    <button
      type="button"
      onClick={() => setAbierta((a) => !a)}
      aria-expanded={abierta}
      aria-controls={id}
      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-[14px] px-4 py-2.5 text-left text-[13.5px] font-bold transition-colors duration-150 ${FOCO} ${
        tono === "logro"
          ? "border border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100"
          : "border border-dashed border-system-300 bg-system-50 text-system-700 hover:border-system-400 hover:text-system-900"
      }`}
    >
      <span>{titulo}</span>
      <span className="flex items-center gap-2 font-semibold">
        {resumen}
        <Chevron abierta={abierta} hacia={hacia} />
      </span>
    </button>
  );
  const contenido = (
    <div
      id={id}
      inert={!abierta}
      className={`grid transition-[grid-template-rows] duration-200 ease-salida motion-reduce:transition-none ${abierta ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={`px-1 py-2.5 transition-[opacity,translate] duration-200 ease-salida motion-reduce:translate-y-0 motion-reduce:transition-opacity ${
            abierta ? "translate-y-0 opacity-100" : `opacity-0 ${hacia === "arriba" ? "translate-y-1" : "-translate-y-1"}`
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
  // La de arriba se despliega hacia abajo, hacia el camino; la de abajo, hacia arriba.
  return hacia === "arriba" ? (
    <div>
      {boton}
      {contenido}
    </div>
  ) : (
    <div>
      {contenido}
      {boton}
    </div>
  );
}

/** Botón redondo de un rango fuera de la ventana. */
function Ficha({ numero, alcanzado, etiqueta, onAbrir }: { numero: number; alcanzado: boolean; etiqueta: string; onAbrir: (n: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(numero)}
      aria-haspopup="dialog"
      aria-label={etiqueta}
      title={etiqueta}
      className={`group inline-flex h-11 w-11 items-center justify-center rounded-pill text-[13px] font-extrabold ${FOCO} ${
        alcanzado ? "bg-brand-700 text-white" : "border-2 border-system-300 bg-white text-system-600"
      }`}
    >
      <span className="transition-transform duration-150 ease-salida group-hover:scale-110 motion-reduce:transition-none">{numero}</span>
    </button>
  );
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
  const desde = Math.max(1, actual - VECINOS);
  const hasta = Math.min(total, actual + VECINOS);
  // De arriba abajo: el rango más alto primero, como un camino que se sube.
  const ventana = eslabones.filter((e) => e.numero >= desde && e.numero <= hasta).sort((a, b) => b.numero - a.numero);
  const debajo = eslabones.filter((e) => e.numero < desde).sort((a, b) => a.numero - b.numero);
  const encima = eslabones.filter((e) => e.numero > hasta).sort((a, b) => a.numero - b.numero);
  const hitoDe = (numero: number) => recorrido.find((h) => h.numero === numero);

  const alto = ventana.length * ALTO_DE_FILA + MARGEN * 2;
  const puntos = new Map(ventana.map((e, i) => [e.numero, { x: xDe(e.numero), y: MARGEN + ALTO_DE_FILA / 2 + i * ALTO_DE_FILA }]));
  const punto = (n: number): Punto => puntos.get(n) ?? { x: CENTRO_X, y: 0 };
  // Recorrido: del rango más bajo de la ventana al actual, en ese orden para que se dibuje subiendo.
  const hecho = curvaPor(ventana.filter((e) => e.numero <= actual).map((e) => punto(e.numero)).reverse());
  const porVenir = curvaPor(ventana.filter((e) => e.numero >= actual).map((e) => punto(e.numero)).reverse());
  const arriba = ventana[0] ? punto(ventana[0].numero) : null;
  const abajo = ventana.at(-1) ? punto(ventana.at(-1)!.numero) : null;

  return (
    <section aria-labelledby="sendero-titulo" className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-system-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
      <h2 id="sendero-titulo" className="sr-only">
        Tu tramo del sendero: rangos {desde} a {hasta}
      </h2>

      {encima.length > 0 && (
        <Tapa
          hacia="arriba"
          tono="neutro"
          titulo={encima.length === 1 ? `Rango ${encima[0].numero} · por descubrir` : `Rangos ${encima[0].numero} a ${total} · por descubrir`}
          resumen={<span className="text-system-600">{encima.length} más arriba</span>}
        >
          <ul className="flex flex-wrap gap-2" aria-label="Rangos por descubrir">
            {encima.map((e) => (
              <li key={e.numero}>
                <Ficha
                  numero={e.numero}
                  alcanzado={false}
                  etiqueta={`Rango ${e.numero}${e.numero === total ? ", el último" : ""}, por descubrir. Pide ${nf.format(e.expQuePide)} EXP. Abre su ficha.`}
                  onAbrir={onAbrir}
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-system-600">
            Más arriba todo es niebla… por ahora. Toca un número para ver lo que pide; su nombre aparece cuando sea tu siguiente rango.
          </p>
        </Tapa>
      )}

      <ol aria-label={`Rangos ${desde} a ${hasta}`} className="relative" style={{ height: alto }}>
        <svg
          aria-hidden="true"
          width={ANCHO_DEL_TRAZO}
          height={alto}
          viewBox={`0 0 ${ANCHO_DEL_TRAZO} ${alto}`}
          className="sendero-entra pointer-events-none absolute top-0 left-0 overflow-visible"
        >
          {arriba && encima.length > 0 && (
            <path d={`M${arriba.x} 0 L${arriba.x} ${arriba.y}`} fill="none" className="stroke-system-300" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 12" />
          )}
          <path d={porVenir} fill="none" className="stroke-system-300" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 12" />
          {abajo && debajo.length > 0 && (
            <path d={`M${abajo.x} ${abajo.y} L${abajo.x} ${alto}`} fill="none" className="stroke-brand-600" strokeWidth="8" strokeLinecap="round" />
          )}
          {hecho && <path className="sendero-trazo stroke-brand-600" pathLength={1} d={hecho} fill="none" strokeWidth="8" strokeLinecap="round" />}
        </svg>

        {ventana.map((e) => {
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
                className={`sendero-entra group relative block h-full w-full rounded-lg text-left ${FOCO}`}
                style={{ "--i": Math.abs(e.numero - actual) } as CSSProperties}
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
                  {/* En teléfono la nota no cabe: la tarjeta del siguiente y la ficha ya la dicen. */}
                  {textos.nota && <span className="block text-[12.5px] text-system-600 max-sm:hidden">{textos.nota}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {debajo.length > 0 && (
        <Tapa
          hacia="abajo"
          tono="logro"
          titulo={debajo.length === 1 ? "Rango 1 · ya es tuyo" : `Rangos 1 a ${debajo.at(-1)!.numero} · ya son tuyos`}
          resumen={<span>✓ {debajo.length}</span>}
        >
          <ul className="flex flex-wrap gap-2" aria-label="Rangos que ya alcanzaste">
            {debajo.map((e) => {
              const hito = hitoDe(e.numero);
              return (
                <li key={e.numero}>
                  <Ficha
                    numero={e.numero}
                    alcanzado
                    etiqueta={`Rango ${e.numero}, Investigador ${e.nombreCorto ?? ""}${hito?.fecha ? `, alcanzado ${fechaDe(hito)}` : ""}. Abre su ficha.`}
                    onAbrir={onAbrir}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12.5px] text-system-600">Toca uno para ver lo que pidió y lo que te dio.</p>
        </Tapa>
      )}
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
        <p className="mt-1.5 max-w-xl text-[14.5px] text-brand-200 max-md:text-[13.5px]">{introDe(actual, total)}</p>
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

function introDe(actual: number, total: number): string {
  if (actual >= total) return `Llegaste a la cumbre. Los ${total} rangos son tuyos y nadie te los quita.`;
  if (actual === total - 1) return `Te falta un paso: del rango ${total}, el último, ya puedes ver todo.`;
  if (actual === 1) return "Tu primer aporte aceptado te lleva al rango 2. El camino se revela conforme subes.";
  const resto = actual + 3 <= total ? " Más arriba todo es niebla… por ahora." : "";
  return `Vas subiendo. Del rango ${actual + 1} ya ves todo y del ${actual + 2}, una pista.${resto}`;
}
