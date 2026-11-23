"use client";

// Barra de filtros de las pantallas del panel que todavía no tenían (2026-11-22, a pedido del usuario): una búsqueda
// y listas que se escriben en la URL (?q=, ?tipo=...), como los filtros del directorio /usuarios. La vista filtrada
// se puede compartir, "atrás" funciona y quien filtra es el servidor (cada página, con lib/filtros-en-la-url.ts).
// La búsqueda se aplica sola tras una pausa al teclear; cada cambio quita ?pagina= y conserva los demás parámetros.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState, useTransition } from "react";

export type OpcionDeFiltro = { valor: string; etiqueta: string };

/** Una lista desplegable: `todas` es la opción sin filtro ("Tipo: todos"). */
export type ListaDeFiltro = { clave: string; etiqueta: string; todas: string; opciones: OpcionDeFiltro[] };

type Props = {
  /** Búsqueda de texto; `clave` es el parámetro de la URL (por defecto "q"). */
  busqueda?: { clave?: string; etiqueta: string; placeholder: string };
  listas?: ListaDeFiltro[];
  className?: string;
};

const CLASE_CONTROL =
  "min-h-[38px] rounded border border-system-300 bg-white px-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600";

/** useSearchParams pide un Suspense alrededor; así cada página no tiene que ponerlo. */
export default function FiltrosEnLaUrl(props: Props) {
  return (
    <Suspense fallback={null}>
      <Barra {...props} />
    </Suspense>
  );
}

function Barra({ busqueda, listas = [], className = "mb-5" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const idBusqueda = useId();
  const idLista = useId();

  const claveQ = busqueda?.clave ?? "q";
  const [texto, setTexto] = useState(searchParams.get(claveQ) ?? "");
  // La espera tras teclear se arma al escribir, no en un efecto: así "Quitar filtros" la cancela y no vuelve a
  // escribir en la URL un estado viejo.
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  function cancelarEspera() {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  }

  function escribir(valor: string) {
    setTexto(valor);
    cancelarEspera();
    espera.current = setTimeout(() => aplicar({ [claveQ]: valor.trim() }), 350);
  }

  function aplicar(cambios: Record<string, string>) {
    // La URL de este momento (no la del último render), por si otro filtro cambió mientras se tecleaba.
    const params = new URLSearchParams(window.location.search);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    params.delete("pagina");
    const qs = params.toString();
    iniciar(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const claves = [...(busqueda ? [claveQ] : []), ...listas.map((l) => l.clave)];
  const hayFiltros = claves.some((c) => searchParams.get(c));

  return (
    <div role="search" aria-busy={pendiente} className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {busqueda && (
        <div className="min-w-[220px] flex-1">
          <label className="sr-only" htmlFor={idBusqueda}>
            {busqueda.etiqueta}
          </label>
          <input
            id={idBusqueda}
            type="search"
            value={texto}
            maxLength={100}
            onChange={(e) => escribir(e.target.value)}
            placeholder={busqueda.placeholder}
            className={`${CLASE_CONTROL} w-full px-3.5 py-2`}
          />
        </div>
      )}

      {listas.map((l, i) => {
        const valor = searchParams.get(l.clave) ?? "";
        return (
          <div key={l.clave} className="max-w-full">
            <label className="sr-only" htmlFor={`${idLista}-${i}`}>
              {l.etiqueta}
            </label>
            <select
              id={`${idLista}-${i}`}
              value={l.opciones.some((o) => o.valor === valor) ? valor : ""}
              onChange={(e) => aplicar({ [l.clave]: e.target.value })}
              className={`${CLASE_CONTROL} max-w-full sm:max-w-[260px]`}
            >
              <option value="">{l.todas}</option>
              {l.opciones.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </div>
        );
      })}

      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            cancelarEspera();
            setTexto("");
            aplicar(Object.fromEntries(claves.map((c) => [c, ""])));
          }}
          className="min-h-6 text-[13px] font-semibold text-brand-600 hover:underline"
        >
          Quitar filtros
        </button>
      )}
    </div>
  );
}
