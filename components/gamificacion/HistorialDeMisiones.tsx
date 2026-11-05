"use client";

// Historial de misiones completadas (2026-11-04; diseño v10, RF-GAM-42): misión, periodo, fecha y, si la hubo, recompensa, con filtro
// por periodicidad. Es cliente solo por el filtro: los datos ya vienen del servidor (las últimas 50).

import { useState } from "react";
import Tag from "@/components/ui/Tag";
import type { MisionCompletada } from "@/lib/gamificacion/misiones";
import type { Periodicidad } from "@/lib/gamificacion/misiones-reglas";

type Filtro = "todas" | Periodicidad;

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "diaria", etiqueta: "Diarias" },
  { valor: "semanal", etiqueta: "Semanales" },
];

const NOMBRE_DE_PERIODO: Record<Periodicidad, string> = { diaria: "Diaria", semanal: "Semanal" };

export default function HistorialDeMisiones({ historial }: { historial: MisionCompletada[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const filas = historial.filter((h) => filtro === "todas" || h.periodicidad === filtro);
  const conRecompensas = historial.some((h) => h.recompensa);

  return (
    <section aria-labelledby="misiones-historial" className="flex min-w-0 flex-col gap-3 rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="misiones-historial" className="text-lg font-extrabold text-system-900">
          Historial de misiones completadas
        </h2>
        <div role="group" aria-label="Filtrar historial" className="flex gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              aria-pressed={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`rounded-pill border px-3 py-1.5 text-[13px] font-semibold ${
                filtro === f.valor ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-700 hover:border-brand-600"
              }`}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>
      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-system-300 p-8 text-center text-[13px] text-system-600">
          Aquí aparecerán las misiones que completes.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead>
              <tr className="text-[12.5px] text-system-700">
                <th scope="col" className="py-1.5 pr-3 font-bold">Misión</th>
                <th scope="col" className="py-1.5 pr-3 font-bold">Periodo</th>
                <th scope="col" className="py-1.5 pr-3 font-bold">Completada</th>
                {conRecompensas && <th scope="col" className="py-1.5 text-right font-bold">Recompensa entregada</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((h) => (
                <tr key={h.id} className="border-t border-system-100">
                  <th scope="row" className="py-2.5 pr-3 font-semibold text-system-900">{h.nombre}</th>
                  <td className="py-2.5 pr-3 text-system-700">{NOMBRE_DE_PERIODO[h.periodicidad]}, {h.periodo}</td>
                  <td className="py-2.5 pr-3 text-system-700">{h.completadaEn}</td>
                  {conRecompensas && <td className="py-2.5 text-right">{h.recompensa && <Tag tone="info">{h.recompensa}</Tag>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
