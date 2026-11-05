"use client";

// Filas de botones que filtran "Campañas para ti" en /campanas (2026-11-04: salieron de la página).
// useFiltrosDeLista() guarda el filtro: Todas o Tu localidad (Cerca de ti con GPS), temática de sus intereses
// con ★ (las que no caben, en "Más temáticas"), sus subtemáticas y uno o varios tipos de dato.

import { useState } from "react";
import MasTematicas from "@/components/campanas/MasTematicas";
import { NOMBRE_DE_TIPO, alternarTipo, tiposDesde, type TipoDeDato } from "@/lib/campanas/sistema-opciones";
import type { Campaign } from "@/types";

export const TODAS = "";
export const TU_LOCALIDAD = "localidad";

// Temáticas que se muestran como botón; las demás, en "Más temáticas".
const MAXIMO_DE_TEMAS_VISIBLES = 5;
const CLASE_DEL_FILTRO =
  "shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px]";
const CLASE_DE_CHIP = "shrink-0 whitespace-nowrap rounded-pill border px-2.5 py-1 text-[12px] font-semibold transition-colors";
const CLASE_INACTIVO = "border-system-300 bg-white text-system-600 hover:border-brand-600";
const CLASE_ACTIVO = "border-brand-600 bg-brand-600 text-white";
const CLASE_DE_FILA =
  "dashboard-nav flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0";
// Orden de los botones de tipo de dato: el mismo del formulario de campaña.
const TIPOS_DE_DATO = Object.keys(NOMBRE_DE_TIPO) as TipoDeDato[];

/** `coinciden` son las campañas filtradas, en el orden recibido. */
export function useFiltrosDeLista({
  campanas,
  deMiLocalidad,
  esDeMisIntereses,
}: {
  campanas: Campaign[];
  deMiLocalidad: (lista: Campaign[]) => Campaign[];
  esDeMisIntereses: (tema: string) => boolean;
}) {
  const [vista, setVista] = useState(TODAS);
  const [tema, setTema] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [tipo, setTipo] = useState("");

  const enMiLocalidad = deMiLocalidad(campanas);
  const temas = Array.from(
    campanas.reduce(
      (conteo, c) => (c.tag && esDeMisIntereses(c.tag) ? conteo.set(c.tag, (conteo.get(c.tag) ?? 0) + 1) : conteo),
      new Map<string, number>()
    )
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));

  const porVista = vista === TU_LOCALIDAD ? enMiLocalidad : campanas;
  const porTema = tema ? porVista.filter((c) => c.tag === tema) : porVista;
  const porEtiqueta = tema && etiqueta ? porTema.filter((c) => (c.etiquetas ?? []).some((e) => e.nombre === etiqueta)) : porTema;
  // Varios tipos a la vez (2026-11-03): la campaña debe pedirlos todos.
  const tipos = tiposDesde(tipo);
  const coinciden = porEtiqueta.filter((c) => tipos.every((t) => (c.dataTypes ?? []).includes(t)));

  // Subtemáticas de la temática elegida, con cuántas campañas tiene cada una.
  const etiquetasDelTema = tema
    ? Array.from(
        porTema.reduce((conteo, c) => {
          for (const e of c.etiquetas ?? []) if (!e.pendiente) conteo.set(e.nombre, (conteo.get(e.nombre) ?? 0) + 1);
          return conteo;
        }, new Map<string, number>())
      ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    : [];
  // Cada número dice cuántas quedan con ese tipo y los ya elegidos. Salen siempre todos, también en 0: la fila no
  // cambia al filtrar (2026-11-03, a pedido del usuario).
  const tiposDeLaLista = TIPOS_DE_DATO.map(
    (t) => [t, porEtiqueta.filter((c) => [...tipos, t].every((elegido) => (c.dataTypes ?? []).includes(elegido))).length] as const
  );

  return {
    vista,
    tema,
    etiqueta,
    tipo,
    tipos,
    temas,
    etiquetasDelTema,
    tiposDeLaLista,
    coinciden,
    total: campanas.length,
    totalEnMiLocalidad: enMiLocalidad.length,
    activo: vista !== TODAS || tema !== "" || tipo !== "",
    setEtiqueta,
    setTipo,
    // Todas y Tu localidad quitan la temática; una temática vuelve a "todas".
    elegirLista(valor: string) {
      setVista(valor);
      setTema("");
      setEtiqueta("");
    },
    elegirTema(nuevo: string) {
      setVista(TODAS);
      setTema(nuevo);
      setEtiqueta("");
    },
  };
}

export default function FilasDeFiltros({
  filtro,
  lugar,
  cercaDeTi,
  esDeMisIntereses,
  className = "",
}: {
  filtro: ReturnType<typeof useFiltrosDeLista>;
  /** Municipio y estado (GPS) o estado del perfil; vacío: sin ubicación. */
  lugar: string;
  cercaDeTi: boolean;
  esDeMisIntereses: (tema: string) => boolean;
  className?: string;
}) {
  const totalesDeTema = new Map(filtro.temas);
  const temasVisibles = filtro.temas.slice(0, MAXIMO_DE_TEMAS_VISIBLES).map(([tema]) => tema);
  const temasOcultos = filtro.temas.slice(MAXIMO_DE_TEMAS_VISIBLES);
  // Una temática elegida desde "Más temáticas" se ve como botón activo para poder quitarla.
  if (filtro.tema && !temasVisibles.includes(filtro.tema)) temasVisibles.push(filtro.tema);
  // "Tu localidad" solo con ubicación (GPS o estado del perfil): sin ella siempre quedaría vacía.
  const botonesFijos = [
    { valor: TODAS, texto: "Todas", total: filtro.total },
    ...(lugar ? [{ valor: TU_LOCALIDAD, texto: cercaDeTi ? "Cerca de ti" : "Tu localidad", total: filtro.totalEnMiLocalidad }] : []),
  ];

  return (
    <div className={`flex flex-col gap-3 max-md:gap-2 ${className}`}>
      <div className={CLASE_DE_FILA} role="group" aria-label="Filtrar campañas para ti">
        {botonesFijos.map((b) => {
          const activo = filtro.vista === b.valor && !filtro.tema;
          return (
            <button
              key={b.texto}
              type="button"
              onClick={() => filtro.elegirLista(b.valor)}
              aria-pressed={activo}
              title={b.valor === TU_LOCALIDAD ? `Campañas en ${lugar}` : undefined}
              className={`${CLASE_DEL_FILTRO} ${activo ? CLASE_ACTIVO : CLASE_INACTIVO}`}
            >
              {b.texto}
              <span className="ml-1.5 font-mono">{b.total}</span>
            </button>
          );
        })}
        {temasVisibles.map((tema) => {
          const activo = filtro.tema === tema;
          const deMisIntereses = esDeMisIntereses(tema);
          return (
            <button
              key={tema}
              type="button"
              onClick={() => filtro.elegirTema(tema)}
              aria-pressed={activo}
              title={deMisIntereses ? "Está entre tus intereses" : undefined}
              className={`${CLASE_DEL_FILTRO} ${activo ? CLASE_ACTIVO : CLASE_INACTIVO}`}
            >
              {deMisIntereses && (
                <span aria-hidden="true" className={`mr-1 ${activo ? "text-white" : "text-brand-600"}`}>
                  ★
                </span>
              )}
              {tema}
              {deMisIntereses && <span className="sr-only"> (de tus intereses)</span>}
              <span className="ml-1.5 font-mono">{totalesDeTema.get(tema) ?? 0}</span>
            </button>
          );
        })}
        {temasOcultos.length > 0 && (
          <MasTematicas temas={temasOcultos} onElegir={filtro.elegirTema} claseDelBoton={`${CLASE_DEL_FILTRO} ${CLASE_INACTIVO}`} />
        )}
      </div>

      {filtro.etiquetasDelTema.length > 0 && (
        <div className={CLASE_DE_FILA} role="group" aria-label={`Subtemáticas de ${filtro.tema}`}>
          <span className="mr-1 shrink-0 text-[12px] text-system-500">Etiquetas:</span>
          {filtro.etiquetasDelTema.map(([nombreDeEtiqueta, total]) => {
            const activa = filtro.etiqueta === nombreDeEtiqueta;
            return (
              <button
                key={nombreDeEtiqueta}
                type="button"
                aria-pressed={activa}
                onClick={() => filtro.setEtiqueta(activa ? "" : nombreDeEtiqueta)}
                className={`${CLASE_DE_CHIP} ${activa ? CLASE_ACTIVO : CLASE_INACTIVO}`}
              >
                #{nombreDeEtiqueta}
                <span className="ml-1.5 font-mono">{total}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className={CLASE_DE_FILA} role="group" aria-label="Filtrar campañas para ti por tipo de dato">
        <span className="mr-1 shrink-0 text-[12px] text-system-500">Tipo de dato (uno o varios):</span>
        {filtro.tiposDeLaLista.map(([tipo, total]) => {
          const activo = filtro.tipos.includes(tipo);
          return (
            <button
              key={tipo}
              type="button"
              aria-pressed={activo}
              onClick={() => filtro.setTipo(alternarTipo(filtro.tipo, tipo))}
              className={`${CLASE_DE_CHIP} ${activo ? CLASE_ACTIVO : CLASE_INACTIVO}`}
            >
              {NOMBRE_DE_TIPO[tipo]}
              <span className="ml-1.5 font-mono">{total}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
