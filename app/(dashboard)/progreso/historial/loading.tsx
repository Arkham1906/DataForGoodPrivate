// Esqueleto de /progreso/historial. El título y las pestañas ya están en ../layout.tsx.

import Skeleton from "@/components/ui/Skeleton";
import { TEXTOS } from "@/lib/gamificacion/textos";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{TEXTOS.historialDeExp.cargandoPagina}</span>
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="grid items-start gap-5 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-[28rem] w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg max-lg:hidden" />
      </div>
    </div>
  );
}
