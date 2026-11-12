// Pantalla /explorar (pública): vitrina de campañas activas (sin las pausadas desde el 2026-11-03), con filtros en searchParams (?q, ?tematica, ?etiqueta, ?estado, ?tipo desde el 2026-10-28, ?orden).
// Desde el 2026-11-11, arriba de la lista, "Explora por temática" en mosaicos (landing/TematicasEnMosaico).
// Datos: lib/campanas/publicas.ts. Al abrir una campaña va a /campanas/[id], que sí pide sesión.
// Diseño del 2026-11-06: el de la landing (encabezado centrado, buscador sobre la franja, tarjetas con pie).

import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import Link from "next/link";
import { BASE_PATH } from "@/lib/base-path";
import { entradaDeTarjeta, retraso } from "@/lib/animaciones";
import { porcentajeDeMeta } from "@/lib/campanas/meta";
import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";
import FranjaDeCampo from "@/components/landing/FranjaDeCampo";
import TematicasEnMosaico from "@/components/landing/TematicasEnMosaico";
import { ETIQUETA_DE_FILTRO, FILA_DE_FILTROS, claseDeContador, claseDeFiltro, claseDeOrden } from "@/components/landing/estilos";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import ButtonLink from "@/components/ui/ButtonLink";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import SelectorDeVistaCampanas from "@/components/campanas/SelectorDeVistaCampanas";
import { Input } from "@/components/ui/Input";
import {
  buscarCampanasParaExplorar,
  contarCampanasParaExplorar,
  obtenerEstadosParaExplorar,
  obtenerEtiquetasParaExplorar,
  obtenerTematicasParaExplorar,
  obtenerTiposParaExplorar,
  type OrdenDeCampanas,
} from "@/lib/campanas/publicas";
import { DATA_TYPE_LABELS } from "@/lib/open-data";
import { alternarTipo, tiposDesde } from "@/lib/campanas/sistema-opciones";
import { ETIQUETA_DE_CAMPANA } from "@/lib/campanas/sistema-opciones";
import type { DataType } from "@/types";

export const metadata: Metadata = {
  title: "Explorar campañas",
  description: "Campañas ciudadanas activas en DataForGood a las que puedes sumarte con tus aportes.",
};

const nf = new Intl.NumberFormat("es-MX");

function textoDeCierre(dias: number | null): string {
  if (dias === null) return "Sin fecha de cierre";
  if (dias === 0) return "Cierra hoy";
  return dias === 1 ? "Queda 1 día" : `Quedan ${dias} días`;
}

const ORDENES: { valor: OrdenDeCampanas; etiqueta: string }[] = [
  { valor: "participacion", etiqueta: "Más participación" },
  { valor: "recientes", etiqueta: "Más recientes" },
  { valor: "cierre", etiqueta: "Cierran pronto" },
  { valor: "mayor_avance", etiqueta: "Mayor avance" },
  { valor: "menor_avance", etiqueta: "Menor avance" },
  { valor: "menos_aportes", etiqueta: "Menos aportes" },
];
const ORDENES_VALIDOS = new Set(ORDENES.map((o) => o.valor));

type Busqueda = Record<string, string | undefined>;

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
  // Tipo de dato (2026-10-28): solo los conocidos; otro valor en la URL se ignora. Desde el 2026-11-03,
  // uno o varios (?tipo=foto,video): salen las campañas que los piden todos.
  const tiposElegidos = tiposDesde(sp.tipo);
  const tipo = tiposElegidos.join(",") || undefined;
  const orden: OrdenDeCampanas = ORDENES_VALIDOS.has(sp.orden as OrdenDeCampanas)
    ? (sp.orden as OrdenDeCampanas)
    : "participacion";

  const [campanas, total, tematicas, estados, etiquetas, tipos] = await Promise.all([
    buscarCampanasParaExplorar({ q, tematica, etiqueta, locationState, tipos: tiposElegidos, orden }),
    contarCampanasParaExplorar(),
    obtenerTematicasParaExplorar(),
    obtenerEstadosParaExplorar(),
    tematica ? obtenerEtiquetasParaExplorar(tematica) : Promise.resolve([]),
    obtenerTiposParaExplorar(tiposElegidos),
  ]);

  const activos = [q, tematica, etiqueta, locationState, tipo].filter(Boolean).length;

  function enlaceCon(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tematica) params.set("tematica", tematica);
    if (etiqueta) params.set("etiqueta", etiqueta);
    if (locationState) params.set("estado", locationState);
    if (tipo) params.set("tipo", tipo);
    if (orden !== "participacion") params.set("orden", orden);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    const qs = params.toString();
    return qs ? `/explorar?${qs}` : "/explorar";
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader variante="portada" />

      <main id="contenido">
        <div className="mx-auto max-w-[1180px] px-6 pt-14 md:pt-20">
          <EncabezadoPublico centrado etiqueta="Campañas" titulo="Campañas abiertas a la comunidad">
            {nf.format(total)} {total === 1 ? "campaña activa" : "campañas activas"} recibiendo
            aportes en este momento. Crea una cuenta o inicia sesión para participar.
          </EncabezadoPublico>
        </div>

        <FranjaDeCampo style={retraso(240)} className="landing-entrada mt-10">
          <div className="relative mx-auto max-w-[680px] px-6 py-9">
            <form className="flex flex-wrap gap-2 rounded-[18px] bg-white p-2 shadow-sm" action={`${BASE_PATH}/explorar`} method="get">
              {orden !== "participacion" && <input type="hidden" name="orden" value={orden} />}
              {tematica && <input type="hidden" name="tematica" value={tematica} />}
              {etiqueta && <input type="hidden" name="etiqueta" value={etiqueta} />}
              {locationState && <input type="hidden" name="estado" value={locationState} />}
              {tipo && <input type="hidden" name="tipo" value={tipo} />}
              <div className="min-w-[200px] flex-1">
                <Input
                  type="search"
                  name="q"
                  defaultValue={q ?? ""}
                  aria-label="Buscar campañas"
                  placeholder="Buscar por nombre, organización o municipio"
                />
              </div>
              <ButtonLink href="/registro" variant="primary">
                Quiero participar
              </ButtonLink>
            </form>
          </div>
        </FranjaDeCampo>

        {/* Mosaicos por temática (2026-11-11, a pedido del usuario, como la página de categorías de
            GoFundMe): es el único filtro de temática (el de la barra lateral se quitó) y conserva los demás. */}
        <div style={retraso(280)} className="landing-entrada mx-auto mt-10 max-w-[1180px] px-6">
          <TematicasEnMosaico
            tematicas={tematicas}
            activa={tematica}
            hrefDe={(valor) => enlaceCon({ tematica: tematica === valor ? undefined : valor, etiqueta: undefined })}
            todas={{ href: enlaceCon({ tematica: undefined, etiqueta: undefined }), texto: "Todas" }}
          />
        </div>

        <div className="mx-auto mt-10 grid max-w-[1180px] grid-cols-1 gap-8 px-6 pb-24 md:grid-cols-[220px_1fr]">
          <aside style={retraso(320)} className="landing-entrada flex flex-col gap-6">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12.5px] font-semibold text-system-900">Filtros</p>
              {activos > 0 && (
                <Link
                  href={enlaceCon({ q: undefined, tematica: undefined, etiqueta: undefined, estado: undefined, tipo: undefined })}
                  className="text-[12.5px] font-medium text-brand-600 hover:underline"
                >
                  Limpiar
                </Link>
              )}
            </div>

            {/* La temática se elige con los mosaicos de arriba (2026-11-11, a pedido del usuario: se
                quitó el filtro "Temática" de esta barra). Sus etiquetas siguen aquí. */}
            {tematica && etiquetas.length > 0 && (
              <div>
                <p className={ETIQUETA_DE_FILTRO}>
                  Etiquetas de {tematica}
                </p>
                <div className={FILA_DE_FILTROS}>
                  {etiquetas.map((e) => (
                    <Link
                      key={e.valor}
                      href={enlaceCon({ etiqueta: etiqueta === e.valor ? undefined : e.valor })}
                      className={claseDeFiltro(etiqueta === e.valor)}
                    >
                      <span>#{e.valor}</span>
                      <span className={claseDeContador(etiqueta === e.valor)}>{e.total}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {tipos.length > 0 && (
              <div>
                <p className={ETIQUETA_DE_FILTRO}>
                  Tipo de dato <span className="font-normal normal-case tracking-normal">(uno o varios)</span>
                </p>
                <div className={FILA_DE_FILTROS}>
                  {tipos.map((t) => {
                    const elegido = (tiposElegidos as string[]).includes(t.valor);
                    return (
                    <Link
                      key={t.valor}
                      href={enlaceCon({ tipo: alternarTipo(tipo, t.valor) || undefined })}
                      aria-current={elegido ? "true" : undefined}
                      className={claseDeFiltro(elegido)}
                    >
                      <span>{DATA_TYPE_LABELS[t.valor as DataType] ?? t.valor}</span>
                      <span className={claseDeContador(elegido)}>{t.total}</span>
                    </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {estados.length > 0 && (
              <div>
                <p className={ETIQUETA_DE_FILTRO}>
                  Estado
                </p>
                <div className={FILA_DE_FILTROS}>
                  {estados.map((e) => (
                    <Link
                      key={e.valor}
                      href={enlaceCon({ estado: locationState === e.valor ? undefined : e.valor })}
                      className={claseDeFiltro(locationState === e.valor)}
                    >
                      <span>{e.valor}</span>
                      <span className={claseDeContador(locationState === e.valor)}>{e.total}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div>
            <nav
              style={retraso(320)}
              className="dashboard-nav landing-entrada mb-4 flex w-full min-w-0 flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
              aria-label="Ordenar resultados"
            >
              {ORDENES.map((o) => (
                <Link
                  key={o.valor}
                  href={enlaceCon({ orden: o.valor === "participacion" ? undefined : o.valor })}
                  className={claseDeOrden(orden === o.valor)}
                >
                  {o.etiqueta}
                </Link>
              ))}
            </nav>

            {campanas.length === 0 ? (
              <p className="rounded-[18px] bg-system-100 p-4 text-sm text-system-600">
                {total === 0
                  ? "Por ahora no hay campañas activas. Vuelve pronto o crea la tuya."
                  : "Ninguna campaña coincide con estos filtros. Prueba quitando alguno o buscando por otro término."}
              </p>
            ) : (
              <SelectorDeVistaCampanas
                toolbar={
                  <p className="font-mono text-[12px] text-system-600">
                    {nf.format(campanas.length)} {campanas.length === 1 ? "campaña" : "campañas"}
                    {activos > 0 ? ` · ${activos} ${activos === 1 ? "filtro activo" : "filtros activos"}` : ""}
                  </p>
                }
              >
                {campanas.map((c, i) => {
                  const pct = porcentajeDeMeta(c.approvedContributions, c.goalContributions);
                  const lugar = textoDeUbicacion({ todoElPais: c.todoElPais, municipio: c.locationCity, estado: c.locationState });
                  return (
                    // Ver el detalle y aportar requiere sesión: sin ella, proxy.ts manda a /entrar.
                    <Link key={c.id} href={`/campanas/${c.id}`} {...entradaDeTarjeta(i)}>
                      {/* Textos recortados (2026-10-22): un nombre largo o una palabra sin espacios
                          estiraba la tarjeta o se salía de ella y empujaba "Activa" afuera. El
                          texto completo queda en el title. */}
                      <article className="landing-tarjeta flex h-full min-w-0 flex-col rounded-[18px] border border-system-200 bg-white hover:border-brand-600">
                        <div className="flex flex-1 flex-col p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="line-clamp-2 min-w-0 break-words text-[16px] font-semibold leading-snug text-system-900" title={c.name}>
                              {c.name}
                            </h2>
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
                            <div className="mt-3 aspect-[4/3] overflow-hidden rounded-lg bg-system-100">
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
                })}
              </SelectorDeVistaCampanas>
            )}
          </div>
        </div>
      </main>

      <ActualizacionEnVivo />
      <PublicFooter />
    </div>
  );
}
