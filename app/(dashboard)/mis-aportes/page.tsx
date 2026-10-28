"use client";

// Pantalla /mis-aportes: agrupa tus aportes por campana y cada tarjeta lleva
// directamente al historial completo de esa campana.

import Link from "next/link";
import { useEffect, useState } from "react";
import ButtonLink from "@/components/ui/ButtonLink";
import { EsqueletoDeTarjetas } from "@/components/ui/Esqueletos";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

export default function MisAportesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recarga = useRecargaEnVivo();
  useEffect(() => {
    let active = true;

    async function loadCampaigns() {
      try {
        const response = await fetch(`${BASE_PATH}/api/campanas?misAportes=true`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar tus campa\u00f1as");
        if (active) setCampaigns(Array.isArray(payload.data) ? payload.data as Campaign[] : []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus campa\u00f1as");
      } finally {
        if (active) setCargando(false);
      }
    }

    void loadCampaigns();
    return () => {
      active = false;
    };
  }, [recarga]);

  const contributedCampaigns = campaigns.filter((campaign) => (campaign.myContributionsCount ?? 0) > 0);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Mis aportes</h1>
          <p className="mt-1 text-[13px] text-system-600 max-md:text-[12px] max-md:leading-5">
            Tus aportes est&aacute;n agrupados por campa&ntilde;a. Selecciona una para ver el historial completo.
          </p>
        </div>
        <ButtonLink href="/campanas" variant="primary" size="sm" className="whitespace-nowrap max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px]">
          Explorar campa&ntilde;as
        </ButtonLink>
      </div>

      {error ? (
        <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p>
      ) : cargando ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando tus aportes...</span>
          <EsqueletoDeTarjetas cantidad={4} columnas={2} />
        </div>
      ) : contributedCampaigns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">
          Todav&iacute;a no has enviado aportes. Cuando participes en una campa&ntilde;a, tus aportes aparecer&aacute;n aqu&iacute; agrupados por campa&ntilde;a.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {contributedCampaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/mis-aportes/${campaign.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-system-200 bg-white p-4 text-left hover:bg-system-50 max-md:p-3.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold text-system-900 max-md:text-[14px]">
                  {campaign.name}
                </span>
                <span className="mt-1 block text-[12.5px] text-system-600">
                  {campaign.myContributionsCount} {campaign.myContributionsCount === 1 ? "aporte enviado" : "aportes enviados"}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-brand-700">
                Ver historial →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
