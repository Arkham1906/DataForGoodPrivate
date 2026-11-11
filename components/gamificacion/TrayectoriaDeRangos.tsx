"use client";

// Contenido de la pestaña Trayectoria (2026-11-10; diseño v11, SRS v1.3: RF-GAM-22, 78 a 83): cabecera con el camino
// de los 20 rangos, el rango siguiente (o «Trayectoria completa» en el último), el avistado, «Tu recorrido» y la tabla
// de requisitos. Aquí vive el estado de «qué ficha está abierta»: la abren las tarjetas del camino, el siguiente, el
// avistado y el recorrido, y se navega con ‹ › dentro de la ficha (FichaDeRango, la misma del Resumen).

import { useState } from "react";
import type { DatosDeTrayectoria } from "@/lib/gamificacion/mi-progreso-tipos";
import type { FichaDeRangoAvistado, FichaDeRangoSiguiente } from "@/lib/gamificacion/rangos";
import CaminoDeLaTrayectoria from "./CaminoDeLaTrayectoria";
import FichaDeRango from "./FichaDeRango";
import TablaDeRequisitosDeRangos from "./TablaDeRequisitosRango";
import {
  RecorridoDeRangos,
  TarjetaDelAvistado,
  TarjetaDelSiguienteRango,
  TrayectoriaCompleta,
} from "./TarjetasDeLaTrayectoria";

export default function TrayectoriaDeRangos({
  actual,
  total,
  nombre,
  datos,
}: {
  actual: number;
  total: number;
  /** Nombre del rango actual. */
  nombre: string;
  datos: DatosDeTrayectoria;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const siguiente = datos.fichas.find((f): f is FichaDeRangoSiguiente => f.estado === "siguiente");
  const avistado = datos.fichas.find((f): f is FichaDeRangoAvistado => f.estado === "avistado");

  return (
    <div className="space-y-5">
      {/* key: si el rango cambia (router.refresh tras un ascenso), el tramo del teléfono vuelve al del rango nuevo. */}
      <CaminoDeLaTrayectoria key={actual} actual={actual} total={total} nombre={nombre} eslabones={datos.eslabones} onAbrir={setAbierta} />

      <div className="flex flex-wrap items-stretch gap-5">
        {siguiente ? <TarjetaDelSiguienteRango ficha={siguiente} total={total} onAbrir={setAbierta} /> : <TrayectoriaCompleta total={total} />}
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          {avistado && <TarjetaDelAvistado ficha={avistado} onAbrir={setAbierta} />}
          <RecorridoDeRangos recorrido={datos.recorrido} actual={actual} onAbrir={setAbierta} />
        </div>
      </div>

      <TablaDeRequisitosDeRangos tabla={datos.tabla} actual={actual} total={total} />

      <FichaDeRango fichas={datos.fichas} abierta={abierta} total={total} onIr={setAbierta} onCerrar={() => setAbierta(null)} />
    </div>
  );
}
