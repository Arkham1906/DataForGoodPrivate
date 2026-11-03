// Esqueleto de CampaignCard (2026-10-07, experimental): misma tarjeta, espacios y tamaños (también
// los de móvil, max-md), con bloques grises en lugar de texto. Se muestra mientras /campanas trae
// las campañas, para que al llegar no se mueva la pantalla. Si cambia CampaignCard, ajustar aquí.
// Desde el 2026-11-01 imita la vista cuadriculada (CampaignCard con mobileCompact), con la que abre
// /campanas: sin descripción, con "Creado por" y "Organización", y en móvil (max-sm) solo el nombre.

import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";

export default function CampaignCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 max-md:gap-2.5 max-md:p-3.5 max-sm:gap-2 max-sm:p-2.5">
      {/* Temática y estado */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-[26px] w-28 rounded-pill max-sm:w-16" />
        <Skeleton className="h-[26px] w-16 rounded-pill max-sm:w-12" />
      </div>

      {/* Nombre, creador, organización y fechas (en móvil solo el nombre) */}
      <div>
        <Skeleton className="h-5 w-3/4 max-md:h-[18px]" />
        <Skeleton className="mt-2 h-3.5 w-2/3 max-sm:hidden" />
        <Skeleton className="mt-1 h-3.5 w-3/4 max-sm:hidden" />
        <Skeleton className="mt-2 h-3 w-1/2 max-sm:hidden" />
        <Skeleton className="mt-1.5 h-3 w-2/3 max-sm:hidden" />
      </div>

      {/* Barra de avance */}
      <Skeleton className="h-[7px] w-full rounded-pill" />

      {/* Aportes y días restantes */}
      <div className="flex gap-6 max-md:gap-5">
        <div>
          <Skeleton className="h-[18px] w-14" />
          <Skeleton className="mt-1 h-3 w-12" />
        </div>
        <div>
          <Skeleton className="h-[18px] w-8" />
          <Skeleton className="mt-1 h-3 w-20" />
        </div>
      </div>

      {/* Ver detalles */}
      <Skeleton className="mt-auto h-[42px] w-full rounded-pill" />
    </Card>
  );
}
