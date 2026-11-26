"use client";

// Barra de filtros de las pantallas del panel que todavía no tenían (2026-11-22, a pedido del usuario): una búsqueda
// y listas que se escriben en la URL (?q=, ?tipo=...), como los filtros del directorio /usuarios. La vista filtrada
// se puede compartir, "atrás" funciona y quien filtra es el servidor (cada página, con lib/filtros-en-la-url.ts).
// La búsqueda se aplica sola tras una pausa al teclear; cada cambio quita ?pagina= y conserva los demás parámetros.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState, useTransition } from "react";
import PanelDeFiltrosMovil from "@/components/ui/PanelDeFiltrosMovil";

export type OpcionDeFiltro = { valor: string; etiqueta: string };

/** Una lista desplegable: `todas` es la opción sin filtro ("Tipo: todos"). */
export type ListaDeFiltro = { clave: string; etiqueta: string; todas: string; opciones: OpcionDeFiltro[] };

type Props = {
  /** Búsqueda de texto; `clave` es el parámetro de la URL (por defecto "q"). */
  busqueda?: { clave?: string; etiqueta: string; placeholder: string };
  listas?: ListaDeFiltro[];
  tituloPanelMovil?: string;
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

function Barra({ busqueda, listas = [], tituloPanelMovil, className = "mb-5" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const idBusqueda = useId();
  const idLista = useId();
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const consulta = searchParams.toString();
  const ultimaConsulta = useRef(consulta);
  useEffect(() => { ultimaConsulta.current = consulta; }, [consulta]);

  const claveQ = busqueda?.clave ?? "q";
  const [texto, setTexto] = useState(searchParams.get(claveQ) ?? "");
  // La espera tras teclear se arma al escribir, no en un efecto: así "Quitar filtros" la cancela y no vuelve a
  // escribir en la URL un estado viejo.
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    function restaurar() {
      cancelarEspera();
      const params = new URLSearchParams(window.location.search);
      ultimaConsulta.current = params.toString();
      setTexto(params.get(claveQ) ?? "");
      setAbierto(false);
    }
    window.addEventListener("popstate", restaurar);
    return () => {
      cancelarEspera();
      window.removeEventListener("popstate", restaurar);
    };
  }, [claveQ]);

  function cancelarEspera() {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  }

  function escribir(valor: string) {
    setTexto(valor);
    cancelarEspera();
    espera.current = setTimeout(() => aplicar({ [claveQ]: valor.trim() }), 350);
  }

  function aplicar(cambios: Record<string, string>, guardarEnHistorial = false) {
    const params = new URLSearchParams(ultimaConsulta.current);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    params.delete("pagina");
    const qs = params.toString();
    if (qs === ultimaConsulta.current) return;
    ultimaConsulta.current = qs;
    const destino = qs ? `${pathname}?${qs}` : pathname;
    iniciar(() => {
      if (guardarEnHistorial) router.push(destino, { scroll: false });
      else router.replace(destino, { scroll: false });
    });
  }

  const claves = [...(busqueda ? [claveQ] : []), ...listas.map((l) => l.clave)];
  const hayFiltros = claves.some((c) => searchParams.get(c));

  function valorDeLista(lista: ListaDeFiltro) {
    const valor = searchParams.get(lista.clave) ?? "";
    return lista.opciones.some((o) => o.valor === valor) ? valor : "";
  }

  function selectores(enPanel: boolean) {
    return listas.map((lista) => {
      const id = `${idLista}-${enPanel ? "movil" : "barra"}-${lista.clave}`;
      return (
        <div key={lista.clave} className={tituloPanelMovil ? "min-w-0 flex-1" : "max-w-full"}>
          <label className="sr-only" htmlFor={id}>{lista.etiqueta}</label>
          <select
            id={id}
            value={enPanel ? borrador[lista.clave] ?? "" : valorDeLista(lista)}
            onChange={(e) => {
              const valor = e.target.value;
              if (enPanel) setBorrador((actual) => ({ ...actual, [lista.clave]: valor }));
              else aplicar({ [lista.clave]: valor }, Boolean(tituloPanelMovil));
            }}
            className={`${CLASE_CONTROL} ${tituloPanelMovil ? "w-full" : "max-w-full sm:max-w-[260px]"}`}
          >
            <option value="">{lista.todas}</option>
            {lista.opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>
        </div>
      );
    });
  }

  return (
    <div role="search" aria-busy={pendiente} className={`relative flex flex-wrap items-center gap-2.5 ${className}`}>
      {busqueda && (
        <div className={tituloPanelMovil ? "min-w-0 flex-1 md:min-w-[220px]" : "min-w-[220px] flex-1"}>
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

      {tituloPanelMovil ? (
        <>
          <div className="hidden md:contents">{selectores(false)}</div>
          <PanelDeFiltrosMovil
            titulo={tituloPanelMovil}
            abierto={abierto}
            alternar={() => {
              if (!abierto) setBorrador(Object.fromEntries(listas.map((l) => [l.clave, valorDeLista(l)])));
              setAbierto(!abierto);
            }}
            aplicar={() => {
              cancelarEspera();
              aplicar(busqueda ? { ...borrador, [claveQ]: texto.trim() } : borrador, true);
              setAbierto(false);
            }}
          >
            {selectores(true)}
          </PanelDeFiltrosMovil>
        </>
      ) : selectores(false)}

      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            cancelarEspera();
            setTexto("");
            setAbierto(false);
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
