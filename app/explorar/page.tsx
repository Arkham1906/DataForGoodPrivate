// Pantalla /explorar (pública): vitrina de campañas activas y, después, las pausadas (con su etiqueta;
// 2026-10-24), con filtros en searchParams.
// Datos: lib/campanas/publicas.ts. Al abrir una campaña va a /campanas/[id], que sí pide sesión.

import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import { quienOrganiza } from "@/lib/campanas/organizacion";
import Link from "next/link";
import { BASE_PATH } from "@/lib/base-path";
import { entradaDeTarjeta, retraso } from "@/lib/animaciones";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import ButtonLink from "@/components/ui/ButtonLink";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import RutaDeTematica from "@/components/ui/RutaDeTematica";
import { Input } from "@/components/ui/Input";
import {
  buscarCampanasParaExplorar,
  contarCampanasParaExplorar,
  obtenerEstadosParaExplorar,
  obtenerEtiquetasParaExplorar,
  obtenerTematicasParaExplorar,
  type OrdenDeCampanas,
} from "@/lib/campanas/publicas";
import { DATA_TYPE_LABELS } from "@/lib/open-data";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import type { DataType } from "@/types";

export const metadata: Metadata = {
  title: "Explorar campañas",
  description: "Campañas ciudadanas activas en DataForGood a las que puedes sumarte con tus aportes.",
};

const nf = new Intl.NumberFormat("es-MX");

const ORDENES: { valor: OrdenDeCampanas; etiqueta: string }[] = [
  { valor: "participacion", etiqueta: "Más participación" },
  { valor: "recientes", etiqueta: "Más recientes" },
  { valor: "cierre", etiqueta: "Cierran pronto" },
];
const ORDENES_VALIDOS = new Set(ORDENES.map((o) => o.valor));

type Busqueda = Record<string, string | undefined>;

function textoDeCierre(dias: number | null): string {
  if (dias === null) return "sin fecha de cierre";
  if (dias === 0) return "cierra hoy";
  return dias === 1 ? "queda 1 día" : `quedan ${dias} días`;
}

export default async function ExplorarCampanasPage({
  searchParams,
}: {
  searchParams: Promise<Busqueda>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const tematica = sp.tematica || undefined;
  // Subtemática (2026-10-27): solo con una temática elegida.
  const etiqueta = tematica ? sp.etiqueta || undefined : undefined;
  const locationState = sp.estado || undefined;
  const orden: OrdenDeCampanas = ORDENES_VALIDOS.has(sp.orden as OrdenDeCampanas)
    ? (sp.orden as OrdenDeCampanas)
    : "participacion";

  const [campanas, { activas: total, visibles }, tematicas, estados, etiquetas] = await Promise.all([
    buscarCampanasParaExplorar({ q, tematica, etiqueta, locationState, orden }),
    contarCampanasParaExplorar(),
    obtenerTematicasParaExplorar(),
    obtenerEstadosParaExplorar(),
    tematica ? obtenerEtiquetasParaExplorar(tematica) : Promise.resolve([]),
  ]);

  const activos = [q, tematica, etiqueta, locationState].filter(Boolean).length;

  function enlaceCon(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tematica) params.set("tematica", tematica);
    if (etiqueta) params.set("etiqueta", etiqueta);
    if (locationState) params.set("estado", locationState);
    if (orden !== "participacion") params.set("orden", orden);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    const qs = params.toString();
    return qs ? `/explorar?${qs}` : "/explorar";
  }

  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />

      <main id="contenido" className="mx-auto max-w-5xl px-6 pb-24 pt-14">
        <p className="landing-entrada mb-2 font-mono text-[10.5px] uppercase tracking-widest text-brand-600">
          Campañas
        </p>
        <h1 style={retraso(80)} className="landing-entrada max-w-2xl text-[32px] font-extrabold leading-tight tracking-tight text-system-900">
          Campañas abiertas a la comunidad
        </h1>
        <p style={retraso(160)} className="landing-entrada mt-4 max-w-2xl text-[14.5px] leading-relaxed text-system-600">
          {nf.format(total)} {total === 1 ? "campaña activa" : "campañas activas"} recibiendo
          aportes en este momento. Crea una cuenta o inicia sesión para participar.
        </p>

        <form style={retraso(240)} className="landing-entrada mt-6 flex flex-wrap gap-2.5" action={`${BASE_PATH}/explorar`} method="get">
          {orden !== "participacion" && <input type="hidden" name="orden" value={orden} />}
          {tematica && <input type="hidden" name="tematica" value={tematica} />}
          {etiqueta && <input type="hidden" name="etiqueta" value={etiqueta} />}
          {locationState && <input type="hidden" name="estado" value={locationState} />}
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            aria-label="Buscar campañas"
            placeholder="Buscar por nombre, organización o municipio"
            className="max-w-sm"
          />
          <ButtonLink href="/registro" variant="primary">
            Quiero participar
          </ButtonLink>
        </form>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
          <aside style={retraso(320)} className="landing-entrada flex flex-col gap-6">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12.5px] font-semibold text-system-900">Filtros</p>
              {activos > 0 && (
                <Link
                  href={enlaceCon({ q: undefined, tematica: undefined, etiqueta: undefined, estado: undefined })}
                  className="text-[12.5px] font-medium text-brand-600 hover:underline"
                >
                  Limpiar
                </Link>
              )}
            </div>

            {tematicas.length > 0 && (
              <div>
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-system-500">
                  Temática
                </p>
                <div className="dashboard-nav flex min-w-0 flex-row gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-col md:gap-1 md:overflow-visible md:pb-0">
                  {tematicas.map((t) => (
                    <Link
                      key={t.valor}
                      href={enlaceCon({ tematica: tematica === t.valor ? undefined : t.valor, etiqueta: undefined })}
                      className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-pill border px-3 py-1.5 text-[12.5px] md:shrink md:rounded md:border-0 md:px-2 md:py-1.5 md:text-[13px] ${
                        tematica === t.valor
                          ? "border-brand-600 bg-brand-50 font-semibold text-brand-600"
                          : "border-system-300 bg-white text-system-600 hover:bg-system-100 md:border-transparent md:bg-transparent"
                      }`}
                    >
                      <span>{t.valor}</span>
                      <span className="font-mono text-[11px] text-system-500">{t.total}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {tematica && etiquetas.length > 0 && (
              <div>
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-system-500">
                  Etiquetas de {tematica}
                </p>
                <div className="dashboard-nav flex min-w-0 flex-row gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-col md:gap-1 md:overflow-visible md:pb-0">
                  {etiquetas.map((e) => (
                    <Link
                      key={e.valor}
                      href={enlaceCon({ etiqueta: etiqueta === e.valor ? undefined : e.valor })}
                      className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-pill border px-3 py-1.5 text-[12.5px] md:shrink md:rounded md:border-0 md:px-2 md:py-1.5 md:text-[13px] ${
                        etiqueta === e.valor
                          ? "border-brand-600 bg-brand-50 font-semibold text-brand-600"
                          : "border-system-300 bg-white text-system-600 hover:bg-system-100 md:border-transparent md:bg-transparent"
                      }`}
                    >
                      <span>#{e.valor}</span>
                      <span className="font-mono text-[11px] text-system-500">{e.total}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {estados.length > 0 && (
              <div>
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-system-500">
                  Estado
                </p>
                <div className="dashboard-nav flex min-w-0 flex-row gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-col md:gap-1 md:overflow-visible md:pb-0">
                  {estados.map((e) => (
                    <Link
                      key={e.valor}
                      href={enlaceCon({ estado: locationState === e.valor ? undefined : e.valor })}
                      className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-pill border px-3 py-1.5 text-[12.5px] md:shrink md:rounded md:border-0 md:px-2 md:py-1.5 md:text-[13px] ${
                        locationState === e.valor
                          ? "border-brand-600 bg-brand-50 font-semibold text-brand-600"
                          : "border-system-300 bg-white text-system-600 hover:bg-system-100 md:border-transparent md:bg-transparent"
                      }`}
                    >
                      <span>{e.valor}</span>
                      <span className="font-mono text-[11px] text-system-500">{e.total}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div>
            <nav
              style={retraso(320)}
              className="dashboard-nav landing-entrada mb-4 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
              aria-label="Ordenar resultados"
            >
              {ORDENES.map((o) => (
                <Link
                  key={o.valor}
                  href={enlaceCon({ orden: o.valor === "participacion" ? undefined : o.valor })}
                  className={`shrink-0 whitespace-nowrap rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    orden === o.valor
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-system-300 bg-white text-system-600 hover:border-brand-600"
                  }`}
                >
                  {o.etiqueta}
                </Link>
              ))}
            </nav>

            <p className="mb-4 font-mono text-[12px] text-system-600">
              {nf.format(campanas.length)} {campanas.length === 1 ? "campaña" : "campañas"}
              {activos > 0 ? ` · ${activos} ${activos === 1 ? "filtro activo" : "filtros activos"}` : ""}
            </p>

            {campanas.length === 0 ? (
              <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">
                {visibles === 0
                  ? "Por ahora no hay campañas activas. Vuelve pronto o crea la tuya."
                  : "Ninguna campaña coincide con estos filtros. Prueba quitando alguno o buscando por otro término."}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {campanas.map((c, i) => {
                  const pct = porcentajeDeMeta(c.approvedContributions, c.goalContributions);
                  const lugar = textoDeUbicacion({ todoElPais: c.todoElPais, municipio: c.locationCity, estado: c.locationState });
                  return (
                    // Ver el detalle y aportar requiere sesión: sin ella, proxy.ts manda a /entrar.
                    <Link key={c.id} href={`/campanas/${c.id}`} {...entradaDeTarjeta(i)}>
                      {/* Textos recortados (2026-10-22): un nombre largo o una palabra sin espacios
                          estiraba la tarjeta o se salía de ella y empujaba "Activa" afuera. El
                          texto completo queda en el title. */}
                      <Card className="landing-tarjeta flex h-full min-w-0 flex-col hover:border-brand-600">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <p className="line-clamp-2 min-w-0 break-words text-[15px] font-bold text-system-900" title={c.name}>
                            {c.name}
                          </p>
                          <span className="shrink-0">
                            <Tag tone={ETIQUETA_DE_CAMPANA[c.status].tono}>{ETIQUETA_DE_CAMPANA[c.status].texto}</Tag>
                          </span>
                        </div>
                        <p className="truncate text-[12.5px] text-system-600" title={`${quienOrganiza(c)}${lugar ? ` · ${lugar}` : ""}`}>
                          {quienOrganiza(c)}
                          {lugar ? ` · ${lugar}` : ""}
                        </p>
                        <RutaDeTematica tematica={c.tematica} etiquetas={c.etiquetas} className="mt-2" />
                        <p className="mt-2 line-clamp-3 break-words text-[13px] leading-snug text-system-600">
                          {c.description.length > 140 ? `${c.description.slice(0, 140)}…` : c.description}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {c.dataTypes.map((dt) => (
                            <Tag key={dt}>{DATA_TYPE_LABELS[dt as DataType] ?? dt}</Tag>
                          ))}
                        </div>
                        <div className="mt-auto pt-3">
                          <ProgressBar pct={pct} tone="ok" />
                          <p className="mt-2 font-mono text-[11px] text-system-500">
                            {nf.format(c.participants)} participantes · {pct}% de la meta ·{" "}
                            {c.status === "pausada" ? "no recibe aportes por ahora" : textoDeCierre(c.daysRemaining)}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
