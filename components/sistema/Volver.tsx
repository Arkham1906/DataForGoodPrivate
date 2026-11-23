"use client";

// "← Volver …" del panel del SuperUsuario. Desde el 2026-11-23 (a pedido del usuario) regresa a la pantalla de donde
// se llegó, con su consulta (filtros, página, pestaña), según el rastro de components/sistema/rastro-del-panel.ts:
// la ficha de un usuario abierta desde Sanciones vuelve a Sanciones, no al directorio. Si se llegó avanzando, usa el
// atrás del navegador (router.back), que además conserva la posición en la página; si no, navega con el enlace.
// Sin rastro (se entró directo por la URL, otra pestaña sin historial, o la anterior es una subpantalla de esta) usa
// `href` y `children`, que son el destino fijo de siempre: la pantalla de arriba. Si el rastro lleva a esa misma
// pantalla, conserva el texto de `children` (más preciso) y solo agrega la consulta.
// `soloSiVieneDe` (texto de una expresión regular sobre la ruta): solo se muestra si se llegó de una pantalla así;
// p. ej. la bandeja de aportes, que no es subpantalla de nada, solo lo lleva al abrirse desde una campaña.
// En el servidor y al hidratar se pinta el destino fijo; el del rastro llega justo después (useSyncExternalStore).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

import { destinoDelRastro, leerRastro, nombreDePantalla, rutaDe, suscribirAlRastro } from "@/components/sistema/rastro-del-panel";

export default function Volver({
  href,
  children,
  soloSiVieneDe,
}: {
  href: string;
  children: ReactNode;
  soloSiVieneDe?: string;
}) {
  const router = useRouter();
  const rutaActual = usePathname();
  const rastro = useSyncExternalStore(suscribirAlRastro, leerRastro, () => "");
  const destino = destinoDelRastro(rastro, rutaActual);

  if (soloSiVieneDe && (!destino || !new RegExp(soloSiVieneDe).test(rutaDe(destino.url)))) return null;

  const mismaPantalla = destino !== null && rutaDe(destino.url) === rutaDe(href);
  const texto = destino === null || mismaPantalla ? children : `Volver ${nombreDePantalla(rutaDe(destino.url))}`;

  function alHacerClic(e: MouseEvent<HTMLAnchorElement>) {
    // Ctrl/Cmd/Mayús o rueda: que el enlace se abra donde pidió la persona.
    if (!destino?.conAtras || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Una pestaña nueva copia el sessionStorage pero no el historial: ahí no hay "atrás".
    if (window.history.length <= 1) return;
    e.preventDefault();
    router.back();
  }

  return (
    <Link
      href={destino?.url ?? href}
      onClick={alHacerClic}
      className="mb-5 inline-block text-[13px] text-system-600 hover:text-brand-600"
    >
      ← {texto}
    </Link>
  );
}
