// Esqueleto cuadriculado de CampaignCard, con los espacios del diseño de portada. Se muestra mientras
// /campanas trae las campañas, para que al llegar no se mueva la pantalla. Si cambia CampaignCard, ajustar aquí.
// 2026-11-18: mismo marco que la tarjeta real de la cuadrícula (Card con su relleno, rounded-lg y sombra;
// los rellenos y espacios de móvil de `mobileCompact`), en vez de un banner pegado al borde.

import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";

export default function CampaignCardSkeleton() {
  return (
    <Card className="flex min-w-0 flex-col gap-3 max-md:gap-2.5 max-md:p-3.5 max-sm:gap-2 max-sm:p-2.5">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="flex flex-1 flex-col p-3">
        <div className="flex min-h-[2.75rem] flex-col gap-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
        <div className="mt-2 h-8">
          <Skeleton className="h-7 w-28 rounded-pill" />
        </div>
        <div className="mt-auto">
          <div className="flex items-center gap-2">
            <Skeleton className="h-[7px] flex-1 rounded-pill" />
            <Skeleton className="h-[1.1rem] w-8" />
          </div>
          <div className="mt-3 flex h-14 flex-wrap content-start gap-1.5 overflow-hidden">
            <Skeleton className="h-7 w-14 rounded-pill" />
            <Skeleton className="h-7 w-14 rounded-pill" />
          </div>
          <div className="mt-2 border-t border-system-200 pt-2">
            <Skeleton className="h-[1.2rem] w-24" />
          </div>
        </div>
      </div>
    </Card>
  );
}
