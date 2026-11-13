// Pantalla /explorar (pública): vitrina de campañas activas (sin las pausadas desde el 2026-11-03).
// Dos vistas (2026-11-13, a pedido del usuario, con la estructura de la página "discover" de GoFundMe):
//   - Por temática (la de entrada, sin búsqueda ni filtros): una sección por temática con sus 3 campañas con más
//     aportes aprobados ("Más populares", por defecto) o las 3 más nuevas (?orden=recientes), y "Ver todas", que
//     abre /explorar/tematica/[slug]. Componente landing/CampanasPorTematica.
//   - Lista completa (?vista=todas, o con ?q, ?tematica, ?etiqueta, ?estado o ?tipo): la de siempre, con la barra
//     de filtros y el orden (?orden). La abren el mosaico "Todas", el buscador y "Ver todas" de la landing.
// Arriba de las dos, "Explora por temática" en mosaicos (landing/TematicasEnMosaico, desde el 2026-11-11): cada
// mosaico abre la pantalla de su temática (antes filtraba la lista).
// Datos: lib/campanas/publicas.ts. Al abrir una campaña va a /campanas/[id], que sí pide sesión.
// Diseño del 2026-11-06: el de la landing (encabezado centrado, buscador sobre la franja, tarjetas con pie).

import Link from "next/link";
import { BASE_PATH } from "@/lib/base-path";
import { retraso } from "@/lib/animaciones";
import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";
import FranjaDeCampo from "@/components/landing/FranjaDeCampo";
import TematicasEnMosaico from "@/components/landing/TematicasEnMosaico";
import CampanasPorTematica, { type SeccionDeTematica } from "@/components/landing/CampanasPorTematica";
import { ETIQUETA_DE_FILTRO, FILA_DE_FILTROS, claseDeContador, claseDeFiltro, claseDeOrden } from "@/components/landing/estilos";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import ButtonLink from "@/components/ui/ButtonLink";
import SelectorDeVistaCampanas from "@/components/campanas/SelectorDeVistaCampanas";
import TarjetaDeCampanaPublica from "@/components/campanas/TarjetaDeCampanaPublica";
import { Input } from "@/components/ui/Input";
import {
  buscarCampanasParaExplorar,
  buscarCampanasPorTematica,
  contarCampanasParaExplorar,
  obtenerEstadosParaExplorar,
  obtenerEtiquetasParaExplorar,
  obtenerTematicasParaExplorar,
  obtenerTiposParaExplorar,
  type OrdenDeCampanas,
  type OrdenDeSecciones,
} from "@/lib/campanas/publicas";
import { rutaDeTematica } from "@/lib/tematicas/ruta";
import { DATA_TYPE_LABELS } from "@/lib/open-data";
import { alternarTipo, tiposDesde } from "@/lib/campanas/sistema-opciones";
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
  { valor: "mayor_avance", etiqueta: "Mayor avance" },
  { valor: "menor_avance", etiqueta: "Menor avance" },
  { valor: "menos_aportes", etiqueta: "Menos aportes" },
];
const ORDENES_VALIDOS = new Set(ORDENES.map((o) => o.valor));

/** Qué campañas salen en cada temática de la vista por temática; la primera es la de entrada (sin ?orden). */
const ORDENES_DE_SECCIONES: { valor: OrdenDeSecciones; etiqueta: string; explicacion: string }[] = [
  { valor: "mas_aportes", etiqueta: "Más populares", explicacion: "Las 3 campañas con más aportes aprobados de cada temática." },
  { valor: "recientes", etiqueta: "Más recientes", explicacion: "Las 3 campañas más nuevas de cada temática." },
];
/** Campañas por temática en la vista por temática. */
const CAMPANAS_POR_TEMATICA = 3;

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

  const activos = [q, tematica, etiqueta, locationState, tipo].filter(Boolean).length;
  // Sin búsqueda ni filtros y sin pedir la lista completa: la vista por temática.
  const porTematica = sp.vista !== "todas" && activos === 0;
  const ordenDeSecciones: OrdenDeSecciones = sp.orden === "recientes" ? "recientes" : "mas_aportes";

  // La vista por temática no lee la lista ni las facetas de la barra de filtros.
  const [campanas, total, tematicas, estados, etiquetas, tipos, porTema] = await Promise.all([
    porTematica ? Promise.resolve([]) : buscarCampanasParaExplorar({ q, tematica, etiqueta, locationState, tipos: tiposElegidos, orden }),
    contarCampanasParaExplorar(),
    obtenerTematicasParaExplorar(),
    porTematica ? Promise.resolve([]) : obtenerEstadosParaExplorar(),
    !porTematica && tematica ? obtenerEtiquetasParaExplorar(tematica) : Promise.resolve([]),
    porTematica ? Promise.resolve([]) : obtenerTiposParaExplorar(tiposElegidos),
    porTematica ? buscarCampanasPorTematica(ordenDeSecciones, CAMPANAS_POR_TEMATICA) : Promise.resolve(new Map()),
  ]);
  // Las temáticas en el orden de los mosaicos (de la que más campañas tiene a la que menos).
  const secciones: SeccionDeTematica[] = tematicas
    .map((t) => ({ tematica: t.valor, total: t.total, campanas: porTema.get(t.valor) ?? [] }))
    .filter((s) => s.campanas.length > 0);

  /** Enlace de la lista completa: conserva búsqueda, filtros y orden, y siempre lleva ?vista=todas. */
  function enlaceCon(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams({ vista: "todas" });
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
    return `/explorar?${params.toString()}`;
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
            {/* Buscar lleva a la lista completa (con ?q ya no es la vista por temática). */}
            <form className="flex flex-wrap gap-2 rounded-[18px] bg-white p-2 shadow-sm" action={`${BASE_PATH}/explorar`} method="get">
              <input type="hidden" name="vista" value="todas" />
              {!porTematica && orden !== "participacion" && <input type="hidden" name="orden" value={orden} />}
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

        {/* Mosaicos por temática (2026-11-11, a pedido del usuario, como la página de categorías de GoFundMe).
            Desde el 2026-11-13 cada uno abre la pantalla de su temática; "Todas" abre la lista completa. */}
        <div style={retraso(280)} className="landing-entrada mx-auto mt-10 max-w-[1180px] px-6">
          <TematicasEnMosaico
            tematicas={tematicas}
            hrefDe={(valor) => rutaDeTematica(valor)}
            todas={{ href: "/explorar?vista=todas", texto: "Todas", actual: !porTematica && !tematica }}
          />
        </div>

        {porTematica ? (
          <div className="mx-auto mt-12 max-w-[1180px] px-6 pb-24">
            <div style={retraso(320)} className="landing-entrada mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="min-w-0">
                <nav className="flex gap-1.5" aria-label="Qué campañas ver de cada temática">
                  {ORDENES_DE_SECCIONES.map((o) => (
                    <Link
                      key={o.valor}
                      href={o.valor === "mas_aportes" ? "/explorar" : `/explorar?orden=${o.valor}`}
                      aria-current={ordenDeSecciones === o.valor ? "page" : undefined}
                      className={claseDeOrden(ordenDeSecciones === o.valor)}
                    >
                      {o.etiqueta}
                    </Link>
                  ))}
                </nav>
                <p className="mt-2 text-[13px] text-system-600">
                  {ORDENES_DE_SECCIONES.find((o) => o.valor === ordenDeSecciones)?.explicacion}
                </p>
              </div>
              <Link href="/explorar?vista=todas" className="text-[13.5px] font-semibold text-brand-600 hover:underline">
                Ver todas las campañas con filtros →
              </Link>
            </div>

            {secciones.length === 0 ? (
              <p className="rounded-[18px] bg-system-100 p-4 text-sm text-system-600">
                Por ahora no hay campañas activas. Vuelve pronto o crea la tuya.
              </p>
            ) : (
              <CampanasPorTematica secciones={secciones} />
            )}
          </div>
        ) : (
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

            {/* La temática ya no se elige aquí (2026-11-11: el filtro pasó a los mosaicos; desde el 2026-11-13 los
                mosaicos abren la pantalla de la temática). Si llega en la URL (p. ej. desde esa pantalla), se ve y
                se puede quitar; sus etiquetas siguen aquí. */}
            {tematica && (
              <div>
                <p className={ETIQUETA_DE_FILTRO}>Temática</p>
                <div className={FILA_DE_FILTROS}>
                  <Link href={enlaceCon({ tematica: undefined, etiqueta: undefined })} className={claseDeFiltro(true)}>
                    <span>{tematica}</span>
                    <span aria-hidden="true">✕</span>
                    <span className="sr-only">(quitar este filtro)</span>
                  </Link>
                </div>
              </div>
            )}

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
            <Link href="/explorar" className="mb-3 inline-block text-[13px] text-system-600 hover:text-brand-700">
              ← Ver por temática
            </Link>
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
                <div className="contents group-data-[vista=lista]:hidden">
                  {campanas.map((c, i) => <TarjetaDeCampanaPublica key={`grid-${c.id}`} campana={c} indice={i} compacta />)}
                </div>
                <div className="contents hidden group-data-[vista=lista]:contents">
                  {campanas.map((c, i) => <TarjetaDeCampanaPublica key={`list-${c.id}`} campana={c} indice={i} lista />)}
                </div>
              </SelectorDeVistaCampanas>
            )}
          </div>
        </div>
        )}
      </main>

      <ActualizacionEnVivo />
      <PublicFooter />
    </div>
  );
}
