// Tarjeta de campaña para las listas de la zona de usuario (/campanas, /mis-aportes...). Recibe un Campaign de types/index.ts.
// `hrefAlAbrir` hace que un enlace cubra la tarjeta para navegar al detalle; `onAbrir` conserva la
// opción de abrir una ventana en pantallas que todavía la usan.

import Link from "next/link";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import type { Campaign } from "@/types";

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export default function CampaignCard({ campaign, onAbrir, hrefAlAbrir, compact = false, mobileCompact = false }: { campaign: Campaign; onAbrir?: () => void; hrefAlAbrir?: string; compact?: boolean; mobileCompact?: boolean }) {
  const pct = porcentajeDeMeta(campaign.approvedContributions, campaign.goalContributions);
  const closeDate = campaign.endDate ? parseDateOnly(campaign.endDate)?.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) : "Sin fecha";
  const location = textoDeUbicacion({
    todoElPais: campaign.todoElPais,
    municipio: campaign.locationCity,
    estado: campaign.locationState,
    colonia: campaign.locationColonia,
  }, "Sin ubicación");

  return (
    <Card className={`flex flex-col ${compact ? "gap-2 p-3 max-md:gap-1.5 max-md:p-2.5 xl:grid xl:grid-cols-[minmax(165px,1.25fr)_minmax(145px,1.15fr)_minmax(135px,1fr)_minmax(145px,1.15fr)_minmax(135px,1fr)_auto] xl:items-center xl:gap-4 xl:p-4" : "gap-3 max-md:gap-2.5 max-md:p-3.5"} ${mobileCompact ? "max-sm:gap-2 max-sm:p-2.5" : ""} ${onAbrir || hrefAlAbrir ? "relative cursor-pointer transition-colors hover:border-brand-600" : ""}`}>
      {hrefAlAbrir ? (
        <Link
          href={hrefAlAbrir}
          aria-label={`Ver la campaña ${campaign.name}`}
          className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        />
      ) : onAbrir ? (
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`Ver la información de ${campaign.name}`}
          data-sin-respuesta
          className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        />
      ) : null}
      <div className="min-w-0">
        <h3 className={`line-clamp-2 break-words font-bold text-system-900 ${compact ? "text-[14px]" : "text-[15px]"} ${mobileCompact ? "max-sm:text-[14px]" : ""}`}>
          {campaign.name}
        </h3>
        <div className="mt-1">
          <Tag>{campaign.tematica || campaign.tag || "Sin temática"}</Tag>
        </div>
      </div>

      <p className={`min-w-0 text-system-600 ${compact ? "flex flex-col justify-center text-[10.5px]" : "truncate text-[12px] max-md:text-[11px]"}`} title={campaign.creatorName || "Sin especificar"}>
        <span className="font-semibold text-system-700">Creador:</span>
        <span className={compact ? "truncate" : ""}>{campaign.creatorName || "Sin especificar"}</span>
      </p>

      <p className={`text-system-600 ${compact ? "flex flex-col justify-center text-[10.5px]" : "text-[12px] max-md:text-[11px]"}`}>
        <span className="font-semibold text-system-700">Fecha de cierre:</span>
        <span className={compact ? "whitespace-nowrap" : ""}>{closeDate}</span>
      </p>

      <p className={`min-w-0 text-system-600 ${compact ? "flex min-w-0 flex-col justify-center text-[10.5px]" : "truncate text-[12px] max-md:text-[11px]"}`} title={location}>
        <span className="font-semibold text-system-700">Ubicación:</span> {location}
      </p>

      <div className={`min-w-0 ${compact ? "xl:flex xl:flex-col xl:justify-center" : ""}`}>
        <p className={`font-semibold text-system-700 ${compact ? "text-[10.5px]" : "text-[12px] max-md:text-[11px]"}`}>Tipo de dato:</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {campaign.dataTypes.map((type) => (
            <Tag key={type}>{NOMBRE_DE_TIPO[type]}</Tag>
          ))}
        </div>
      </div>

      <p className={`mt-auto whitespace-nowrap border-t border-system-200 pt-2 font-mono font-semibold text-system-700 ${compact ? "text-[11px] xl:my-auto xl:border-l xl:border-t-0 xl:py-2 xl:pl-4" : "text-[12px] max-md:text-[11px]"}`}>
        Avance total: {pct}%
      </p>
    </Card>
  );
}
