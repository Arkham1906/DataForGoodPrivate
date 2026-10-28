"use client";

// Avatar, nombre y "Ver perfil" de la barra superior (TopBar). Experimental (2026-10-07): en
// /cuenta no se muestra, y al dar clic el círculo y el nombre "vuelan" a su lugar en el
// encabezado del perfil (View Transitions: mismo `name` aquí y en app/(dashboard)/cuenta/page.tsx).
// El clic marca <html data-abrir-perfil> para que /cuenta despliegue su contenido; las
// animaciones están en globals.css (sección "Abrir el perfil"). Antes se usaba
// transitionTypes={["abrir-perfil"]} en el Link, pero en ~1 de cada 3 navegaciones el tipo no
// llegaba a la transición y el despliegue no se veía.
// Efecto de clic (2026-10-27, a pedido del usuario): al presionar, el avatar se hunde un poco y sale una
// onda (anillo) desde él (clases perfil-clic y perfil-clic-onda de globals.css). Van en un envoltorio
// fuera del ViewTransition, así no cambian la animación del vuelo.

import { useEffect, useState, ViewTransition, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import type { DatosDeAvatar } from "@/lib/usuarios/avatar-opciones";

const MARCA = "data-abrir-perfil";
// La transición dura ~0.75 s (vuelo de 450 ms; despliegue de 520 ms que empieza a los 180 ms).
// Quitar la marca antes cortaría la animación.
const QUITAR_MARCA_MS = 1500;

/** avatar: iniciales, ícono predefinido o foto (components/ui/Avatar, elegido en /cuenta). */
export default function EnlaceAlPerfil({ avatar, nombre }: { avatar: DatosDeAvatar; nombre: string }) {
  const ruta = usePathname();
  // Cada clic suma uno: la onda se vuelve a montar (key) y su animación empieza de nuevo.
  const [ondas, setOndas] = useState(0);

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
    <Link
      href="/cuenta"
      onClick={marcar}
      // Al presionar (no al soltar): la onda sale antes de que empiece el vuelo hacia /cuenta.
      onPointerDown={(e) => {
        if (e.button === 0) setOndas((n) => n + 1);
      }}
      className="perfil-enlace flex items-center gap-2.5"
    >
      <span className="perfil-clic relative grid place-items-center rounded-full">
        <ViewTransition name="perfil-avatar" share="perfil-viaje" default="none">
          <Avatar datos={avatar} tamano="sm" />
        </ViewTransition>
        {ondas > 0 && <span key={ondas} aria-hidden="true" className="perfil-clic-onda" />}
      </span>
      <div className="hidden sm:block">
        <ViewTransition name="perfil-nombre" share="perfil-viaje" default="none">
          <p className="w-fit text-[13px] font-semibold text-system-900">{nombre}</p>
        </ViewTransition>
        <p className="text-[11.5px] text-system-500">Ver perfil</p>
      </div>
    </Link>
  );
}
