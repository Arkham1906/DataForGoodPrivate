"use client";

// Vitrina de campañas de la landing (2026-11-06): pestañas "Más participación", "Recientes" y "Por cerrar"
// sobre listas que app/page.tsx ya trajo de Postgres. Cliente solo para cambiar de pestaña sin recargar.
// Sin imports de servidor: el tipo CampanaDePortada lo comparte con la página.

import Link from "next/link";
import { useState } from "react";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";

export interface CampanaDePortada {
  id: string;
  name: string;
  description: string;
  /** Quién organiza (quienOrganiza). */
  organizer: string;
  /** Tipos de dato ya con su nombre (Foto, Video...). */
  tipos: string[];
  pct: number;
  participants: number;
  /** "12 dic", o null si no tiene fecha de cierre. */
  cierre: string | null;
}

export interface PestanaDeCampanas {
  clave: string;
  nombre: string;
  campanas: CampanaDePortada[];
}

const nf = new Intl.NumberFormat("es-MX");

function TarjetaDeCampana({ campana }: { campana: CampanaDePortada }) {
  return (
    <Link
      href={`/campanas/${campana.id}`}
      className="landing-tarjeta flex h-full flex-col rounded-[18px] border border-system-200 bg-white hover:border-brand-600"
    >
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug text-system-900">{campana.name}</h3>
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-system-600">{campana.description}</p>
        <p className="mt-auto flex items-center gap-2 pt-4 text-[12.5px] text-system-600">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-800"
          >
            {campana.organizer.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{campana.organizer}</span>
        </p>
      </div>

      <div className="border-t border-system-200 p-4">
        <ProgressBar pct={campana.pct} tone="ok" conPorcentaje />
        <div className="mt-3 flex min-h-[26px] flex-wrap gap-1.5">
          {campana.tipos.slice(0, 3).map((tipo) => (
            <Tag key={tipo}>{tipo}</Tag>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-system-200 px-4 py-3 text-[12px] text-system-500">
        <span>{campana.cierre ? `Cierra el ${campana.cierre}` : "Sin fecha de cierre"}</span>
        <span className="shrink-0 font-mono">
          {nf.format(campana.participants)} {campana.participants === 1 ? "persona" : "personas"}
        </span>
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
