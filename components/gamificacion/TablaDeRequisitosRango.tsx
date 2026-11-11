"use client";

// «Requisitos de los 20 rangos» de la Trayectoria.

import { useId, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import type { FilaDeRequisitosDeRango } from "@/lib/gamificacion/mi-progreso-tipos";
import { CLAVES_DE_REQUISITO, ETIQUETAS_CORTAS } from "@/lib/gamificacion/rangos";

const nf = new Intl.NumberFormat("es-MX");

function textoDelHorizonte(actual: number, total: number): string {
  if (actual >= total) return "Ya descubriste todos los rangos. Aquí tienes lo que pidió cada uno.";
  if (actual >= total - 1) return "Ya puedes ver todos los rangos.";
  const primero = actual + 3;
  if (primero > total) return `Del rango ${total} ya tienes una pista. Su nombre aparece cuando se vuelva tu siguiente rango.`;
  const cuales = primero === total ? `El rango ${total} solo muestra` : `Del ${primero} al ${total} solo ves`;
  return `${cuales} el número y lo que pide${primero === total ? "" : "n"}. El nombre, la insignia y las recompensas aparecen cuando se vuelve tu siguiente rango.`;
}

export default function TablaDeRequisitosDeRangos({
  tabla,
  actual,
  total,
}: {
  tabla: FilaDeRequisitosDeRango[];
  actual: number;
  total: number;
}) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();

  return (
    <section aria-labelledby="requisitos-titulo" className="flex flex-col gap-2.5 rounded-lg border border-system-200 bg-white p-6 shadow-sm max-md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-[1_1_420px]">
          <h2 id="requisitos-titulo" className="text-lg font-extrabold text-system-900">
            Requisitos de los {total} rangos
          </h2>
          <p className="mt-1 text-sm text-system-700">{textoDelHorizonte(actual, total)}</p>
        </div>
        <button type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta} aria-controls={id} className={buttonClasses("secondary")}>
          {abierta ? "Ocultar la tabla" : "Ver la tabla"}
        </button>
      </div>

      <div id={id} hidden={!abierta} className="space-y-2">
        <div className="max-h-[520px] overflow-auto rounded-lg border border-system-100">
          <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
            <caption className="sr-only">Requisitos de cada rango. La fila marcada es tu rango actual.</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky top-0 bg-white px-2.5 py-2.5 text-left text-[12px] font-bold text-system-700">
                  Rango
                </th>
                {CLAVES_DE_REQUISITO.map((clave) => (
                  <th key={clave} scope="col" className="sticky top-0 bg-white px-2.5 py-2.5 text-right text-[12px] font-bold text-system-700">
                    {ETIQUETAS_CORTAS[clave]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.map((f) => (
                <tr key={f.numero} className={f.numero === actual ? "bg-brand-50" : undefined}>
                  <th scope="row" className="border-t border-system-100 px-2.5 py-2 text-left font-semibold whitespace-nowrap text-system-900">
                    <span className="inline-block w-6 font-mono text-system-600">{f.numero}</span>
                    {f.nombre ?? (
                      <>
                        <span aria-hidden="true" className="inline-block h-2.5 w-[72px] rounded-pill bg-system-700/20 align-middle blur-[2px]" />
                        <span className="sr-only">Nombre por descubrir</span>
                      </>
                    )}
                    {f.numero === actual && (
                      <span className="ml-2 rounded-pill bg-brand-600 px-2 py-0.5 text-[11.5px] font-bold text-white">Tu rango</span>
                    )}
                  </th>
                  {CLAVES_DE_REQUISITO.map((clave) => (
                    <td key={clave} className="border-t border-system-100 px-2.5 py-2 text-right font-mono whitespace-nowrap text-system-900">
                      {nf.format(f.requisitos[clave])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-system-600">
          «4★ o más» cuenta los aportes Sobresalientes (4★) y Excepcionales (5★); «5★», solo los Excepcionales. La racha es la
          que tengas al momento de subir.
        </p>
      </div>
    </section>
  );
}
