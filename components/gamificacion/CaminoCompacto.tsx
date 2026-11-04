"use client";

// Camino compacto de rangos (2026-11-02; SRS v1.1: RF-GAM-78): tu rango, el siguiente y el avistado, cada uno
// como botón que abre su ficha (FichaDeRango). Es la versión resumida de la trayectoria completa (que vendrá en
// /progreso). Recibe solo las fichas que el servidor decidió enviar (RNF-GAM-14), así que no hay forma de
// mostrar un rango que la persona aún no puede ver. Aquí vive el estado de «qué ficha está abierta».

import { useState } from "react";
import type { FichaDeRango as DatosDeFicha } from "@/lib/gamificacion/rangos";
import FichaDeRango from "./FichaDeRango";
import InsigniaDeRango from "./InsigniaDeRango";

function etiquetaDe(ficha: DatosDeFicha): string {
  if (ficha.estado === "actual") return `Tu rango, ${ficha.numero}, ${ficha.nombre}. Abre su ficha.`;
  if (ficha.estado === "siguiente") return `Siguiente rango, ${ficha.numero}, ${ficha.nombre}. Abre su ficha.`;
  if (ficha.estado === "alcanzado") return `Rango ${ficha.numero}, ${ficha.nombre}, alcanzado. Abre su ficha.`;
  if (ficha.estado === "oculto") return `Rango ${ficha.numero}, por descubrir. Abre su ficha.`;
  return `Rango ${ficha.numero}, avistado. Abre su ficha.`;
}

export default function CaminoCompacto({ fichas, total }: { fichas: DatosDeFicha[]; total: number }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  return (
    <>
      <ol aria-label="Tu rango, el siguiente y el avistado" className="flex items-center gap-1.5">
        {fichas.map((ficha, i) => (
          <li key={ficha.numero} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAbierta(ficha.numero)}
              aria-haspopup="dialog"
              aria-label={etiquetaDe(ficha)}
              className="rounded-lg transition-transform active:scale-95 motion-reduce:transition-none"
            >
              <InsigniaDeRango numero={ficha.numero} estado={ficha.estado} />
            </button>
            {i < fichas.length - 1 && <span aria-hidden="true" className="w-[18px] border-t-2 border-dashed border-brand-300" />}
          </li>
        ))}
      </ol>
      <FichaDeRango fichas={fichas} abierta={abierta} total={total} onIr={setAbierta} onCerrar={() => setAbierta(null)} />
    </>
  );
}
