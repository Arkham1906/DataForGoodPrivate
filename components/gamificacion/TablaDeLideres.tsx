"use client";

// Tabla de líderes de la landing (2026-10-13): las 6 primeras personas por aportes, por nivel o por
// temática; las 3 primeras en el Podio y el resto en ListaDeLideres. Cliente solo para cambiar de
// categoría y de temática sin recargar: la landing (Server Component) le pasa toda la tabla ya armada
// con obtenerTablaDeLideres() (lib/gamificacion/clasificacion.ts).

import { useState } from "react";
import ListaDeLideres from "./ListaDeLideres";
import Podio from "./Podio";
import {
  CATEGORIAS_DE_CLASIFICACION,
  LIDERES_POR_CATEGORIA,
  LUGARES_DEL_PODIO,
  type CategoriaDeClasificacion,
  type TablaDeLideres as Tabla,
} from "@/lib/gamificacion/tipos";

export default function TablaDeLideres({ tabla }: { tabla: Tabla }) {
  const [categoria, setCategoria] = useState<CategoriaDeClasificacion>("aportes");
  const [tematica, setTematica] = useState(tabla.tematicas[0]?.tematica ?? "");

  const lideres = (
    categoria === "tematica"
      ? (tabla.tematicas.find((t) => t.tematica === tematica)?.lideres ?? [])
      : tabla[categoria]
  ).slice(0, LIDERES_POR_CATEGORIA);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Categoría" className="flex flex-wrap gap-2">
          {CATEGORIAS_DE_CLASIFICACION.map((c) => (
            <button
              key={c.valor}
              type="button"
              aria-pressed={categoria === c.valor}
              onClick={() => setCategoria(c.valor)}
              className={`whitespace-nowrap rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                categoria === c.valor
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-system-300 bg-white text-system-600 hover:border-brand-600"
              }`}
            >
              {c.etiqueta}
            </button>
          ))}
        </div>

        {categoria === "tematica" && tabla.tematicas.length > 0 && (
          <div className="flex items-center gap-2">
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
        )}
      </div>

      {lideres.length === 0 ? (
        <p className="rounded-lg bg-system-100 p-4 text-center text-[13px] text-system-600">
          Todavía no hay suficientes aportes aprobados para armar esta tabla.
        </p>
      ) : (
        <div className="grid gap-6">
          <Podio lideres={lideres.slice(0, LUGARES_DEL_PODIO)} categoria={categoria} />
          <ListaDeLideres
            lideres={lideres.slice(LUGARES_DEL_PODIO)}
            categoria={categoria}
            desde={LUGARES_DEL_PODIO + 1}
          />
        </div>
      )}
    </div>
  );
}
