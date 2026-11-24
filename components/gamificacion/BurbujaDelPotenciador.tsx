"use client";

// Burbuja del potenciador activo en teléfono (2026-11-23; lienzo «Potenciador fuera de Mi progreso», aprobado el mismo
// día; RF-GAM-32 a 36). En escritorio va en el menú lateral (PotenciadorDelMenu); aquí el menú es una tira arriba.
// - Por defecto abajo a la derecha. Se arrastra a donde la persona quiera, sin salir de la pantalla, y recuerda su
//   lugar en ese navegador (localStorage; si no se puede guardar, vuelve a la esquina). Arrastrar no la abre.
// - Un toque (o Enter/Espacio) abre una tarjeta con el detalle; se cierra con «Cerrar», Esc o tocando fuera.
// - Solo con un potenciador activo; al llegar a 0 se desvanece mientras el servidor activa el siguiente o lo quita.
// Movimiento: solo transform y opacity (arrastre con translate; entrada con potenciador-entra).

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as EventoDePuntero,
} from "react";
import type { ResumenDePotenciadores } from "@/lib/gamificacion/progreso-tipos";
import { TEXTOS } from "@/lib/gamificacion/textos";
import AnilloDelPotenciador from "./AnilloDelPotenciador";
import { useSegundosDelPotenciador } from "./useSegundosDelPotenciador";

const T = TEXTOS.potenciadorFlotante;
const LADO = 64;
const MARGEN = 8;
/** Distancia en px que separa un toque de un arrastre. */
const UMBRAL_DE_ARRASTRE = 6;
const POR_DEFECTO = { derecha: 16, abajo: 24 };
const CLAVE = "dfg:burbuja-del-potenciador";
const EVENTO = "dfg:burbuja-movida";

type Lugar = { derecha: number; abajo: number };

// Lugar guardado y tamaño de la ventana como fuentes externas: así el servidor y el primer render coinciden (sin
// burbuja) y no hace falta poner estado dentro de un efecto.
function suscribirLugar(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}
function leerLugar(): string | null {
  try {
    return window.localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}
function suscribirVentana(avisar: () => void) {
  window.addEventListener("resize", avisar);
  return () => window.removeEventListener("resize", avisar);
}
const leerVentana = () => `${window.innerWidth}x${window.innerHeight}`;

function lugarDesde(texto: string | null): Lugar {
  try {
    const l = texto ? (JSON.parse(texto) as Partial<Lugar>) : null;
    if (l && Number.isFinite(l.derecha) && Number.isFinite(l.abajo))
      return { derecha: l.derecha!, abajo: l.abajo! };
  } catch {
    // Valor dañado: la esquina de siempre.
  }
  return POR_DEFECTO;
}

function dentro({ derecha, abajo }: Lugar, ancho: number, alto: number): Lugar {
  return {
    derecha: Math.min(
      Math.max(MARGEN, derecha),
      Math.max(MARGEN, ancho - LADO - MARGEN),
    ),
    abajo: Math.min(
      Math.max(MARGEN, abajo),
      Math.max(MARGEN, alto - LADO - MARGEN),
    ),
  };
}

function guardar(lugar: Lugar) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(lugar));
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): se queda donde la soltó hasta recargar.
  }
  window.dispatchEvent(new Event(EVENTO));
}

export default function BurbujaDelPotenciador({
  potenciadores,
}: {
  potenciadores: ResumenDePotenciadores | null;
}) {
  const activo = potenciadores?.activo ?? null;
  const segundos = useSegundosDelPotenciador(activo);
  const guardado = useSyncExternalStore(suscribirLugar, leerLugar, () => null);
  const ventana = useSyncExternalStore(
    suscribirVentana,
    leerVentana,
    () => "0x0",
  );
  const [abierta, setAbierta] = useState(false);
  const [arrastre, setArrastre] = useState<{ dx: number; dy: number } | null>(
    null,
  );
  const inicio = useRef<{ x: number; y: number; id: number } | null>(null);
  const huboArrastre = useRef(false);
  // Si no se pudo guardar, el último lugar donde la soltó vale mientras dure la página.
  const [soltada, setSoltada] = useState<Lugar | null>(null);

  useEffect(() => {
    if (!abierta) return;
    const alTeclado = (e: KeyboardEvent) =>
      e.key === "Escape" && setAbierta(false);
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [abierta]);

  const [ancho, alto] = ventana.split("x").map(Number);
  if (!potenciadores || !activo || ancho === 0) return null;

  const lugar = dentro(
    guardado ? lugarDesde(guardado) : (soltada ?? POR_DEFECTO),
    ancho,
    alto,
  );
  const izquierda = ancho - lugar.derecha - LADO;
  const arriba = alto - lugar.abajo - LADO;
  // La tarjeta se abre hacia el lado con más espacio.
  const tarjetaArriba = arriba > alto / 2;
  const tarjetaALaDerecha = izquierda + LADO / 2 > ancho / 2;

  const alPresionar = (e: EventoDePuntero<HTMLButtonElement>) => {
    inicio.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    huboArrastre.current = false;
    // Desde el inicio: si el dedo sale rápido de la burbuja, los movimientos siguen llegando aquí.
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const alMover = (e: EventoDePuntero<HTMLButtonElement>) => {
    const i = inicio.current;
    if (!i || i.id !== e.pointerId) return;
    const dx = e.clientX - i.x;
    const dy = e.clientY - i.y;
    if (!huboArrastre.current && Math.hypot(dx, dy) < UMBRAL_DE_ARRASTRE)
      return;
    if (!huboArrastre.current) {
      huboArrastre.current = true;
      setAbierta(false);
    }
    setArrastre({ dx, dy });
  };
  const alSoltar = (e: EventoDePuntero<HTMLButtonElement>) => {
    const i = inicio.current;
    inicio.current = null;
    if (!i || i.id !== e.pointerId || !huboArrastre.current) return;
    const nuevo = dentro(
      {
        derecha: lugar.derecha - (e.clientX - i.x),
        abajo: lugar.abajo - (e.clientY - i.y),
      },
      ancho,
      alto,
    );
    setArrastre(null);
    setSoltada(nuevo);
    guardar(nuevo);
  };
  const alCancelar = () => {
    inicio.current = null;
    setArrastre(null);
  };

  const detalle = (
    <>
      {T.suma(activo.bonificacion)}
      {potenciadores.enEspera > 0 && ` ${T.enEspera(potenciadores.enEspera)}`}
    </>
  );

  return (
    <div className="md:hidden">
      {abierta && (
        <>
          {/* Toque fuera: cierra. No es un botón (Esc y «Cerrar» ya lo hacen con teclado). */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[60] bg-system-900/15"
            onClick={() => setAbierta(false)}
          />
          <section
            id="detalle-del-potenciador"
            role="dialog"
            aria-labelledby="titulo-del-potenciador"
            className="potenciador-entra fixed z-[61] w-[260px] max-w-[calc(100vw-16px)] rounded-xl border border-brand-100 bg-white p-3.5 shadow-lg"
            style={{
              ...(tarjetaArriba
                ? { bottom: lugar.abajo + LADO + 12 }
                : { top: arriba + LADO + 12 }),
              ...(tarjetaALaDerecha
                ? { right: Math.max(MARGEN, lugar.derecha) }
                : { left: Math.max(MARGEN, izquierda) }),
            }}
          >
            <div className="flex items-center justify-between">
              <h2
                id="titulo-del-potenciador"
                className="text-[13px] font-bold text-brand-800"
              >
                {T.titulo}
              </h2>
              <button
                type="button"
                onClick={() => setAbierta(false)}
                aria-label={T.cerrar}
                className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-system-700 hover:bg-system-100"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <p
              role="timer"
              aria-label={T.quedan(segundos)}
              className="font-mono text-[26px] font-extrabold leading-none text-system-900"
            >
              {T.reloj(segundos)}
            </p>
            <p className="mt-2 text-[12.5px] leading-snug text-brand-800">
              {detalle}
            </p>
            <p className="mt-1.5 text-[12px] text-system-600">{T.mover}</p>
          </section>
        </>
      )}

      <button
        type="button"
        aria-label={T.burbuja(segundos)}
        aria-expanded={abierta}
        aria-controls={abierta ? "detalle-del-potenciador" : undefined}
        onClick={() => {
          if (huboArrastre.current) {
            huboArrastre.current = false;
            return;
          }
          setAbierta((a) => !a);
        }}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alCancelar}
        className={`fixed z-[62] touch-none select-none rounded-pill transition-opacity duration-300 ${
          segundos === 0 ? "opacity-0" : ""
        } ${arrastre ? "cursor-grabbing" : "cursor-pointer"}`}
        style={{
          width: LADO,
          height: LADO,
          right: lugar.derecha,
          bottom: lugar.abajo,
          transform: arrastre
            ? `translate(${arrastre.dx}px, ${arrastre.dy}px)`
            : undefined,
        }}
      >
        {/* La entrada va por dentro: el botón usa transform para el arrastre. */}
        <span className="potenciador-entra relative flex h-full w-full items-center justify-center rounded-pill border border-brand-100 bg-white shadow-lg">
          <AnilloDelPotenciador
            segundos={segundos}
            duracionMinutos={activo.duracionMinutos}
            lado={56}
            clasePista="stroke-brand-50"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-pill bg-brand-800 px-1.5 py-0.5 font-mono text-[11.5px] font-extrabold text-white"
          >
            {T.reloj(segundos)}
          </span>
          {potenciadores.enEspera > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-pill border-2 border-white bg-[var(--color-avance-3)] px-1 text-[11px] font-extrabold text-white"
            >
              +{potenciadores.enEspera}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
