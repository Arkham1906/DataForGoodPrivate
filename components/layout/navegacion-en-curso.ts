"use client";

// ¿Hay una navegación en curso? (experimental, 2026-10-08). Lo usa el logo para animar su
// cuadrícula mientras llega la página siguiente. Next no expone un estado global de navegación
// (useLinkStatus solo sirve dentro de un <Link>), así que se detecta aquí:
//   - empieza con un clic en un enlace interno hacia otra ruta de la app, y
//   - termina cuando cambia la ruta (usePathname) o, por si algo falla, a los 15 s.
// Las páginas con loading.tsx cambian de ruta al instante y ahí la animación casi no se ve.

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";

const TOPE_MS = 15_000;

let enCurso = false;
let tope: ReturnType<typeof setTimeout> | undefined;
const oyentes = new Set<() => void>();

function fijar(valor: boolean) {
  if (enCurso === valor) return;
  enCurso = valor;
  clearTimeout(tope);
  if (valor) tope = setTimeout(() => fijar(false), TOPE_MS);
  oyentes.forEach((oyente) => oyente());
}

// En fase de captura: corre antes que el onClick de <Link>, que llama a preventDefault().
function alHacerClic(evento: MouseEvent) {
  if (evento.defaultPrevented || evento.button !== 0) return;
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return; // pestaña nueva
  const enlace = (evento.target as Element | null)?.closest?.("a[href]");
  if (!(enlace instanceof HTMLAnchorElement)) return;
  if ((enlace.target && enlace.target !== "_self") || enlace.hasAttribute("download")) return;
  const destino = new URL(enlace.href);
  if (destino.origin !== location.origin) return;
  if (BASE_PATH && !destino.pathname.startsWith(`${BASE_PATH}/`) && destino.pathname !== BASE_PATH) return;
  // Descargas y archivos de /api no cambian de ruta: nada que esperar.
  if (destino.pathname.startsWith(`${BASE_PATH}/api/`)) return;
  // Misma ruta (otro ?filtro o un #ancla): no hay página nueva que esperar.
  if (destino.pathname === location.pathname) return;
  fijar(true);
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  if (oyentes.size === 1) document.addEventListener("click", alHacerClic, true);
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0) document.removeEventListener("click", alHacerClic, true);
  };
}

/** true desde el clic en un enlace interno hasta que la ruta cambia. */
export function useNavegacionEnCurso() {
  const ruta = usePathname();
  useEffect(() => {
    fijar(false);
  }, [ruta]);
  return useSyncExternalStore(suscribir, () => enCurso, () => false);
}
