"use client";

// Pantalla /campanas: campañas activas para participar, con filtros por temática y "Tu localidad".
// Componente cliente. Datos: GET /api/campanas y GET /api/auth/sesion.

import Link from "next/link";
import { useEffect, useState } from "react";
import CampaignCard from "@/components/cards/CampaignCard";
import Button from "@/components/ui/Button";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";

const TU_LOCALIDAD = "Tu localidad";
// Después de estos van las temáticas que tienen las campañas activas (ver temasConCampanas).
const FILTROS_FIJOS = ["Todas", "Guardadas", TU_LOCALIDAD];

/** "Estado de México" y "estado de mexico" cuentan como el mismo estado. */
function normalizarEstado(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

export default function CampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeTag, setActiveTag] = useState("Todas");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  // Estado declarado en el perfil (Mi cuenta); vacío si no lo ha indicado.
  const [miEstado, setMiEstado] = useState("");

  useEffect(() => {
    async function cargarCampanas() {
      try {
        const [response, sesionRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" }),
        ]);
        const sesion = await sesionRes.json().catch(() => ({}));
        if (sesionRes.ok) setMiEstado(String(sesion.data?.state ?? "").trim());
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        const todas = Array.isArray(payload.data) ? (payload.data as Campaign[]) : [];
        // Solo campañas aprobadas por el supervisor (estado "activa") se muestran aquí.
        setCampaigns(todas.filter((campaign) => campaign.status === "activa"));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setCargando(false);
      }
    }
    void cargarCampanas();
  }, []);

  const enMiEstado = miEstado
    ? campaigns.filter((c) => normalizarEstado(c.locationState) === normalizarEstado(miEstado))
    : [];

  // Temáticas de las campañas que se muestran, de la más frecuente a la menos:
  // así nunca aparece un filtro que no tenga resultados.
  const temasConCampanas = Array.from(
    campaigns.reduce((conteo, c) => (c.tag ? conteo.set(c.tag, (conteo.get(c.tag) ?? 0) + 1) : conteo), new Map<string, number>())
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  const filtros = [...FILTROS_FIJOS, ...temasConCampanas.map(([tema]) => tema)];
  const porTema = new Map(temasConCampanas);

  const filtered =
    activeTag === "Todas"
      ? campaigns
      : activeTag === "Guardadas"
        ? campaigns.filter((c) => c.isSaved)
        : activeTag === TU_LOCALIDAD
          ? enMiEstado
          : campaigns.filter((c) => c.tag === activeTag);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Campañas disponibles</h1>
          <p className="mt-1 text-[13px] text-system-600 max-md:max-w-[220px] max-md:text-[12px] max-md:leading-5">
            Descubre proyectos con impacto social cerca de ti.
          </p>
        </div>
        <Link href="/mis-campanas/nueva">
          <Button variant="primary" size="sm" className="whitespace-nowrap max-md:max-w-[126px] max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px] max-md:leading-4">
            Crear campaña
          </Button>
        </Link>
      </div>

      <div className="dashboard-nav mb-6 mt-4 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:mb-4 max-md:gap-1.5 md:flex-wrap md:overflow-visible md:pb-0" role="group" aria-label="Filtrar campañas">
        {filtros.map((filtro) => {
          const active = filtro === activeTag;
          const contador =
            filtro === "Todas"
              ? campaigns.length
              : filtro === "Guardadas"
                ? campaigns.filter((c) => c.isSaved).length
                : filtro === TU_LOCALIDAD
                  ? miEstado
                    ? enMiEstado.length
                    : null
                  : (porTema.get(filtro) ?? null);
          return (
            <button
              key={filtro}
              type="button"
              onClick={() => setActiveTag(filtro)}
              aria-pressed={active}
              title={filtro === TU_LOCALIDAD && miEstado ? `Campañas en ${miEstado}` : undefined}
              className={`shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-system-300 bg-white text-system-600 hover:border-brand-600"
              }`}
            >
              {filtro}
              {contador !== null && <span className="ml-1.5 font-mono">{contador}</span>}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p>
      ) : cargando ? (
        <p className="text-sm text-system-600">Cargando campañas…</p>
      ) : activeTag === TU_LOCALIDAD && !miEstado ? (
        <p className="text-sm text-system-600">
          Aún no indicas en qué estado vives.{" "}
          <Link href="/cuenta" className="font-semibold text-brand-600 hover:underline">
            Agrégalo en Mi cuenta
          </Link>{" "}
          para ver las campañas de tu localidad.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-system-600">
          {activeTag === "Guardadas"
            ? "Todavía no has guardado ninguna campaña."
            : activeTag === TU_LOCALIDAD
              ? `Por ahora no hay campañas activas en ${miEstado}.`
              : "No hay campañas aprobadas para esta temática todavía."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
