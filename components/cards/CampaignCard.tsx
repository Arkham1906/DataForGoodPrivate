// Tarjeta de campaña para las listas de la zona de usuario (/campanas, /mis-aportes...). Recibe un Campaign de types/index.ts.
// `hrefAlAbrir` hace que un enlace cubra la tarjeta para navegar al detalle; `onAbrir` conserva la
// opción de abrir una ventana en pantallas que todavía la usan. "Ver detalles" también lleva al detalle.

import Link from "next/link";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";
import RutaDeTematica from "@/components/ui/RutaDeTematica";
import ProgressBar from "@/components/ui/ProgressBar";
import Button from "@/components/ui/Button";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import type { Campaign } from "@/types";

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start || !end) return "Sin fecha definida";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const s = parseDateOnly(start)?.toLocaleDateString("es-MX", opts) ?? start;
  const e = parseDateOnly(end)?.toLocaleDateString("es-MX", opts) ?? end;
  return `${s} – ${e}`;
}

export default function CampaignCard({ campaign, onAbrir, hrefAlAbrir, compact = false, mobileCompact = false }: { campaign: Campaign; onAbrir?: () => void; hrefAlAbrir?: string; compact?: boolean; mobileCompact?: boolean }) {
  const remainingDays = Number.isFinite(campaign.daysRemaining) ? Math.max(0, Number(campaign.daysRemaining)) : 0;
  const pct = porcentajeDeMeta(campaign.approvedContributions, campaign.goalContributions);
  const isActive = campaign.status === "activa";
  // Pausada (2026-10-24: sale en /campanas): conserva su avance y lo dice en la etiqueta.
  const isPaused = campaign.status === "pausada";
  const closeDate = campaign.endDate ? parseDateOnly(campaign.endDate)?.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) : "Sin fecha";

  return (
    <Card className={`flex flex-col ${compact ? "gap-2 p-3 max-md:gap-1.5 max-md:p-2.5" : "gap-3 max-md:gap-2.5 max-md:p-3.5"} ${mobileCompact ? "max-sm:gap-2 max-sm:p-2.5" : ""} ${onAbrir || hrefAlAbrir ? "relative cursor-pointer transition-colors hover:border-brand-600" : ""}`}>
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        {/* En el catálogo se muestra la temática principal, sin subtemáticas. */}
        <div className="min-w-0">
          <RutaDeTematica tematica={campaign.tematica || campaign.tag} />
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {campaign.especial?.etapa === "vigente" && <Tag tone="warn">★ Especial ×{campaign.especial.multiplicador}</Tag>}
          {campaign.isBanned ? (
            <Tag tone="danger">Baneado</Tag>
          ) : isPaused ? (
            <Tag tone={ETIQUETA_DE_CAMPANA.pausada.tono}>{ETIQUETA_DE_CAMPANA.pausada.texto}</Tag>
          ) : (
            <Tag>{isActive ? "● Activa" : campaign.status === "en_revision" ? "◦ Próxima" : campaign.status}</Tag>
          )}
        </div>
      </div>

      <div>
        <h3 className={`font-bold text-system-900 ${compact ? "text-[15px] max-md:text-[14px]" : "text-base max-md:text-[15px]"}`}>{campaign.name}</h3>
        <p className={`${compact || mobileCompact ? "hidden" : "mt-0.5 text-[12px] max-md:text-[11px]"} text-system-600`}>{campaign.description}</p>
        <p className={`${compact ? "hidden" : `mt-1.5 truncate text-[12px] max-md:text-[11px]${mobileCompact ? " max-sm:hidden" : ""}`} text-system-600`} title={campaign.creatorName || "Sin especificar"}>
          <span className="font-semibold text-system-700">Creado por:</span> {campaign.creatorName || "Sin especificar"}
        </p>
        <p className={`${compact ? "hidden" : `mt-0.5 truncate text-[12px] max-md:text-[11px]${mobileCompact ? " max-sm:hidden" : ""}`} text-system-600`} title={campaign.organizer || "Sin organización"}>
          <span className="font-semibold text-system-700">Organización:</span> {campaign.organizer || "Sin organización"}
        </p>
        <p className={`${compact ? "mt-1 font-mono text-[10px]" : `mt-1.5 font-mono text-[11px] max-md:text-[10.5px]${mobileCompact ? " max-sm:hidden" : ""}`} text-system-600`}>
          {formatDateRange(campaign.startDate, campaign.endDate)}
        </p>
        <p className={`${compact ? "mt-0.5 font-mono text-[10px]" : `mt-1 font-mono text-[11px] max-md:text-[10.5px]${mobileCompact ? " max-sm:hidden" : ""}`} text-system-600`}>
          Cierre: {closeDate} · {remainingDays} días restantes
        </p>
      </div>

      <ProgressBar pct={isActive || isPaused ? pct : 0} />

      <div className={`flex ${compact ? "gap-5" : "gap-6 max-md:gap-5"}`}>
        <div>
          <p className={`font-mono font-bold text-system-900 ${compact ? "text-[14px]" : "text-[15px] max-md:text-[14px]"}`}>
            {campaign.approvedContributions}/{campaign.goalContributions}
          </p>
          <p className={`text-system-500 ${compact ? "text-[10px]" : "text-[11px] max-md:text-[10px]"}`}>aprobados</p>
        </div>
        <div>
          <p className={`font-mono font-bold text-system-900 ${compact ? "text-[14px]" : "text-[15px] max-md:text-[14px]"}`}>
            {remainingDays}
          </p>
          <p className={`text-system-500 ${compact ? "text-[10px]" : "text-[11px] max-md:text-[10px]"}`}>días restantes</p>
        </div>
      </div>

      <Link href={`/campanas/${campaign.id}`} className="relative z-10 mt-auto">
        <Button size={compact ? "sm" : undefined} className="w-full">Ver detalles</Button>
      </Link>
    </Card>
  );
}
