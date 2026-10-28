// Tarjeta de campaña para las listas de la zona de usuario (/campanas, /mis-aportes...). Recibe un Campaign de types/index.ts.
// Con `onAbrir` (2026-10-27) toda la tarjeta es clickeable: un botón que la cubre abre el detalle en
// una ventana (campanas/VentanaDeCampana); "Ver detalles" queda encima y sigue llevando a /campanas/[id].

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

export default function CampaignCard({ campaign, onAbrir }: { campaign: Campaign; onAbrir?: () => void }) {
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
    <Card className={`flex flex-col gap-3 max-md:gap-2.5 max-md:p-3.5 ${onAbrir ? "relative cursor-pointer transition-colors hover:border-brand-600" : ""}`}>
      {onAbrir && (
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`Ver la información de ${campaign.name}`}
          data-sin-respuesta
          className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        {/* Temática › etiquetas (2026-10-27). */}
        <RutaDeTematica tematica={campaign.tematica || campaign.tag} etiquetas={campaign.etiquetas} />
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
        <h3 className="text-base font-bold text-system-900 max-md:text-[15px]">{campaign.name}</h3>
        <p className="mt-1 text-[13px] text-system-600 max-md:text-[12px] max-md:leading-5">{campaign.description}</p>
        <p className="mt-1.5 font-mono text-[11px] text-system-600 max-md:text-[10.5px]">
          {formatDateRange(campaign.startDate, campaign.endDate)}
        </p>
        <p className="mt-1 font-mono text-[11px] text-system-600 max-md:text-[10.5px]">
          Cierre: {closeDate} · {remainingDays} días restantes
        </p>
      </div>

      <ProgressBar pct={isActive || isPaused ? pct : 0} />

      <div className="flex gap-6 max-md:gap-5">
        <div>
          <p className="font-mono text-[15px] font-bold text-system-900 max-md:text-[14px]">
            {campaign.approvedContributions}/{campaign.goalContributions}
          </p>
          <p className="text-[11px] text-system-500 max-md:text-[10px]">aprobados</p>
        </div>
        <div>
          <p className="font-mono text-[15px] font-bold text-system-900 max-md:text-[14px]">
            {remainingDays}
          </p>
          <p className="text-[11px] text-system-500 max-md:text-[10px]">días restantes</p>
        </div>
      </div>

      <Link href={`/campanas/${campaign.id}`} className="relative z-10">
        <Button className="w-full">Ver detalles</Button>
      </Link>
    </Card>
  );
}
