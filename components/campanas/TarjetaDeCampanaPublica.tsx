// Tarjeta de una campaña activa en las pantallas públicas (2026-11-12: sacada de /explorar para usarla
// también en "Lo más reciente" de la landing y en /explorar/tematica/[slug]; una tarjeta, un lugar).
// Nombre, estado, temática, portada, descripción, quién la creó y organiza, avance, tipos de dato, cierre
// y participantes. Ver el detalle y aportar pide sesión: sin ella, proxy.ts manda a /entrar.

import Link from "next/link";
import { BASE_PATH } from "@/lib/base-path";
import { entradaDeTarjeta } from "@/lib/animaciones";
import { etiquetaDeCierre } from "@/lib/campanas/etiqueta-de-cierre";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import type { CampanaPublica } from "@/lib/campanas/publicas";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { DATA_TYPE_LABELS } from "@/lib/open-data";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import type { DataType } from "@/types";

const nf = new Intl.NumberFormat("es-MX");

export default function TarjetaDeCampanaPublica({
  campana: c,
  indice,
  nivel = "h2",
  compacta = false,
  lista = false,
}: {
  campana: CampanaPublica;
  /** Posición en la lista: las primeras entran al cargar y las demás con el scroll (entradaDeTarjeta). */
  indice: number;
  /** Nivel del nombre: h2 en una lista suelta, h3 dentro de una sección con su propio h2. */
  nivel?: "h2" | "h3";
  /** En la portada y las listas públicas muestra banner, nombre, temática, avance, tipos y días restantes. */
  compacta?: boolean;
  /** Presentación horizontal, equivalente a la lista de /campanas para el usuario común. */
  lista?: boolean;
}) {
  const Titulo = nivel;
  const pct = porcentajeDeMeta(c.approvedContributions, c.goalContributions);
  const lugar = textoDeUbicacion({ todoElPais: c.todoElPais, municipio: c.locationCity, estado: c.locationState });
  if (lista) {
    return (
      <Link href={`/campanas/${c.id}`} {...entradaDeTarjeta(indice)}>
        <article className="landing-tarjeta grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 rounded-[18px] border border-system-200 bg-white p-3 hover:border-brand-600 max-md:gap-y-2.5 max-md:p-2.5 md:grid-cols-[minmax(0,1fr)_48px] xl:grid-cols-[minmax(165px,1.25fr)_minmax(145px,1.15fr)_minmax(135px,1fr)_minmax(145px,1.15fr)_auto] xl:items-center xl:gap-x-10 xl:p-4">
          <div className="min-w-0">
            <Titulo className="line-clamp-2 break-words text-[14px] font-bold text-system-900" title={c.name}>{c.name}</Titulo>
            <div className="mt-1">
              <Tag tone="ok" className="max-w-full truncate whitespace-nowrap">{c.tematica || "Sin temática"}</Tag>
            </div>
          </div>
          <div data-campana-banner className="hidden h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-system-100 md:flex xl:justify-self-start">
            {c.hasBanner && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${BASE_PATH}/api/campanas/${c.id}/banner?v=${encodeURIComponent(c.bannerVersion ?? "")}`} alt="" loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: `${c.bannerPositionX}% ${c.bannerPositionY}%`, transform: `scale(${c.bannerScale})` }} />
            )}
          </div>
          <div className="col-span-1 min-w-0 space-y-1 text-[10.5px] text-system-600 md:col-span-2 xl:col-span-1">
            <p className="truncate" title={c.creatorName || "Sin especificar"}><span className="font-semibold text-system-700">Creador:</span> {c.creatorName || "Sin especificar"}</p>
            <p className="truncate" title={c.daysRemaining === null ? "Sin fecha" : etiquetaDeCierre(c.daysRemaining)}><span className="font-semibold text-system-700">Cierre:</span> {c.daysRemaining === null ? "Sin fecha" : etiquetaDeCierre(c.daysRemaining)}</p>
            <p className="truncate" title={lugar}><span className="font-semibold text-system-700">Ubicación:</span> {lugar}</p>
          </div>
          <div className="col-span-1 min-w-0 md:col-span-2 xl:col-span-1 xl:flex xl:flex-col xl:justify-center">
            <p className="text-[10.5px] font-semibold text-system-700">Tipo de dato:</p>
            <div className="mt-1 flex flex-wrap gap-1.5">{c.dataTypes.map((dt) => <Tag key={dt}>{DATA_TYPE_LABELS[dt as DataType] ?? dt}</Tag>)}</div>
          </div>
          <p className="col-span-1 mt-auto whitespace-nowrap border-t border-system-200 pt-2 font-mono text-[11px] font-semibold text-system-700 md:col-span-2 xl:col-span-1 xl:my-auto xl:border-l xl:border-t-0 xl:py-2 xl:pl-4">Avance total: {pct}%</p>
        </article>
      </Link>
    );
  }
  if (compacta) {
    return (
      <Link href={`/campanas/${c.id}`} {...entradaDeTarjeta(indice)}>
        <article className="landing-tarjeta flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-system-200 bg-white hover:border-brand-600">
          <div data-campana-banner className="aspect-[16/10] overflow-hidden bg-system-100">
            {c.hasBanner && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${BASE_PATH}/api/campanas/${c.id}/banner?v=${encodeURIComponent(c.bannerVersion ?? "")}`}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `${c.bannerPositionX ?? 50}% ${c.bannerPositionY ?? 50}%`, transform: `scale(${c.bannerScale ?? 1})` }}
                />
              </>
            )}
          </div>
          <div className="flex flex-1 flex-col p-3">
            <Titulo className="min-h-[2.75rem] line-clamp-2 min-w-0 break-words text-[16px] font-semibold leading-snug text-system-900" title={c.name}>
              {c.name}
            </Titulo>
            <div className="mt-2 flex h-8 items-start overflow-hidden">
              {c.tematica && <Tag tone="ok" className="max-w-full truncate whitespace-nowrap">{c.tematica}</Tag>}
            </div>
            <div className="mt-auto">
              <ProgressBar pct={pct} tone="ok" conPorcentaje />
              <div className="mt-3 flex h-14 flex-wrap content-start gap-1.5 overflow-hidden">
                {c.dataTypes.map((dt) => (
                  <Tag key={dt}>{DATA_TYPE_LABELS[dt as DataType] ?? dt}</Tag>
                ))}
              </div>
              <p className="mt-2 min-h-5 border-t border-system-200 pt-2 text-[12px] text-system-600">
                {etiquetaDeCierre(c.daysRemaining)}
              </p>
            </div>
          </div>
        </article>
      </Link>
    );
  }

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
          <span>{etiquetaDeCierre(c.daysRemaining)}</span>
          <span className="shrink-0 font-mono">
            {nf.format(c.participants)} {c.participants === 1 ? "participante" : "participantes"}
          </span>
        </div>
      </article>
    </Link>
  );
}
