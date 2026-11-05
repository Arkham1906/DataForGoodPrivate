// Esqueleto de /progreso/misiones. El título y las pestañas ya están en ../layout.tsx.

import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Cargando tus misiones…</span>
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
