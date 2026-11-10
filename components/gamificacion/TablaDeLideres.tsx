"use client";

// Tabla de líderes de la landing (2026-10-13): las 6 primeras personas por aportes, por nivel o por
// temática; las 3 primeras en el Podio y el resto en ListaDeLideres. Cliente solo para cambiar de
// categoría y de temática sin recargar: la landing (Server Component) le pasa toda la tabla ya armada
// con obtenerTablaDeLideres() (lib/gamificacion/clasificacion.ts).
// Transiciones del filtro (2026-11-06, a pedido del usuario: "que no se vea esa aparición"): la pastilla se
// desliza entre las categorías, el selector de temática se abre de a poco, la tabla se desvanece antes de
// cambiar y su alto se anima. Con movimiento reducido, todo cambia de golpe.

import { useEffect, useRef, useState } from "react";
import FranjaDeCampo from "@/components/landing/FranjaDeCampo";
import ListaDeLideres from "./ListaDeLideres";
import Podio from "./Podio";
import {
  CATEGORIAS_DE_CLASIFICACION,
  LIDERES_POR_CATEGORIA,
  LUGARES_DEL_PODIO,
  type CategoriaDeClasificacion,
  type TablaDeLideres as Tabla,
} from "@/lib/gamificacion/tipos";

/** Lo que dura el desvanecido de la tabla; igual que `duration-200` de su contenedor. */
const DESVANECIDO_MS = 200;

export default function TablaDeLideres({ tabla }: { tabla: Tabla }) {
  // Lo elegido cambia al instante en el filtro; la tabla pasa a mostrarlo cuando ya se desvaneció.
  const [categoria, setCategoria] = useState<CategoriaDeClasificacion>("aportes");
  const [tematica, setTematica] = useState(tabla.tematicas[0]?.tematica ?? "");
  const [mostrada, setMostrada] = useState({ categoria, tematica });
  const cambiando = mostrada.categoria !== categoria || (categoria === "tematica" && mostrada.tematica !== tematica);

  useEffect(() => {
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const espera = window.setTimeout(() => setMostrada({ categoria, tematica }), reducido ? 0 : DESVANECIDO_MS);
    return () => window.clearTimeout(espera);
  }, [categoria, tematica]);

  // El alto se escribe en el DOM (sin estado) para que la sección crezca o se encoja sin saltos.
  const envoltura = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = contenido.current;
    if (!el) return;
    const observador = new ResizeObserver(() => {
      if (envoltura.current) envoltura.current.style.height = `${el.offsetHeight}px`;
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const lideres = (
    mostrada.categoria === "tematica"
      ? (tabla.tematicas.find((t) => t.tematica === mostrada.tematica)?.lideres ?? [])
      : tabla[mostrada.categoria]
  ).slice(0, LIDERES_POR_CATEGORIA);

  const indice = CATEGORIAS_DE_CLASIFICACION.findIndex((c) => c.valor === categoria);
  const conTematicas = categoria === "tematica" && tabla.tematicas.length > 0;

  return (
    <div>
      <FranjaDeCampo redondeada className="mb-6">
        <div className="relative flex justify-center px-4 py-8">
          <div className="flex max-w-full flex-col items-center rounded-[18px] bg-white p-2 shadow-sm md:flex-row">
            {/* Columnas iguales: la pastilla se mueve por tercios, sin medir cada botón. */}
            <div role="group" aria-label="Categoría" className="relative grid shrink-0 grid-cols-[repeat(3,1fr)]">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1/3 rounded-[10px] bg-system-900 transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: `translateX(${indice * 100}%)` }}
              />
              {CATEGORIAS_DE_CLASIFICACION.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  aria-pressed={categoria === c.valor}
                  onClick={() => setCategoria(c.valor)}
                  className={`relative whitespace-nowrap rounded-[10px] px-3.5 py-2 text-[13.5px] font-medium transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none ${
                    categoria === c.valor ? "text-white" : "text-system-600 hover:text-system-900"
                  }`}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>

            {/* Siempre está en la página: al abrirse crece del alto y el ancho 0, y cerrado no recibe el foco. */}
            {tabla.tematicas.length > 0 && (
              <div
                inert={!conTematicas}
                className={`grid transition-[grid-template-columns,grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                  conTematicas ? "grid-cols-[1fr] grid-rows-[1fr] opacity-100" : "grid-cols-[0fr] grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0 min-w-0 overflow-hidden">
                  <div className="flex w-max items-center gap-2 pt-2 md:pl-4 md:pt-0">
                    <label htmlFor="tematica-de-lideres" className="text-[12.5px] font-medium text-system-600">
                      Temática
                    </label>
                    <select
                      id="tematica-de-lideres"
                      value={tematica}
                      onChange={(e) => setTematica(e.target.value)}
                      className="rounded border border-system-300 bg-white px-3 py-2 text-[13px] text-system-900 outline-none focus:border-brand-600"
                    >
                      {tabla.tematicas.map((t) => (
                        <option key={t.tematica} value={t.tematica}>
                          {t.tematica}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </FranjaDeCampo>

      <div
        ref={envoltura}
        className={`overflow-hidden transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none ${
          cambiando ? "opacity-0" : "opacity-100"
        }`}
      >
        <div ref={contenido} className="pb-1">
          {lideres.length === 0 ? (
            <p className="rounded-lg bg-white p-4 text-center text-[13px] text-system-600">
              {mostrada.categoria === "nivel"
                ? "Todavía nadie ha ganado XP para aparecer en esta tabla."
                : "Todavía no hay aportes aprobados para armar esta tabla."}
            </p>
          ) : (
            <div className="grid gap-6">
              <Podio lideres={lideres.slice(0, LUGARES_DEL_PODIO)} categoria={mostrada.categoria} />
              <ListaDeLideres
                lideres={lideres.slice(LUGARES_DEL_PODIO)}
                categoria={mostrada.categoria}
                desde={LUGARES_DEL_PODIO + 1}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
