"use client";

// Vitrina de campañas de la landing (2026-11-06): pestañas "Más participación", "Recientes" y "Por cerrar"
// sobre listas que app/page.tsx ya trajo de Postgres. Cliente solo para cambiar de pestaña sin recargar.
// Sin imports de servidor: el tipo CampanaDePortada lo comparte con la página.

import Link from "next/link";
import { BASE_PATH } from "@/lib/base-path";
import { etiquetaDeCierre } from "@/lib/campanas/etiqueta-de-cierre";
import { useState } from "react";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";

export interface CampanaDePortada {
  id: string;
  name: string;
  hasBanner: boolean;
  bannerVersion?: string;
  bannerScale: number;
  bannerPositionX: number;
  bannerPositionY: number;
  /** Tipos de dato ya con su nombre (Foto, Video...). */
  tipos: string[];
  tematica: string;
  daysRemaining: number | null;
  pct: number;
  /** "12 dic", o null si no tiene fecha de cierre. */
  cierre: string | null;
  /** Día de creación en Tepic, "3 nov" (2026-11-09). */
  creada: string;
}

export interface PestanaDeCampanas {
  clave: string;
  nombre: string;
  campanas: CampanaDePortada[];
}

function TarjetaDeCampana({ campana }: { campana: CampanaDePortada }) {
  return (
    <Link
      href={`/campanas/${campana.id}`}
      className="landing-tarjeta flex h-full flex-col overflow-hidden rounded-[18px] border border-system-200 bg-white hover:border-brand-600"
    >
      <div data-campana-banner className="aspect-[16/10] overflow-hidden bg-system-100">
        {campana.hasBanner && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE_PATH}/api/campanas/${campana.id}/banner?v=${encodeURIComponent(campana.bannerVersion ?? "")}`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              style={{ objectPosition: `${campana.bannerPositionX}% ${campana.bannerPositionY}%`, transform: `scale(${campana.bannerScale})` }}
            />
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="min-h-[2.75rem] line-clamp-2 text-[16px] font-semibold leading-snug text-system-900">{campana.name}</h3>
        <div className="mt-2 flex h-8 items-start overflow-hidden">
          {campana.tematica && <Tag tone="ok" className="max-w-full truncate whitespace-nowrap">{campana.tematica}</Tag>}
        </div>
        <div className="mt-auto">
          <ProgressBar pct={campana.pct} tone="ok" conPorcentaje />
          <div className="mt-3 flex h-14 flex-wrap content-start gap-1.5 overflow-hidden">
            {campana.tipos.map((tipo) => (
              <Tag key={tipo}>{tipo}</Tag>
            ))}
          </div>
          <p className="mt-2 min-h-5 border-t border-system-200 pt-2 text-[12px] text-system-600">
            {etiquetaDeCierre(campana.daysRemaining)}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function PestanasDeCampanas({ pestanas }: { pestanas: PestanaDeCampanas[] }) {
  const [activa, setActiva] = useState(pestanas[0]?.clave);
  const pestana = pestanas.find((p) => p.clave === activa) ?? pestanas[0];
  if (!pestana) return null;

  return (
    <>
      <div role="group" aria-label="Ordenar campañas" className="mb-5 flex gap-1.5 overflow-x-auto">
        {pestanas.map((p) => (
          <button
            key={p.clave}
            type="button"
            aria-pressed={p.clave === pestana.clave}
            onClick={() => setActiva(p.clave)}
            className={`shrink-0 rounded-[10px] px-3.5 py-2 text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              p.clave === pestana.clave ? "bg-system-900 font-semibold text-white" : "text-system-600 hover:text-system-900"
            }`}
          >
            {p.nombre}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pestana.campanas.map((c) => (
          <li key={c.id}>
            <TarjetaDeCampana campana={c} />
          </li>
        ))}
      </ul>
    </>
  );
}
