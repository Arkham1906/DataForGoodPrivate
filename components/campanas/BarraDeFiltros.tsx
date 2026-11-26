"use client";

// Barra de filtros de campañas: búsqueda, temática, etiqueta (subtemática de la temática elegida,
// 2026-10-27; solo si quien la usa pasa `etiquetasPorTematica`), tipo de dato, vigencia (opcional) y orden.
// Quien la usa vacía la etiqueta cuando cambia la temática.
// Con `vistas` (2026-10-31, solo /campanas) va primero un select "Mostrar" (todas, favoritas, cerca de ti...).
// Solo dibuja y avisa de los cambios; quien la usa decide qué hacer con ellos:
// /sistema/campanas los escribe en la URL y /supervision, /supervisar y /campanas filtran en el navegador.
// Constantes de lib/campanas/sistema-opciones.ts (sin imports de servidor).

import { useEffect, useId, useState } from "react";

import SelectorDeOrden from "@/components/ui/SelectorDeOrden";
import PanelDeFiltrosMovil from "@/components/ui/PanelDeFiltrosMovil";
import SelectorDeTipos from "@/components/campanas/SelectorDeTipos";
import { ORDENES_DE_CAMPANA, VIGENCIAS } from "@/lib/campanas/sistema-opciones";

const CLASE_SELECT =
  "min-h-[38px] w-full rounded border border-system-300 bg-white px-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600";

export type ValoresDeFiltros = {
  q: string;
  /** Lista que se muestra (solo con `vistas`). */
  vista?: string;
  tematica: string;
  etiqueta?: string;
  /** Uno o varios tipos separados por comas (ver tiposDesde). */
  tipo: string;
  vigencia?: string;
  orden: string;
};

export default function BarraDeFiltros({
  valores,
  tematicas,
  onCambiar,
  onAplicarPanel,
  conVigencia = false,
  colapsableEnMovil = false,
  conTematica = true,
  textoSinTematica = "Temática: todas",
  conTipo = true,
  contarTipos,
  etiquetasPorTematica,
  vistas,
  categoria,
  ordenRedondeado = false,
}: {
  valores: ValoresDeFiltros;
  tematicas: string[];
  /** Etiquetas de cada temática que hay en la lista: con una temática elegida, aparece el filtro de etiqueta. */
  etiquetasPorTematica?: Record<string, string[]>;
  onCambiar: (clave: keyof ValoresDeFiltros, valor: string) => void;
  /** Permite enviar juntos los filtros del panel cuando se aplican en el servidor. */
  onAplicarPanel?: (valores: ValoresDeFiltros) => void;
  /** Muestra el filtro "Vigencia" (solo /sistema/campanas). */
  conVigencia?: boolean;
  /** En móvil mantiene la búsqueda visible y coloca los controles en un panel emergente. */
  colapsableEnMovil?: boolean;
  /** false: sin el select de temática (/campanas, donde la temática se elige con botones). */
  conTematica?: boolean;
  textoSinTematica?: string;
  /** false: sin el select de tipo de dato. */
  conTipo?: boolean;
  /** Cuántas campañas quedarían con cada tipo para estos filtros (en móvil, los del borrador); sin él no hay número. */
  contarTipos?: (filtros: ValoresDeFiltros) => Record<string, number>;
  /** Select "Mostrar" con estas listas (p. ej. Todas / Favoritas / Cerca de ti); sin él no sale. */
  vistas?: { valor: string; etiqueta: string }[];
  categoria?: {
    valor: string;
    grupos: { etiqueta: string; opciones: { valor: string; etiqueta: string }[] }[];
    onCambiar: (valor: string) => void;
  };
  ordenRedondeado?: boolean;
}) {
  const [texto, setTexto] = useState(valores.q);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [filtrosBorrador, setFiltrosBorrador] = useState({
    vista: valores.vista ?? "",
    tematica: valores.tematica,
    etiqueta: valores.etiqueta ?? "",
    tipo: valores.tipo,
    vigencia: valores.vigencia,
    orden: valores.orden,
  });

  const idQ = useId();
  const idVista = useId();
  const idTema = useId();
  const idEtiqueta = useId();
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

  function selectorDeCategoria() {
    if (!categoria) return null;
    return (
      <label className="min-w-0 flex-1">
        <span className="sr-only">Mostrar campañas por categoría</span>
        <select
          className={CLASE_SELECT}
          value={categoria.valor}
          onChange={(e) => {
            setPanelAbierto(false);
            categoria.onCambiar(e.target.value);
          }}
        >
          {categoria.grupos.map((grupo) => (
            <optgroup key={grupo.etiqueta} label={grupo.etiqueta}>
              {grupo.opciones.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    );
  }

  function controles(sufijo: string, borrador: boolean) {
    const filtros = borrador ? { ...valores, ...filtrosBorrador } : valores;
    const cambiar = (clave: keyof ValoresDeFiltros, valor: string) => {
      if (borrador) {
        // Otra temática: la etiqueta elegida ya no aplica.
        setFiltrosBorrador((actuales) => ({ ...actuales, [clave]: valor, ...(clave === "tematica" ? { etiqueta: "" } : {}) }));
      } else {
        onCambiar(clave, valor);
      }
    };

    return (
      <>
        {vistas && (
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={`${idVista}-${sufijo}`}>
              Qué campañas mostrar
            </label>
            <select
              id={`${idVista}-${sufijo}`}
              className={CLASE_SELECT}
              value={filtros.vista ?? ""}
              onChange={(e) => cambiar("vista", e.target.value)}
            >
              {vistas.map((v) => (
                <option key={v.valor} value={v.valor}>
                  {v.etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}

        {conTematica && (
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
              <option value="">{textoSinTematica}</option>
              {tematicas.map((tema) => (
                <option key={tema} value={tema}>
                  {tema}
                </option>
              ))}
            </select>
          </div>
        )}

        {conTematica && etiquetasPorTematica && filtros.tematica && (etiquetasPorTematica[filtros.tematica] ?? []).length > 0 && (
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={`${idEtiqueta}-${sufijo}`}>
              Filtrar por etiqueta
            </label>
            <select
              id={`${idEtiqueta}-${sufijo}`}
              className={CLASE_SELECT}
              value={filtros.etiqueta ?? ""}
              onChange={(e) => cambiar("etiqueta", e.target.value)}
            >
              <option value="">Etiqueta: todas</option>
              {etiquetasPorTematica[filtros.tematica].map((etiqueta) => (
                <option key={etiqueta} value={etiqueta}>
                  #{etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}

        {conTipo && <SelectorDeTipos valor={filtros.tipo} onCambiar={(valor) => cambiar("tipo", valor)} clase={CLASE_SELECT} conteos={contarTipos?.(filtros)} />}

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

        {ordenRedondeado ? (
          <SelectorDeOrden
            valor={filtros.orden}
            onCambiar={(valor) => cambiar("orden", valor)}
            opciones={[
              { value: "", label: "Más recientes" },
              ...ORDENES_DE_CAMPANA.map((orden) => ({ value: orden.valor, label: orden.etiqueta })),
            ]}
          />
        ) : <div className="min-w-0 flex-1">
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
        </div>}
      </>
    );
  }

  function alternarPanel() {
    if (!panelAbierto) {
      setFiltrosBorrador({
        vista: valores.vista ?? "",
        tematica: valores.tematica,
        etiqueta: valores.etiqueta ?? "",
        tipo: valores.tipo,
        vigencia: valores.vigencia,
        orden: valores.orden,
      });
    }
    setPanelAbierto((abierto) => !abierto);
  }

  function aplicarPanel() {
    if (onAplicarPanel) {
      onAplicarPanel({ ...filtrosBorrador, q: texto });
      setPanelAbierto(false);
      return;
    }
    if (vistas) onCambiar("vista", filtrosBorrador.vista);
    if (conTematica) onCambiar("tematica", filtrosBorrador.tematica);
    if (conTematica && etiquetasPorTematica) onCambiar("etiqueta", filtrosBorrador.etiqueta);
    if (conTipo) onCambiar("tipo", filtrosBorrador.tipo);
    onCambiar("orden", filtrosBorrador.orden);
    if (filtrosBorrador.vigencia !== undefined) onCambiar("vigencia", filtrosBorrador.vigencia);
    setPanelAbierto(false);
  }

  return (
    <>
      {colapsableEnMovil && (
        <div className="relative mb-5 md:hidden">
          {categoria && <div className="mb-2.5 flex">{selectorDeCategoria()}</div>}
          <div className="flex items-center gap-2.5">
            {campoBusqueda("mobile")}
            <PanelDeFiltrosMovil titulo="Filtros de campañas" abierto={panelAbierto} alternar={alternarPanel} aplicar={aplicarPanel}>
              {controles("mobile", true)}
            </PanelDeFiltrosMovil>
          </div>
        </div>
      )}

      <div className={colapsableEnMovil ? "mb-5 hidden flex-wrap items-center gap-2.5 md:flex" : "mb-5 flex flex-wrap items-center gap-2.5"}>
        {campoBusqueda("desktop")}
        {selectorDeCategoria()}
        {controles("desktop", false)}
      </div>
    </>
  );
}
