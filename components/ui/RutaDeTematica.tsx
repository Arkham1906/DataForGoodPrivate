// Temática de una campaña y sus etiquetas como una ruta: "Animales › #Perros #Adopción" (2026-10-27,
// a pedido del usuario: que se entienda que las etiquetas cuelgan de la temática). La temática va en
// verde (ui/Tag "ok") y las etiquetas con ui/EtiquetasDeCampana; sin etiquetas, solo la temática.
// La usan las tarjetas (cards/CampaignCard, /explorar, /mis-campanas), /campanas/[id], la ventana de
// detalle (campanas/VentanaDeCampana) y la vista previa del formulario de campaña.

import EtiquetasDeCampana from "@/components/ui/EtiquetasDeCampana";
import Tag from "@/components/ui/Tag";
import type { EtiquetaDeCampana } from "@/lib/etiquetas/reglas";

export default function RutaDeTematica({
  tematica,
  etiquetas,
  className = "",
}: {
  tematica: string | null | undefined;
  etiquetas?: (EtiquetaDeCampana | string)[];
  className?: string;
}) {
  const hayEtiquetas = (etiquetas ?? []).length > 0;
  if (!tematica && !hayEtiquetas) return null;
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className}`}>
      {tematica && <Tag tone="ok">{tematica}</Tag>}
      {tematica && hayEtiquetas && (
        <span aria-hidden="true" className="text-[13px] font-semibold text-system-500">
          ›
        </span>
      )}
      <EtiquetasDeCampana etiquetas={etiquetas} />
    </div>
  );
}
