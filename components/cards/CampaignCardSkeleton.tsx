// Esqueleto de CampaignCard (2026-10-07, experimental): misma tarjeta, espacios y tamaños (también
// los de móvil, max-md), con bloques grises en lugar de texto. Se muestra mientras /campanas trae
// las campañas, para que al llegar no se mueva la pantalla. Si cambia CampaignCard, ajustar aquí.
// Imita la vista cuadriculada (CampaignCard con mobileCompact), con la que abre /campanas. Desde el
// 2026-11-05: nombre, temática, creador, cierre, ubicación, tipos de dato y avance.

import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";

export default function CampaignCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 max-md:gap-2.5 max-md:p-3.5 max-sm:gap-2 max-sm:p-2.5">
      {/* Nombre y temática */}
      <div>
        <Skeleton className="h-[22px] w-3/4 max-sm:h-5" />
        <Skeleton className="mt-1 h-[29px] w-28 rounded-pill max-sm:w-20" />
      </div>

      {/* Creador, fecha de cierre y ubicación */}
      <Skeleton className="h-[18px] w-2/3 max-md:h-[17px]" />
      <Skeleton className="h-[18px] w-3/4 max-md:h-[17px]" />
      <Skeleton className="h-[18px] w-2/3 max-md:h-[17px]" />

      {/* Tipos de dato */}
      <div>
        <Skeleton className="h-[18px] w-20 max-md:h-[17px]" />
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Skeleton className="h-[29px] w-14 rounded-pill" />
          <Skeleton className="h-[29px] w-14 rounded-pill" />
        </div>
      </div>

      {/* Avance total */}
      <div className="mt-auto border-t border-system-200 pt-2">
        <Skeleton className="h-[18px] w-24 max-md:h-[17px]" />
      </div>
    </Card>
  );
}
