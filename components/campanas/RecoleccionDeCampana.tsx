// "Aportes recibidos" de una campaña (2026-11-22, a pedido del usuario): gráfica por día, semana, mes o año con su
// periodo (este mes por defecto; también hoy, esta semana, este año, todo el histórico desde el inicio de la campaña o fechas específicas).
// La comparten el panel del creador (/mis-campanas/[id]/panel), el de la supervisión (/supervision/[id]/panel y
// /supervisar/[id]/panel, components/supervision/PanelDeCampanaSupervisor) y el del SuperUsuario
// (/sistema/campanas/[id]). Sin estado ni imports de servidor: sirve en páginas de servidor y de cliente.
// Datos: `recoleccion` de lib/campanas/panel.ts o de GET /api/campanas/[id]/recoleccion-diaria.

import { Suspense } from "react";
import GraficaDeTiempo from "@/components/ui/GraficaDeTiempo";
import SelectorDePeriodo from "@/components/ui/SelectorDePeriodo";
import { NOMBRE_DE_UNIDAD, textoDelPeriodo, type Periodo, type SerieDeTiempo } from "@/lib/periodo";

export default function RecoleccionDeCampana({
  serie,
  periodo,
  nombre,
}: {
  serie: SerieDeTiempo;
  periodo: Periodo;
  /** Nombre de la campaña, para la descripción de la tabla. */
  nombre: string;
}) {
  const enElPeriodo = textoDelPeriodo(periodo);
  const titulo = `Aportes recibidos ${NOMBRE_DE_UNIDAD[serie.unidad]}`;

  return (
    <section className="rounded-lg border border-system-200 bg-white p-4 shadow-sm sm:p-5" aria-label={titulo}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-[13px] font-bold text-system-900">
          {titulo} <span className="font-normal text-system-500">· {enElPeriodo}</span>
        </h2>
        <Suspense fallback={null}>
          <SelectorDePeriodo periodo={periodo} defecto="mes" />
        </Suspense>
      </div>
      <GraficaDeTiempo
        serie={serie}
        series={[{ nombre: "Aportes", color: "brand" }]}
        descripcion={`${titulo} en ${nombre}, ${enElPeriodo}`}
        vacio="No llegaron aportes en este periodo."
      />
    </section>
  );
}
