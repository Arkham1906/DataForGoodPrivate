// Esqueleto mientras el servidor arma /mis-aportes (Next lo muestra solo; ver ui/Esqueletos). 2026-11-13, a pedido
// del usuario: desde que la página pasó a servidor (calificaciones y mapa de aportes de Andrey) no se veía nada
// mientras cargaba. Imita la pantalla: encabezado con "Explorar campañas", «Cómo calificaron tus aportes», «Tu mapa
// de aportes», los filtros y la lista. Después, mientras la lista (cliente) trae los aportes, ListaDeMisAportes
// muestra su propio esqueleto de filtros y aportes. Los dos van sin el texto "Cargando…" (ni oculto).

import Skeleton from "@/components/ui/Skeleton";
import { EsqueletoDeEncabezado, EsqueletoDeFiltros, EsqueletoDeFilas } from "@/components/ui/Esqueletos";

function Recuadro({ alto }: { alto: string }) {
  return (
    <div className="rounded-lg border border-system-200 bg-white p-5 shadow-sm">
      <Skeleton className="h-6 w-56 max-w-full" />
      <Skeleton className="mt-2 h-3.5 w-80 max-w-full" />
      <Skeleton className={`mt-4 w-full ${alto}`} />
    </div>
  );
}

export default function Loading() {
  return (
    // Sin texto, tampoco para el lector de pantalla (decisión del usuario, 2026-11-13): solo el esqueleto, decorativo.
    <div aria-hidden="true">
      <EsqueletoDeEncabezado conBoton />
      <div className="mb-6 flex flex-col gap-5 max-md:mb-4 max-md:gap-4">
        <Recuadro alto="h-24" />
        <Recuadro alto="h-64 max-md:h-40" />
      </div>
      <EsqueletoDeFiltros cantidad={4} />
      <EsqueletoDeFilas cantidad={5} />
    </div>
  );
}
