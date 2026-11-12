// Tarjeta de una campaña activa en las pantallas públicas (2026-11-12: sacada de /explorar para usarla
// también en "Lo más reciente" de la landing y en /explorar/tematica/[slug]; una tarjeta, un lugar).
// Nombre, estado, temática, portada, descripción, quién la creó y organiza, avance, tipos de dato, cierre
// y participantes. Ver el detalle y aportar pide sesión: sin ella, proxy.ts manda a /entrar.

import Link from "next/link";
import { BASE_PATH } from "@/lib/base-path";
import { entradaDeTarjeta } from "@/lib/animaciones";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import type { CampanaPublica } from "@/lib/campanas/publicas";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { DATA_TYPE_LABELS } from "@/lib/open-data";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import type { DataType } from "@/types";

const nf = new Intl.NumberFormat("es-MX");

function textoDeCierre(dias: number | null): string {
  if (dias === null) return "Sin fecha de cierre";
  if (dias === 0) return "Cierra hoy";
  return dias === 1 ? "Queda 1 día" : `Quedan ${dias} días`;
}

export default function TarjetaDeCampanaPublica({
  campana: c,
  indice,
  nivel = "h2",
}: {
  campana: CampanaPublica;
  /** Posición en la lista: las primeras entran al cargar y las demás con el scroll (entradaDeTarjeta). */
  indice: number;
  /** Nivel del nombre: h2 en una lista suelta, h3 dentro de una sección con su propio h2. */
  nivel?: "h2" | "h3";
}) {
  const Titulo = nivel;
  const pct = porcentajeDeMeta(c.approvedContributions, c.goalContributions);
  const lugar = textoDeUbicacion({ todoElPais: c.todoElPais, municipio: c.locationCity, estado: c.locationState });
  return (
    <Link href={`/campanas/${c.id}`} {...entradaDeTarjeta(indice)}>
      {/* Textos recortados (2026-10-22): un nombre largo o una palabra sin espacios estiraba la tarjeta o se
          salía de ella y empujaba "Activa" afuera. El texto completo queda en el title. */}
      <article className="landing-tarjeta flex h-full min-w-0 flex-col rounded-[18px] border border-system-200 bg-white hover:border-brand-600">
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <Titulo className="line-clamp-2 min-w-0 break-words text-[16px] font-semibold leading-snug text-system-900" title={c.name}>
              {c.name}
            </Titulo>
            <span className="shrink-0">
              <Tag tone={ETIQUETA_DE_CAMPANA[c.status].tono}>{ETIQUETA_DE_CAMPANA[c.status].texto}</Tag>
            </span>
          </div>
          {c.tematica && (
            <div className="mt-2">
              <Tag tone="ok">{c.tematica}</Tag>
            </div>
          )}
          {c.hasBanner && (
            <div data-campana-banner className="mt-3 aspect-[4/3] overflow-hidden rounded-lg bg-system-100">
              {/* La portada la sirve un route handler (no pasa por next/image). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BASE_PATH}/api/campanas/${c.id}/banner?v=${encodeURIComponent(c.bannerVersion ?? "")}`}
                alt=""
                className="h-full w-full object-contain"
                style={{ objectPosition: `${c.bannerPositionX ?? 50}% ${c.bannerPositionY ?? 50}%`, transform: `scale(${c.bannerScale ?? 1})` }}
              />
            </div>
          )}
          <p className="mt-2 line-clamp-2 break-words text-[13px] leading-relaxed text-system-600">
            {c.description.length > 140 ? `${c.description.slice(0, 140)}…` : c.description}
          </p>
          <div className="mt-auto space-y-0.5 pt-4 text-[12.5px] text-system-600">
            <p className="truncate" title={c.creatorName || "Sin especificar"}>
              <span className="font-semibold text-system-700">Creado por:</span> {c.creatorName || "Sin especificar"}
            </p>
            <p className="truncate" title={`${c.organizer || "Sin organización"}${lugar ? ` · ${lugar}` : ""}`}>
              <span className="font-semibold text-system-700">Organización:</span> {c.organizer || "Sin organización"}
              {lugar ? ` · ${lugar}` : ""}
            </p>
          </div>
        </div>
        <div className="border-t border-system-200 p-4">
          <ProgressBar pct={pct} tone="ok" conPorcentaje />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.dataTypes.map((dt) => (
              <Tag key={dt}>{DATA_TYPE_LABELS[dt as DataType] ?? dt}</Tag>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-system-200 px-4 py-3 text-[12px] text-system-500">
          <span>{textoDeCierre(c.daysRemaining)}</span>
          <span className="shrink-0 font-mono">
            {nf.format(c.participants)} {c.participants === 1 ? "participante" : "participantes"}
          </span>
        </div>
      </article>
    </Link>
  );
}
