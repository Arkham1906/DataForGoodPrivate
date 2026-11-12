// Pantalla /explorar/tematica/[slug] (pública, 2026-11-12, a pedido del usuario: como las páginas de categoría
// de GoFundMe, con el estilo de la landing). Todas las campañas activas de una temática: encabezado con su
// ícono, subtemáticas (?etiqueta=), orden (?orden=, por defecto las más recientes) y "Otras temáticas". La
// abren las temáticas de "Lo más reciente" en la landing (components/landing/FilaDeTematicas). Para combinar
// con más filtros (estado, tipo de dato, búsqueda) enlaza a /explorar?tematica=.
// Datos: lib/campanas/publicas.ts (resolverTematicaDeRuta, buscarCampanasParaExplorar). El slug sale del nombre
// (lib/tematicas/ruta.ts); si no es de ninguna temática, 404. Abrir una campaña pide sesión (proxy.ts).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import FranjaDeCampo from "@/components/landing/FranjaDeCampo";
import FilaDeTematicas from "@/components/landing/FilaDeTematicas";
import { ETIQUETA_DE_FILTRO, claseDeOrden } from "@/components/landing/estilos";
import SelectorDeVistaCampanas from "@/components/campanas/SelectorDeVistaCampanas";
import TarjetaDeCampanaPublica from "@/components/campanas/TarjetaDeCampanaPublica";
import ButtonLink from "@/components/ui/ButtonLink";
import IconoDeTematica from "@/components/ui/IconoDeTematica";
import { retraso } from "@/lib/animaciones";
import {
  buscarCampanasParaExplorar,
  obtenerEtiquetasParaExplorar,
  obtenerTematicasParaExplorar,
  resolverTematicaDeRuta,
  type OrdenDeCampanas,
} from "@/lib/campanas/publicas";
import { rutaDeTematica } from "@/lib/tematicas/ruta";

const nf = new Intl.NumberFormat("es-MX");

/** Órdenes de esta pantalla; la primera es la de entrada (sin ?orden). */
const ORDENES: { valor: OrdenDeCampanas; etiqueta: string }[] = [
  { valor: "recientes", etiqueta: "Más recientes" },
  { valor: "participacion", etiqueta: "Más participación" },
  { valor: "cierre", etiqueta: "Cierran pronto" },
  { valor: "mayor_avance", etiqueta: "Mayor avance" },
];
const ORDEN_DE_ENTRADA: OrdenDeCampanas = "recientes";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tematica = await resolverTematicaDeRuta((await params).slug);
  if (!tematica) return { title: "Temática no encontrada" };
  return {
    title: `Campañas de ${tematica}`,
    description: `Campañas ciudadanas activas de ${tematica} en DataForGood a las que puedes sumarte con tus aportes.`,
  };
}

export default async function CampanasDeTematicaPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tematica = await resolverTematicaDeRuta(slug);
  if (!tematica) notFound();

  const orden = ORDENES.find((o) => o.valor === sp.orden)?.valor ?? ORDEN_DE_ENTRADA;
  const [etiquetas, tematicas] = await Promise.all([obtenerEtiquetasParaExplorar(tematica), obtenerTematicasParaExplorar()]);
  // Solo una subtemática que exista en esta temática; otro valor en la URL se ignora.
  const etiqueta = etiquetas.some((e) => e.valor === sp.etiqueta) ? sp.etiqueta : undefined;
  const [campanas, totalDeLaTematica] = await Promise.all([
    buscarCampanasParaExplorar({ tematica, etiqueta, orden }),
    Promise.resolve(tematicas.find((t) => t.valor === tematica)?.total ?? 0),
  ]);

  const base = rutaDeTematica(tematica);
  function enlaceCon(cambios: { orden?: OrdenDeCampanas; etiqueta?: string | null }) {
    const params = new URLSearchParams();
    const nuevoOrden = cambios.orden ?? orden;
    const nuevaEtiqueta = cambios.etiqueta === null ? undefined : (cambios.etiqueta ?? etiqueta);
    if (nuevoOrden !== ORDEN_DE_ENTRADA) params.set("orden", nuevoOrden);
    if (nuevaEtiqueta) params.set("etiqueta", nuevaEtiqueta);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }
  const otras = tematicas.filter((t) => t.valor !== tematica);

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader variante="portada" />

      <main id="contenido">
        <div className="mx-auto max-w-[1180px] px-6 pt-14 md:pt-20">
          <nav aria-label="Ruta" className="landing-entrada mb-6 text-center font-mono text-[12.5px] text-system-500">
            <Link href="/explorar" className="hover:text-brand-700 hover:underline">
              Explorar
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-system-700">{tematica}</span>
          </nav>
          <EncabezadoPublico centrado etiqueta="Temática" titulo={`Campañas de ${tematica}`}>
            {totalDeLaTematica === 0
              ? "Por ahora no hay campañas activas de esta temática."
              : `${nf.format(totalDeLaTematica)} ${totalDeLaTematica === 1 ? "campaña activa recibe" : "campañas activas reciben"} aportes en este momento. Crea una cuenta o inicia sesión para participar.`}
          </EncabezadoPublico>
        </div>

        <FranjaDeCampo style={retraso(240)} className="landing-entrada mt-10">
          <div className="relative mx-auto flex max-w-[680px] justify-center px-6 py-9">
            <div className="flex w-full flex-col items-center gap-4 rounded-[18px] bg-white p-5 text-center shadow-sm sm:flex-row sm:text-left">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <IconoDeTematica tematica={tematica} className="h-9 w-9" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-system-900">¿Te importa {tematica.toLocaleLowerCase("es-MX")}?</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-system-600">
                  Súmate con fotos, videos, audios, documentos o testimonios, o abre tu propia campaña.
                </p>
              </div>
              <ButtonLink href="/registro" variant="primary" className="shrink-0">
                Crear una campaña
              </ButtonLink>
            </div>
          </div>
        </FranjaDeCampo>

        <div className="mx-auto max-w-[1180px] px-6 pb-16 pt-10">
          {etiquetas.length > 0 && (
            <div style={retraso(280)} className="landing-entrada mb-6">
              <p className={ETIQUETA_DE_FILTRO}>Subtemáticas</p>
              <div className="dashboard-nav flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0">
                <Link href={enlaceCon({ etiqueta: null })} aria-current={!etiqueta ? "true" : undefined} className={claseDePastilla(!etiqueta)}>
                  Todas
                </Link>
                {etiquetas.map((e) => (
                  <Link
                    key={e.valor}
                    href={enlaceCon({ etiqueta: etiqueta === e.valor ? null : e.valor })}
                    aria-current={etiqueta === e.valor ? "true" : undefined}
                    className={claseDePastilla(etiqueta === e.valor)}
                  >
                    #{e.valor}
                    <span className={`font-mono text-[11px] ${etiqueta === e.valor ? "text-white/75" : "text-system-500"}`}>{e.total}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <nav
            style={retraso(320)}
            className="dashboard-nav landing-entrada mb-4 flex w-full min-w-0 flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
            aria-label="Ordenar campañas"
          >
            {ORDENES.map((o) => (
              <Link key={o.valor} href={enlaceCon({ orden: o.valor })} className={claseDeOrden(orden === o.valor)}>
                {o.etiqueta}
              </Link>
            ))}
          </nav>

          {campanas.length === 0 ? (
            <div className="rounded-[18px] bg-system-100 p-6 text-center">
              <p className="text-[15px] text-system-700">
                {etiqueta
                  ? `Ninguna campaña activa de ${tematica} tiene la subtemática #${etiqueta}.`
                  : `Todavía no hay campañas activas de ${tematica}. ¿Tienes una idea? Crea la primera.`}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <ButtonLink href="/registro" variant="primary" size="sm">
                  Crear una campaña
                </ButtonLink>
                <ButtonLink href="/explorar" variant="secondary" size="sm">
                  Ver todas las campañas
                </ButtonLink>
              </div>
            </div>
          ) : (
            <SelectorDeVistaCampanas
              toolbar={
                <p className="font-mono text-[12px] text-system-600">
                  {nf.format(campanas.length)} {campanas.length === 1 ? "campaña" : "campañas"}
                  {etiqueta ? ` · #${etiqueta}` : ""}
                </p>
              }
            >
              {campanas.map((c, i) => (
                <TarjetaDeCampanaPublica key={c.id} campana={c} indice={i} />
              ))}
            </SelectorDeVistaCampanas>
          )}

          <p className="mt-6 text-center text-[13.5px] text-system-600">
            ¿Buscas por estado, tipo de dato o palabra?{" "}
            <Link href={`/explorar?tematica=${encodeURIComponent(tematica)}`} className="font-semibold text-brand-600 hover:underline">
              Usa todos los filtros en Explorar →
            </Link>
          </p>
        </div>

        {otras.length > 0 && (
          <section aria-labelledby="otras-tematicas" className="border-t border-system-200 bg-system-50">
            <div className="mx-auto max-w-[1180px] px-6 py-12 md:py-16">
              <p className="mb-3 font-mono text-[13px] text-system-600">Sigue explorando</p>
              <h2 id="otras-tematicas" className="mb-6 text-[24px] font-semibold tracking-tight text-system-900 md:text-[28px]">
                Otras temáticas
              </h2>
              <FilaDeTematicas tematicas={otras} etiqueta="Otras temáticas" />
            </div>
          </section>
        )}
      </main>

      <ActualizacionEnVivo />
      <PublicFooter />
    </div>
  );
}

function claseDePastilla(elegida: boolean): string {
  return `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] transition-colors ${
    elegida ? "border-system-900 bg-system-900 font-semibold text-white" : "border-system-300 bg-white text-system-700 hover:border-brand-600"
  }`;
}
