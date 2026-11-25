"use client";

// Etiquetas al pasar el cursor para los controles que solo llevan un ícono (2026-11-24, a pedido del usuario: "haz lo
// mismo para íconos que no tengan texto", después de la etiqueta del botón Pendientes). Se monta UNA vez en
// app/layout.tsx y cubre toda la app (pública, zona de usuario y panel), también los íconos que se agreguen después:
//
// - A qué se aplica: botón, enlace, <summary> o elemento con role button/tab/menuitem SIN texto visible (letras fuera de
//   svg, aria-hidden o sr-only; un contador como "9+" no cuenta como texto). El texto sale de su aria-label, si no
//   tiene de su title y si tampoco, de su texto sr-only (solo para lector de pantalla). Con texto visible, o sin
//   ninguno de los tres, no se hace nada.
// - El title se quita la primera vez que se muestra la etiqueta (pasa a aria-label si no tenía), para que no salga
//   además la del navegador.
// - "Notificaciones: 3 sin leer" se pinta en dos renglones: "Notificaciones" en negritas y debajo "3 sin leer".
// - Sale con el mouse (tras una pausa corta; seguida si ya había otra a la vista) o al llegar con el teclado
//   (:focus-visible), nunca con el dedo. Se va al salir, al hacer clic, con Escape, al desplazar o al cambiar de
//   pantalla, y no sale sobre un control con su menú abierto (aria-expanded="true").
// - Va en la capa superior (popover="manual"), así se ve también sobre las ventanas <dialog>. Debajo del control y, si
//   no cabe, arriba; nunca se sale de la pantalla. Es aria-hidden: el lector de pantalla ya lee el aria-label.
// - Para excluir un control: data-sin-etiqueta-emergente en él, en un contenedor o en algo que lleve dentro (así va el
//   logo, layout/Logo: su dibujo ya dice "DataForGood").

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const CONTROLES = 'button, a[href], summary, [role="button"], [role="tab"], [role="menuitem"]';
const ESPERA_MS = 300;
/** Si otra etiqueta se cerró hace menos de esto, la siguiente sale sin pausa (recorrer una fila de íconos). */
const SEGUIDA_MS = 400;
const MARGEN = 8;
const SEPARACION = 6;

type Etiqueta = { texto: string; detalle: string | null; control: HTMLElement };

/** ¿Tiene letras que se ven? Ignora svg, aria-hidden, sr-only y lo que no se muestra. */
function tieneTextoVisible(control: HTMLElement): boolean {
  const recorrido = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
  for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
    if (!/\p{L}/u.test(nodo.textContent ?? "")) continue;
    const padre = nodo.parentElement;
    if (!padre) continue;
    const oculto = padre.closest('svg, [aria-hidden="true"], .sr-only');
    if (oculto && (oculto === control || control.contains(oculto))) continue;
    if (typeof padre.checkVisibility === "function" && !padre.checkVisibility()) continue;
    return true;
  }
  return false;
}

/** Texto solo para lector de pantalla (.sr-only) dentro del control. */
function textoSoloParaLector(control: HTMLElement): string {
  return [...control.querySelectorAll(".sr-only")]
    .map((nodo) => nodo.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** El control con ícono bajo `objetivo`, o null si no aplica. */
function controlConIcono(objetivo: EventTarget | null): HTMLElement | null {
  if (!(objetivo instanceof Element)) return null;
  const control = objetivo.closest<HTMLElement>(CONTROLES);
  if (!control) return null;
  // Excluido en el control, en un contenedor o en lo que lleva dentro (el logo, que ya se lee como texto).
  if (control.closest("[data-sin-etiqueta-emergente]") || control.querySelector("[data-sin-etiqueta-emergente]")) return null;
  if (!control.getAttribute("aria-label") && !control.getAttribute("title") && !textoSoloParaLector(control)) return null;
  if (tieneTextoVisible(control)) return null;
  return control;
}

/** Lee la etiqueta y quita el title (lo pasa a aria-label si hace falta) para que no salgan dos. */
function etiquetaDe(control: HTMLElement): Etiqueta | null {
  const titulo = control.getAttribute("title");
  if (titulo) {
    if (!control.getAttribute("aria-label")) control.setAttribute("aria-label", titulo);
    control.removeAttribute("title");
  }
  const completa = (control.getAttribute("aria-label") ?? textoSoloParaLector(control)).trim();
  if (!completa) return null;
  const dosPuntos = completa.indexOf(": ");
  if (dosPuntos > 0 && dosPuntos <= 40) {
    const detalle = completa.slice(dosPuntos + 2).trim();
    return {
      texto: completa.slice(0, dosPuntos),
      detalle: detalle ? detalle.charAt(0).toUpperCase() + detalle.slice(1) : null,
      control,
    };
  }
  return { texto: completa, detalle: null, control };
}

export default function EtiquetasEmergentes() {
  const pathname = usePathname();
  const [etiqueta, setEtiqueta] = useState<Etiqueta | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const temporizador = useRef<number | null>(null);
  const actual = useRef<HTMLElement | null>(null);
  const cerradaEn = useRef(0);

  const cancelar = useCallback(() => {
    if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    temporizador.current = null;
  }, []);

  const ocultar = useCallback(() => {
    cancelar();
    if (actual.current) cerradaEn.current = Date.now();
    actual.current = null;
    setEtiqueta(null);
  }, [cancelar]);

  const mostrar = useCallback(
    (control: HTMLElement, sinPausa: boolean) => {
      cancelar();
      actual.current = control;
      const abrir = () => {
        temporizador.current = null;
        if (actual.current !== control || !control.isConnected) return;
        if (control.getAttribute("aria-expanded") === "true") return;
        setEtiqueta(etiquetaDe(control));
      };
      if (sinPausa || Date.now() - cerradaEn.current < SEGUIDA_MS) abrir();
      else temporizador.current = window.setTimeout(abrir, ESPERA_MS);
    },
    [cancelar],
  );

  useEffect(() => {
    const alEntrar = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const control = controlConIcono(e.target);
      if (!control) {
        // Pasó a algo que no lleva etiqueta y está fuera del control actual.
        if (actual.current && !(e.target instanceof Node && actual.current.contains(e.target))) ocultar();
        return;
      }
      if (control !== actual.current) mostrar(control, false);
    };
    const alSalir = (e: PointerEvent) => {
      if (!actual.current) return;
      if (e.relatedTarget instanceof Node && actual.current.contains(e.relatedTarget)) return;
      ocultar();
    };
    const alEnfocar = (e: FocusEvent) => {
      const control = controlConIcono(e.target);
      if (control && control.matches(":focus-visible")) mostrar(control, true);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") ocultar();
    };
    document.addEventListener("pointerover", alEntrar, true);
    document.addEventListener("pointerout", alSalir, true);
    document.addEventListener("focusin", alEnfocar, true);
    document.addEventListener("focusout", ocultar, true);
    document.addEventListener("pointerdown", ocultar, true);
    document.addEventListener("keydown", alTeclear, true);
    window.addEventListener("scroll", ocultar, true);
    window.addEventListener("resize", ocultar);
    return () => {
      cancelar();
      document.removeEventListener("pointerover", alEntrar, true);
      document.removeEventListener("pointerout", alSalir, true);
      document.removeEventListener("focusin", alEnfocar, true);
      document.removeEventListener("focusout", ocultar, true);
      document.removeEventListener("pointerdown", ocultar, true);
      document.removeEventListener("keydown", alTeclear, true);
      window.removeEventListener("scroll", ocultar, true);
      window.removeEventListener("resize", ocultar);
    };
  }, [cancelar, mostrar, ocultar]);

  // Al cambiar de pantalla, fuera la que hubiera (el control pudo desaparecer). Es una suscripción al cambio de ruta:
  // se hace al pintar la ruta nueva, sin tocar estado durante el render.
  const rutaAnterior = useRef(pathname);
  useEffect(() => {
    if (rutaAnterior.current === pathname) return;
    rutaAnterior.current = pathname;
    ocultar();
  }, [pathname, ocultar]);

  // Se coloca después de pintarla, cuando ya se sabe su tamaño.
  useLayoutEffect(() => {
    const elemento = caja.current;
    if (!elemento) return;
    const enCapaSuperior = typeof elemento.showPopover === "function";
    if (!etiqueta) {
      if (enCapaSuperior && elemento.matches(":popover-open")) elemento.hidePopover();
      return;
    }
    if (enCapaSuperior && !elemento.matches(":popover-open")) elemento.showPopover();
    const control = etiqueta.control.getBoundingClientRect();
    const propia = elemento.getBoundingClientRect();
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    let left = control.left + control.width / 2 - propia.width / 2;
    left = Math.max(MARGEN, Math.min(left, ancho - propia.width - MARGEN));
    let top = control.bottom + SEPARACION;
    if (top + propia.height > alto - MARGEN) top = Math.max(MARGEN, control.top - SEPARACION - propia.height);
    elemento.style.left = `${Math.round(left)}px`;
    elemento.style.top = `${Math.round(top)}px`;
  }, [etiqueta]);

  return (
    <div
      ref={caja}
      popover="manual"
      aria-hidden="true"
      className={`pointer-events-none fixed inset-auto z-[60] m-0 w-max max-w-64 overflow-visible rounded-md border-0 bg-system-900 px-2.5 py-1.5 text-left shadow-md ${
        etiqueta ? "" : "hidden"
      }`}
    >
      {etiqueta && (
        <>
          <span className="block text-[12px] font-semibold leading-tight text-white">{etiqueta.texto}</span>
          {etiqueta.detalle && <span className="block text-[11px] leading-tight text-system-300">{etiqueta.detalle}</span>}
        </>
      )}
    </div>
  );
}
