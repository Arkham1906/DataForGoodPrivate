"use client";

// Contador de descargas y botón "Descargar ZIP" de /datos/[id]. La página se guarda en caché
// (revalidate = 300) y la descarga no navega, así que la tarjeta "Descargas" se quedaba en el
// número de antes. El botón avisa con EVENTO_DESCARGA y el contador suma 1 en el momento;
// GET /api/datos/[id]/descarga sube downloads_count e invalida la página para la siguiente visita.

import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { BASE_PATH } from "@/lib/base-path";

const EVENTO_DESCARGA = "dataforgood:descarga-de-conjunto";
const nf = new Intl.NumberFormat("es-MX");

export function ContadorDeDescargas({ conjuntoId, inicial }: { conjuntoId: string; inicial: number }) {
  const [descargas, setDescargas] = useState(inicial);

  useEffect(() => {
    function alDescargar(e: Event) {
      if ((e as CustomEvent<string>).detail === conjuntoId) setDescargas((n) => n + 1);
    }
    window.addEventListener(EVENTO_DESCARGA, alDescargar);
    return () => window.removeEventListener(EVENTO_DESCARGA, alDescargar);
  }, [conjuntoId]);

  return <span aria-live="polite">{nf.format(descargas)}</span>;
}

export function BotonDeDescarga({ conjuntoId, texto }: { conjuntoId: string; texto: string }) {
  return (
    // <a> y no <Link>: es un archivo de un route handler, no una página.
    <a
      href={`${BASE_PATH}/api/datos/${conjuntoId}/descarga`}
      download
      onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_DESCARGA, { detail: conjuntoId }))}
      className={buttonClasses("primary", undefined, "mt-3 inline-flex")}
    >
      {texto}
    </a>
  );
}
