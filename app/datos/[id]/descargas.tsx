"use client";

// Contador de descargas y botón "Descargar ZIP" de /datos/[id]. La descarga no navega: el botón avisa
// con EVENTO_DESCARGA y el contador suma 1 en el momento. GET /api/datos/[id]/descarga sube
// downloads_count y la actualización en vivo trae el número nuevo (la página usa key = inicial, así que
// el contador vuelve a empezar desde el número del servidor, también con las descargas de otras personas).

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
