import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Cargando tu trayectoria…</span>
      <Skeleton className="h-[420px] w-full rounded-lg" />
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-[560px] w-full rounded-lg" />
        <div className="space-y-5">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
