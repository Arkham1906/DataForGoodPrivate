"use client";

// Avatar, nombre y "Ver perfil" de la barra superior (TopBar). Experimental (2026-10-07): en
// /cuenta no se muestra, y al dar clic el círculo y el nombre "vuelan" a su lugar en el
// encabezado del perfil (View Transitions: mismo `name` aquí y en app/(dashboard)/cuenta/page.tsx).
// El clic marca <html data-abrir-perfil> para que /cuenta despliegue su contenido; las
// animaciones están en globals.css (sección "Abrir el perfil"). Antes se usaba
// transitionTypes={["abrir-perfil"]} en el Link, pero en ~1 de cada 3 navegaciones el tipo no
// llegaba a la transición y el despliegue no se veía.

import { useEffect, ViewTransition, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MARCA = "data-abrir-perfil";
// La transición dura ~0.75 s (vuelo de 450 ms; despliegue de 520 ms que empieza a los 180 ms).
// Quitar la marca antes cortaría la animación.
const QUITAR_MARCA_MS = 1500;

export default function EnlaceAlPerfil({ iniciales, nombre }: { iniciales: string; nombre: string }) {
  const ruta = usePathname();

  // Ya en /cuenta, quita la marca cuando terminó la animación, para que llegar a /cuenta de otra
  // forma (atrás, adelante) no despliegue nada.
  useEffect(() => {
    if (ruta !== "/cuenta") return;
    const id = setTimeout(() => document.documentElement.removeAttribute(MARCA), QUITAR_MARCA_MS);
    return () => clearTimeout(id);
  }, [ruta]);

  // En el perfil ya están el avatar y el nombre en grande.
  if (ruta === "/cuenta") return null;

  function marcar(e: MouseEvent<HTMLAnchorElement>) {
    // Con Ctrl/Cmd/Shift/Alt o clic medio se abre otra pestaña: aquí no hay transición.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    document.documentElement.setAttribute(MARCA, "");
  }

  return (
    <Link href="/cuenta" onClick={marcar} className="flex items-center gap-2.5">
      <ViewTransition name="perfil-avatar" share="perfil-viaje" default="none">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">
          {iniciales}
        </div>
      </ViewTransition>
      <div className="hidden sm:block">
        <ViewTransition name="perfil-nombre" share="perfil-viaje" default="none">
          <p className="w-fit text-[13px] font-semibold text-system-900">{nombre}</p>
        </ViewTransition>
        <p className="text-[11.5px] text-system-500">Ver perfil</p>
      </div>
    </Link>
  );
}
