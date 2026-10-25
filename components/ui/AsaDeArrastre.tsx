"use client";

// Asa (⠿) para cambiar el orden de una lista arrastrando, con mouse o con el dedo (2026-10-24, a pedido del
// usuario: en el formulario de campaña, mover checklists y opciones sin ir de uno en uno). Con eventos de
// puntero, no con el arrastre nativo de HTML, que no funciona con el dedo.
//
// Cómo se usa: el contenedor de la lista lleva data-orden-grupo y cada elemento data-orden-elemento={índice}.
// El asa va dentro del elemento. Al arrastrar, el elemento sigue al puntero y, en cuanto el puntero entra
// en otro elemento del mismo grupo, avisa con onMover(de, a): la lista se reacomoda en vivo. Las listas
// anidadas (opciones dentro de un checklist) no se mezclan: cada asa solo mira los elementos de su grupo.
// El movimiento se escucha en la ventana y no con setPointerCapture: al reacomodar, React a veces mueve en el
// DOM justo el elemento arrastrado, y eso suelta la captura a medio arrastre.
// Con teclado: el asa se enfoca con Tab y las flechas ↑/↓ (o ←/→) la mueven un lugar (2026-10-24: se quitaron
// los botones ↑ y ↓ a pedido del usuario).

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

/** El elemento que contiene al asa, su grupo y cuántos hay en el grupo. */
function ubicar(asa: HTMLElement) {
  const propio = asa.closest<HTMLElement>("[data-orden-elemento]");
  const grupo = propio?.parentElement?.closest<HTMLElement>("[data-orden-grupo]");
  if (!propio || !grupo) return null;
  const total = grupo.querySelectorAll(":scope > [data-orden-elemento]").length;
  return { propio, grupo, indice: Number(propio.dataset.ordenElemento), total };
}

export default function AsaDeArrastre({
  onMover,
  etiqueta,
  deshabilitado = false,
}: {
  onMover: (de: number, a: number) => void;
  /** Qué se mueve, para el lector de pantalla: "el checklist Estado del árbol". */
  etiqueta: string;
  deshabilitado?: boolean;
}) {
  const asaRef = useRef<HTMLButtonElement>(null);
  // La última versión de onMover, para los oyentes de la ventana.
  const alMoverRef = useRef(onMover);
  useEffect(() => {
    alMoverRef.current = onMover;
  }, [onMover]);
  // Quita los oyentes de un arrastre en curso (también si el asa desaparece a media acción).
  const terminar = useRef<(() => void) | null>(null);
  useEffect(() => () => terminar.current?.(), []);

  function alPresionar(e: React.PointerEvent<HTMLButtonElement>) {
    if (deshabilitado || (e.pointerType === "mouse" && e.button !== 0)) return;
    const lugar = ubicar(e.currentTarget);
    if (!lugar) return;
    const { propio, grupo } = lugar;
    e.preventDefault();
    terminar.current?.();

    const puntero = e.pointerId;
    // Índice actual del elemento arrastrado: cambia cada vez que la lista se reacomoda.
    let actual = lugar.indice;
    // Dónde se tomó el elemento, para que siga al puntero sin brincar.
    const caja = propio.getBoundingClientRect();
    const tomadoX = e.clientX - caja.left;
    const tomadoY = e.clientY - caja.top;
    // El último con el que se cambió: no se vuelve a cambiar con él hasta que el puntero salga de él
    // (si son de distinto alto, el puntero puede quedar encima y rebotarían).
    let recien: HTMLElement | null = null;
    // Falso al soltar: un ajuste pendiente (requestAnimationFrame) ya no mueve el elemento.
    let arrastrando = true;

    propio.setAttribute("data-arrastrando", "");
    // Sin pointer-events, elementFromPoint ve lo que hay debajo del elemento arrastrado.
    Object.assign(propio.style, { position: "relative", zIndex: "20", pointerEvents: "none" });

    function seguir(x: number, y: number) {
      if (!propio || !arrastrando) return;
      propio.style.transform = "";
      const natural = propio.getBoundingClientRect();
      propio.style.transform = `translate(${x - tomadoX - natural.left}px, ${y - tomadoY - natural.top}px)`;
    }

    function alMover(ev: PointerEvent) {
      if (ev.pointerId !== puntero || !propio || !grupo) return;
      if (ev.clientY < BORDE_DE_DESPLAZAMIENTO) window.scrollBy(0, -12);
      else if (ev.clientY > window.innerHeight - BORDE_DE_DESPLAZAMIENTO) window.scrollBy(0, 12);

      const destino = elementoDelGrupo(document.elementFromPoint(ev.clientX, ev.clientY), grupo);
      if (destino !== recien) recien = null;
      if (destino && destino !== propio && destino !== recien) {
        const a = Number(destino.dataset.ordenElemento);
        const de = actual;
        actual = a;
        recien = destino;
        alMoverRef.current(de, a);
      }
      // Después de reacomodar, el elemento quedó en otro lugar: se vuelve a ajustar al puntero.
      requestAnimationFrame(() => seguir(ev.clientX, ev.clientY));
    }

    function alSoltar(ev: PointerEvent) {
      if (ev.pointerId === puntero) terminar.current?.();
    }

    window.addEventListener("pointermove", alMover);
    window.addEventListener("pointerup", alSoltar);
    window.addEventListener("pointercancel", alSoltar);
    terminar.current = () => {
      arrastrando = false;
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerup", alSoltar);
      window.removeEventListener("pointercancel", alSoltar);
      propio.removeAttribute("data-arrastrando");
      Object.assign(propio.style, { position: "", zIndex: "", pointerEvents: "", transform: "" });
      terminar.current = null;
    };
  }

  function alTeclear(e: React.KeyboardEvent<HTMLButtonElement>) {
    const paso = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0;
    if (!paso || deshabilitado) return;
    e.preventDefault();
    const lugar = ubicar(e.currentTarget);
    if (!lugar) return;
    const a = lugar.indice + paso;
    if (a < 0 || a >= lugar.total) return;
    onMover(lugar.indice, a);
    // Al reacomodar, el navegador puede quitarle el foco al asa: se le devuelve.
    requestAnimationFrame(() => asaRef.current?.focus());
  }

  return (
    <button
      ref={asaRef}
      type="button"
      disabled={deshabilitado}
      onPointerDown={alPresionar}
      onKeyDown={alTeclear}
      aria-label={`Mover ${etiqueta}: arrastra o usa las flechas`}
      title="Arrastra para cambiar el orden"
      className="flex h-7 w-5 shrink-0 cursor-grab select-none items-center justify-center rounded text-system-500 touch-none hover:bg-system-100 hover:text-system-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
        <circle cx="2.5" cy="3" r="1.5" />
        <circle cx="7.5" cy="3" r="1.5" />
        <circle cx="2.5" cy="8" r="1.5" />
        <circle cx="7.5" cy="8" r="1.5" />
        <circle cx="2.5" cy="13" r="1.5" />
        <circle cx="7.5" cy="13" r="1.5" />
      </svg>
    </button>
  );
}
