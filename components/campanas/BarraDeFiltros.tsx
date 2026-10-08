"use client";

// Barra de filtros de campañas: búsqueda, temática, tipo de dato, vigencia (opcional) y orden.
// Solo dibuja y avisa de los cambios; quien la usa decide qué hacer con ellos:
// /sistema/campanas los escribe en la URL y /supervision y /supervisar filtran en el navegador.
// Constantes de lib/campanas/sistema-opciones.ts (sin imports de servidor).

import { useEffect, useId, useState } from "react";

import { NOMBRE_DE_TIPO, ORDENES_DE_CAMPANA, VIGENCIAS, type TipoDeDato } from "@/lib/campanas/sistema-opciones";

const TIPOS = Object.keys(NOMBRE_DE_TIPO) as TipoDeDato[];

const CLASE_SELECT =
  "min-h-[38px] w-full rounded border border-system-300 bg-white px-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600";

export type ValoresDeFiltros = {
  q: string;
  tematica: string;
  tipo: string;
  vigencia?: string;
  orden: string;
};

export default function BarraDeFiltros({
  valores,
  tematicas,
  onCambiar,
  conVigencia = false,
  colapsableEnMovil = false,
}: {
  valores: ValoresDeFiltros;
  tematicas: string[];
  onCambiar: (clave: keyof ValoresDeFiltros, valor: string) => void;
  /** Muestra el filtro "Vigencia" (solo /sistema/campanas). */
  conVigencia?: boolean;
  /** En móvil mantiene la búsqueda visible y coloca los controles en un panel emergente. */
  colapsableEnMovil?: boolean;
}) {
  const [texto, setTexto] = useState(valores.q);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [filtrosBorrador, setFiltrosBorrador] = useState({
    tematica: valores.tematica,
    tipo: valores.tipo,
    vigencia: valores.vigencia,
    orden: valores.orden,
  });

  const idQ = useId();
  const idPanel = useId();
  const idTema = useId();
  const idTipo = useId();
  const idVig = useId();
  const idOrden = useId();

  // La búsqueda se aplica sola tras una pausa al teclear.
  useEffect(() => {
    if (texto === valores.q) return;
    const t = setTimeout(() => onCambiar("q", texto), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  function campoBusqueda(sufijo: string) {
    const id = `${idQ}-${sufijo}`;
    return (
      <div className="min-w-[220px] flex-1">
        <label className="sr-only" htmlFor={id}>
          Buscar campaña
        </label>
        <input
          id={id}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre, temática, creador o ID"
          className="w-full rounded border border-system-300 bg-white px-3.5 py-2 text-sm text-system-900 outline-none transition-colors focus:border-brand-600"
        />
      </div>
    );
  }

  function controles(sufijo: string, borrador: boolean) {
    const filtros = borrador ? { ...valores, ...filtrosBorrador } : valores;
    const cambiar = (clave: keyof ValoresDeFiltros, valor: string) => {
      if (borrador) {
        setFiltrosBorrador((actuales) => ({ ...actuales, [clave]: valor }));
      } else {
        onCambiar(clave, valor);
      }
    };

    return (
      <>
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`${idTema}-${sufijo}`}>
            Filtrar por temática
          </label>
          <select
            id={`${idTema}-${sufijo}`}
            className={CLASE_SELECT}
            value={filtros.tematica}
            onChange={(e) => cambiar("tematica", e.target.value)}
          >
            <option value="">Temática: todas</option>
            {tematicas.map((tema) => (
              <option key={tema} value={tema}>
                {tema}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`${idTipo}-${sufijo}`}>
            Filtrar por tipo de dato
          </label>
          <select
            id={`${idTipo}-${sufijo}`}
            className={CLASE_SELECT}
            value={filtros.tipo}
            onChange={(e) => cambiar("tipo", e.target.value)}
          >
            <option value="">Tipo de dato: todos</option>
            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {NOMBRE_DE_TIPO[tipo]}
              </option>
            ))}
          </select>
        </div>

        {conVigencia && (
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={`${idVig}-${sufijo}`}>
              Filtrar por vigencia
            </label>
            <select
              id={`${idVig}-${sufijo}`}
              className={CLASE_SELECT}
              value={filtros.vigencia ?? ""}
              onChange={(e) => cambiar("vigencia", e.target.value)}
            >
              <option value="">Vigencia: cualquiera</option>
              {VIGENCIAS.map((vigencia) => (
                <option key={vigencia.valor} value={vigencia.valor}>
                  {vigencia.etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`${idOrden}-${sufijo}`}>
            Ordenar por
          </label>
          <select
            id={`${idOrden}-${sufijo}`}
            className={CLASE_SELECT}
            value={filtros.orden}
            onChange={(e) => cambiar("orden", e.target.value)}
          >
            <option value="">Más recientes</option>
            {ORDENES_DE_CAMPANA.map((orden) => (
              <option key={orden.valor} value={orden.valor}>
                {orden.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </>
    );
  }

  function alternarPanel() {
    if (!panelAbierto) {
      setFiltrosBorrador({
        tematica: valores.tematica,
        tipo: valores.tipo,
        vigencia: valores.vigencia,
        orden: valores.orden,
      });
    }
    setPanelAbierto((abierto) => !abierto);
  }

  function aplicarPanel() {
    onCambiar("tematica", filtrosBorrador.tematica);
    onCambiar("tipo", filtrosBorrador.tipo);
    onCambiar("orden", filtrosBorrador.orden);
    if (filtrosBorrador.vigencia !== undefined) onCambiar("vigencia", filtrosBorrador.vigencia);
    setPanelAbierto(false);
  }

  return (
    <>
      {colapsableEnMovil && (
        <div className="relative mb-5 md:hidden">
          <div className="flex items-center gap-2.5">
            {campoBusqueda("mobile")}
            <button
              type="button"
              aria-label={panelAbierto ? "Cerrar filtros" : "Abrir filtros"}
              aria-expanded={panelAbierto}
              aria-controls={idPanel}
              onClick={alternarPanel}
              className={`grid size-[42px] shrink-0 place-items-center rounded border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                panelAbierto ? "border-brand-600 bg-brand-50 text-brand-600" : "border-system-300 bg-white text-system-600 hover:border-brand-600 hover:text-brand-600"
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
                <path d="M4 7h9m4 0h3M4 17h3m4 0h9M13 5v4M7 15v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <section
            id={idPanel}
            aria-label="Filtros de campañas"
            hidden={!panelAbierto}
            className="absolute inset-x-0 top-full z-30 mt-2 rounded-lg border border-system-200 bg-white p-4 shadow-lg"
          >
            <h2 className="mb-3 text-sm font-bold text-system-900">Filtros de campañas</h2>
            <div className="flex flex-col gap-2.5">{controles("mobile", true)}</div>
            <button
              type="button"
              onClick={aplicarPanel}
              className="mt-4 w-full rounded border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-600/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Filtrar
            </button>
          </section>
        </div>
      )}

      <div className={colapsableEnMovil ? "mb-5 hidden flex-wrap items-center gap-2.5 md:flex" : "mb-5 flex flex-wrap items-center gap-2.5"}>
        {campoBusqueda("desktop")}
        {controles("desktop", false)}
      </div>
    </>
  );
}
