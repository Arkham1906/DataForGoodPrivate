// Esqueleto mientras el servidor arma el Resumen (Next lo muestra solo). El título y las pestañas ya están en
// ./layout.tsx: aquí va solo la forma del contenido.

import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Cargando tu progreso…</span>
      <Skeleton className="h-[380px] w-full rounded-lg" />
      <Skeleton className="h-52 w-full rounded-lg" />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  );
}
