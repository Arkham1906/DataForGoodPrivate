"use client";

// El texto de un aporte de tipo texto (.txt), a la vista en un recuadro con scroll (2026-11-11, a
// pedido del usuario: antes solo había un enlace "Abrir el archivo"). Lo lee de
// GET /api/aportes/[id]/archivo, que ya revisa quién puede verlo y lo manda en UTF-8. Se muestra como
// texto, nunca como HTML. Un .txt subido puede pesar hasta 1 MB: se muestran los primeros
// MAXIMO_A_LA_VISTA caracteres y el resto se abre con el enlace. Lo usan ui/ArchivoDelAporte (detalle
// del aporte del creador y del revisor) y cards/ContributionCard (/mis-aportes).

import { useEffect, useState } from "react";

const MAXIMO_A_LA_VISTA = 20000;
const nf = new Intl.NumberFormat("es-MX");

export default function TextoDelAporte({ src, alto = "aspect-video" }: { src: string; alto?: string }) {
  const [estado, setEstado] = useState<{ src: string; texto: string | null; error: boolean } | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(src, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((texto) => vigente && setEstado({ src, texto, error: false }))
      .catch(() => vigente && setEstado({ src, texto: null, error: true }));
    return () => {
      vigente = false;
    };
  }, [src]);

  // Mientras llega el de este `src` (o si cambió), se muestra "Cargando".
  const actual = estado?.src === src ? estado : null;
  const texto = actual?.texto ?? null;
  const recortado = texto !== null && texto.length > MAXIMO_A_LA_VISTA;

  return (
    <div className={`${alto} flex w-full flex-col overflow-hidden rounded-lg border border-system-300 bg-white text-left`}>
      <p className="border-b border-system-200 bg-system-50 px-3 py-2 pr-14 text-[11px] font-semibold uppercase tracking-wide text-system-500">
        Texto del aporte
      </p>
      {/* Dentro de una tarjeta que se abre con clic o teclado (ContributionCard): aquí se selecciona
          el texto y se desplaza con espacio o flechas sin abrirla. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5"
        tabIndex={0}
        role="region"
        aria-label="Texto del aporte"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {!actual ? (
          <p role="status" className="text-[12.5px] text-system-500">
            Cargando el texto…
          </p>
        ) : actual.error ? (
          <p className="text-[12.5px] text-system-600">No se pudo cargar el texto. Ábrelo con el enlace de abajo.</p>
        ) : (
          <>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-system-900">
              {recortado ? texto!.slice(0, MAXIMO_A_LA_VISTA) : texto}
            </p>
            {recortado ? (
              <p className="mt-2 text-[11.5px] text-system-500">
                Se muestran los primeros {nf.format(MAXIMO_A_LA_VISTA)} caracteres. Abre el archivo para verlo completo.
              </p>
            ) : null}
          </>
        )}
      </div>
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="border-t border-system-200 px-3 py-2 text-[12px] font-semibold text-brand-600 hover:underline"
      >
        Abrir el archivo
      </a>
    </div>
  );
}
