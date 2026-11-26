// Esqueleto mientras el servidor arma el Resumen (Next lo muestra solo). El título y las pestañas ya están en
// ./layout.tsx: aquí va solo la forma del contenido.

import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Cargando tu progreso…</span>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}
