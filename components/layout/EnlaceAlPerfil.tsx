"use client";

// Avatar, nombre y "Ver perfil" de la barra superior (TopBar). Experimental (2026-10-07): en
// /cuenta no se muestra, y al dar clic el círculo y el nombre "vuelan" a su lugar en el
// encabezado del perfil (View Transitions: mismo `name` aquí y en app/(dashboard)/cuenta/page.tsx).
// La navegación lleva el tipo "abrir-perfil" para que /cuenta despliegue su contenido; las
// animaciones están en globals.css (sección "Abrir el perfil").

import { ViewTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function EnlaceAlPerfil({ iniciales, nombre }: { iniciales: string; nombre: string }) {
  const ruta = usePathname();
  // En el perfil ya están el avatar y el nombre en grande.
  if (ruta === "/cuenta") return null;

  return (
    <Link href="/cuenta" transitionTypes={["abrir-perfil"]} className="flex items-center gap-2.5">
      <ViewTransition name="perfil-avatar" share="perfil-viaje" default="none">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">
          {iniciales}
        </div>
      </ViewTransition>
      <div className="hidden sm:block">
        <ViewTransition name="perfil-nombre" share="perfil-viaje" default="none">
          <p className="w-fit text-[13px] font-semibold text-ink">{nombre}</p>
        </ViewTransition>
        <p className="text-[11.5px] text-ink-3">Ver perfil</p>
      </div>
    </Link>
  );
}
