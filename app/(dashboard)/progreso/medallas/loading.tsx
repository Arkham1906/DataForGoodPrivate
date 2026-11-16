// Esqueleto de /progreso/medallas. El título y las pestañas ya están en ../layout.tsx.

import Skeleton from "@/components/ui/Skeleton";
import { TEXTOS } from "@/lib/gamificacion/textos";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">{TEXTOS.medallas.cargando}</span>
      <Skeleton className="h-64 w-full rounded-lg max-md:h-80" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-lg max-md:h-24" />
        ))}
      </div>
    </div>
  );
}
