"use client";

// Asa (⠿) para cambiar el orden de una lista arrastrando, con mouse o con el dedo (2026-10-24, a pedido del
// usuario: en el formulario de campaña, mover checklists y opciones sin ir de uno en uno con ↑ y ↓).
// Con eventos de puntero, no con el arrastre nativo de HTML, que no funciona con el dedo.
//
// Cómo se usa: el contenedor de la lista lleva data-orden-grupo y cada elemento data-orden-elemento={índice}.
// El asa va dentro del elemento y avisa con onMover(de, a) cada vez que el puntero pasa la mitad de otro
// elemento del mismo grupo: la lista se reacomoda en vivo. Las listas anidadas (opciones dentro de un
// checklist) no se mezclan: cada asa solo mira los elementos de su propio grupo.
// El movimiento se escucha en la ventana y no con setPointerCapture: al reacomodar, React a veces mueve en el
// DOM justo el elemento arrastrado, y eso suelta la captura a medio arrastre.
// No es enfocable: quien usa teclado o no puede arrastrar tiene los botones ↑ y ↓ (WCAG 2.5.7).

import { useEffect, useRef } from "react";

/** Copia de `lista` con el elemento `de` movido a la posición `a`. */
export function moverA<T>(lista: T[], de: number, a: number): T[] {
  if (de === a || de < 0 || a < 0 || de >= lista.length || a >= lista.length) return lista;
  const copia = [...lista];
  const [elemento] = copia.splice(de, 1);
  copia.splice(a, 0, elemento);
  return copia;
}

/** Distancia al borde de la ventana desde la que la página se desplaza sola mientras se arrastra. */
const BORDE_DE_DESPLAZAMIENTO = 80;

/** El elemento de `grupo` que contiene a `nodo` (el puntero puede estar sobre una opción de otro checklist). */
function elementoDelGrupo(nodo: Element | null, grupo: Element): HTMLElement | null {
  let el = nodo?.closest<HTMLElement>("[data-orden-elemento]") ?? null;
  while (el && el.parentElement?.closest("[data-orden-grupo]") !== grupo) {
    el = el.parentElement?.closest<HTMLElement>("[data-orden-elemento]") ?? null;
  }
  return el;
}

export default function AsaDeArrastre({
  onMover,
  deshabilitado = false,
  titulo = "Arrastra para cambiar el orden",
}: {
  onMover: (de: number, a: number) => void;
  deshabilitado?: boolean;
  titulo?: string;
}) {
  // La última versión de onMover, para los oyentes de la ventana.
  const alMoverRef = useRef(onMover);
  useEffect(() => {
    alMoverRef.current = onMover;
  }, [onMover]);
  // Quita los oyentes de un arrastre en curso (también si el asa desaparece a media acción).
  const terminar = useRef<(() => void) | null>(null);
  useEffect(() => () => terminar.current?.(), []);

  function alPresionar(e: React.PointerEvent<HTMLSpanElement>) {
    if (deshabilitado || (e.pointerType === "mouse" && e.button !== 0)) return;
    const propio = e.currentTarget.closest<HTMLElement>("[data-orden-elemento]");
    const grupo = propio?.parentElement?.closest("[data-orden-grupo]");
    if (!propio || !grupo) return;
    e.preventDefault();
    terminar.current?.();

    const puntero = e.pointerId;
    // Índice actual del elemento arrastrado: cambia cada vez que la lista se reacomoda.
    let actual = Number(propio.dataset.ordenElemento);
    propio.setAttribute("data-arrastrando", "");

    function alMover(ev: PointerEvent) {
      if (ev.pointerId !== puntero || !propio || !grupo) return;
      if (ev.clientY < BORDE_DE_DESPLAZAMIENTO) window.scrollBy(0, -12);
      else if (ev.clientY > window.innerHeight - BORDE_DE_DESPLAZAMIENTO) window.scrollBy(0, 12);

      const destino = elementoDelGrupo(document.elementFromPoint(ev.clientX, ev.clientY), grupo);
      if (!destino || destino === propio) return;
      const a = Number(destino.dataset.ordenElemento);
      const de = actual;

      // Se mueve al pasar la mitad del otro elemento, no al tocar su borde: así no rebota entre dos de
      // distinto alto. En una cuadrícula, dentro de la misma fila cuenta la mitad horizontal.
      const caja = destino.getBoundingClientRect();
      const mismaFila = Math.abs(caja.top - propio.getBoundingClientRect().top) < 8;
      const mitadX = caja.left + caja.width / 2;
      const mitadY = caja.top + caja.height / 2;
      const pasoLaMitad = mismaFila
        ? a > de ? ev.clientX > mitadX : ev.clientX < mitadX
        : a > de ? ev.clientY > mitadY : ev.clientY < mitadY;
      if (!pasoLaMitad) return;

      actual = a;
      alMoverRef.current(de, a);
    }

    function alSoltar(ev: PointerEvent) {
      if (ev.pointerId === puntero) terminar.current?.();
    }

    window.addEventListener("pointermove", alMover);
    window.addEventListener("pointerup", alSoltar);
    window.addEventListener("pointercancel", alSoltar);
    terminar.current = () => {
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerup", alSoltar);
      window.removeEventListener("pointercancel", alSoltar);
      propio.removeAttribute("data-arrastrando");
      terminar.current = null;
    };
  }

  return (
    <span
      aria-hidden="true"
      title={deshabilitado ? undefined : titulo}
      onPointerDown={alPresionar}
      className={`flex h-7 w-5 shrink-0 select-none items-center justify-center rounded text-system-500 touch-none ${
        deshabilitado ? "cursor-not-allowed opacity-40" : "cursor-grab hover:bg-system-100 hover:text-system-900 active:cursor-grabbing"
      }`}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="2.5" cy="3" r="1.5" />
        <circle cx="7.5" cy="3" r="1.5" />
        <circle cx="2.5" cy="8" r="1.5" />
        <circle cx="7.5" cy="8" r="1.5" />
        <circle cx="2.5" cy="13" r="1.5" />
        <circle cx="7.5" cy="13" r="1.5" />
      </svg>
    </span>
  );
}
