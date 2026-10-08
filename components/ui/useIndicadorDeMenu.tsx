"use client";

// Indicador deslizante de los menús laterales (components/layout/SidebarNav y
// components/sistema/Sidebar): una sola pastilla azul (accent, el color principal
// del sistema) que se mueve hasta la opción activa en vez de que cada enlace pinte
// su propio fondo.

import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";

/**
 * `activo` es la clave de la opción que corresponde a la URL actual. Cada
 * enlace del menú lleva `data-menu-clave`. El `<nav>` recibe `navRef` y debe ser `relative`.
 *
 * Al hacer clic, la pastilla se mueve de inmediato a la opción elegida, sin
 * esperar a que cargue la página: `visual` es la opción que se pinta como
 * activa, y vuelve a ser `activo` en cuanto cambia la URL.
 */
export function useIndicadorDeMenu(activo: string | null) {
  const navRef = useRef<HTMLElement>(null);
  const indicadorRef = useRef<HTMLSpanElement>(null);
  // Guarda desde qué opción se hizo clic: si la URL ya cambió, se ignora solo.
  const [pendiente, setPendiente] = useState<{ desde: string | null; clave: string } | null>(null);

  const visual = pendiente && pendiente.desde === activo ? pendiente.clave : activo;

  // Sincroniza la pastilla con el DOM (posición y tamaño reales del enlace),
  // así sirve igual en el menú vertical que en la tira horizontal del móvil.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicador = indicadorRef.current;
    if (!nav || !indicador) return;

    const medir = () => {
      const enlace = visual
        ? nav.querySelector<HTMLElement>(`[data-menu-clave="${CSS.escape(visual)}"]`)
        : null;
      if (!enlace) {
        indicador.style.opacity = "0";
        return;
      }
      indicador.style.transform = `translate(${enlace.offsetLeft}px, ${enlace.offsetTop}px)`;
      indicador.style.width = `${enlace.offsetWidth}px`;
      indicador.style.height = `${enlace.offsetHeight}px`;
      indicador.style.opacity = "1";
      // Desde aquí la pastilla pinta el fondo: el enlace activo suelta el suyo
      // (ver claseDeOpcionMarcada).
      nav.dataset.indicador = "listo";
    };

    medir();
    // La transición se enciende después de la primera medición: al cargar,
    // la pastilla aparece en su lugar en vez de deslizarse desde la esquina.
    const cuadro = requestAnimationFrame(() => {
      indicador.dataset.listo = "true";
    });
    const observador = new ResizeObserver(medir);
    observador.observe(nav);

    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
    };
  }, [visual]);

  /** onClick de cada enlace: mueve la pastilla antes de que termine la navegación. */
  function alElegir(clave: string) {
    return (e: MouseEvent<HTMLAnchorElement>) => {
      // Abrir en otra pestaña no cambia esta página.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (clave !== activo) setPendiente({ desde: activo, clave });
    };
  }

  const indicador = (
    <span
      ref={indicadorRef}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 rounded-pill bg-brand-600 opacity-0 data-[listo=true]:transition-[transform,width,height,opacity] data-[listo=true]:duration-300 data-[listo=true]:ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none!"
    />
  );

  return { navRef, visual, indicador, alElegir };
}

/**
 * Clases de la opción marcada. Lleva su propio fondo mientras la pastilla no
 * está colocada (HTML del servidor, antes de hidratar): si no, el texto blanco
 * quedaría sobre fondo blanco un instante.
 */
export function claseDeOpcionMarcada(): string {
  return "text-white bg-brand-600 in-data-[indicador=listo]:bg-transparent";
}
