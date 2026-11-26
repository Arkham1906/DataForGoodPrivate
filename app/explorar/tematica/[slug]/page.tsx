// Pantalla /explorar/tematica/[slug] (pública, 2026-11-12, a pedido del usuario: como las páginas de categoría
// de GoFundMe, con el estilo de la landing). Todas las campañas activas de una temática: encabezado con su
// ícono, subtemáticas (?etiqueta=), orden (?orden=, por defecto las más recientes) y "Otras temáticas". La
// abren los mosaicos de temática de /explorar y el "Ver todas" de cada sección de su vista por temática
// (2026-11-13; hasta ese día, las temáticas de "Lo más reciente" de la landing).
// Datos: lib/campanas/publicas.ts (resolverTematicaDeRuta, buscarCampanasParaExplorar). El slug sale del nombre
// (lib/tematicas/ruta.ts); si no es de ninguna temática, 404. Abrir una campaña pide sesión (proxy.ts).
// Tipo de dato (2026-11-23, a pedido del usuario: el filtro que tenía la lista de /explorar hasta el 2026-11-22,
// ahora solo aquí, adonde llevan "Ver todas" y los mosaicos de "Explora por temática"): ?tipo=foto,video, uno o
// varios; cada tipo marcado reduce la lista (salen las que piden todos los marcados). Salen siempre los 5 tipos, en
// el mismo orden y también en 0, y el número dice cuántas quedan al sumarlo (obtenerTiposParaExplorar con ámbito).
// Desde el 2026-11-25 el número de cada subtemática también cuenta los tipos elegidos, la fila de tipos no sale en
// una temática sin campañas y el aviso culpa al tipo solo si sin él habría campañas.

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
  obtenerTiposParaExplorar,
  resolverTematicaDeRuta,
  type OrdenDeCampanas,
} from "@/lib/campanas/publicas";
import { NOMBRE_DE_TIPO, alternarTipo, mensajeSinTiposDeDato, nombresDeTipos, tiposDesde, type TipoDeDato } from "@/lib/campanas/sistema-opciones";
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
  // Solo los tipos conocidos; otro valor en la URL se ignora.
  const tiposElegidos: TipoDeDato[] = tiposDesde(sp.tipo);
  const tipo = tiposElegidos.join(",") || undefined;
  // El número de cada subtemática ya cuenta los tipos elegidos (2026-11-25).
  const [etiquetas, tematicas] = await Promise.all([obtenerEtiquetasParaExplorar(tematica, tiposElegidos), obtenerTematicasParaExplorar()]);
  // Solo una subtemática que exista en esta temática; otro valor en la URL se ignora.
  const etiqueta = etiquetas.some((e) => e.valor === sp.etiqueta) ? sp.etiqueta : undefined;
  const [campanas, tipos, totalDeLaTematica] = await Promise.all([
    buscarCampanasParaExplorar({ tematica, etiqueta, tipos: tiposElegidos, orden }),
    obtenerTiposParaExplorar(tiposElegidos, { tematica, etiqueta }),
    Promise.resolve(tematicas.find((t) => t.valor === tematica)?.total ?? 0),
  ]);

  const base = rutaDeTematica(tematica);
  function enlaceCon(cambios: { orden?: OrdenDeCampanas; etiqueta?: string | null; tipo?: string | null }) {
    const params = new URLSearchParams();
    const nuevoOrden = cambios.orden ?? orden;
    const nuevaEtiqueta = cambios.etiqueta === null ? undefined : (cambios.etiqueta ?? etiqueta);
    const nuevoTipo = cambios.tipo === null ? undefined : (cambios.tipo ?? tipo);
    if (nuevoOrden !== ORDEN_DE_ENTRADA) params.set("orden", nuevoOrden);
    if (nuevaEtiqueta) params.set("etiqueta", nuevaEtiqueta);
    if (nuevoTipo) params.set("tipo", nuevoTipo);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }
  const textoDeTipos = nombresDeTipos(tipo);
  // Lista vacía por culpa del tipo solo si sin él sí habría campañas (regla del 2026-11-24; desde el 2026-11-25 también
  // aquí: antes una temática sin campañas, con ?tipo=, decía que faltaba ese tipo).
  const sinElTipo = etiqueta ? (etiquetas.find((e) => e.valor === etiqueta)?.totalSinTipo ?? 0) : totalDeLaTematica;
  const vaciaPorElTipo = Boolean(tipo) && sinElTipo > 0;
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

          {/* Sin campañas activas en la temática no sale: serían cinco tipos en 0 (2026-11-25). */}
          {tipos.length > 0 && totalDeLaTematica > 0 && (
            <div style={retraso(300)} className="landing-entrada mb-6">
              <p className={ETIQUETA_DE_FILTRO}>
                Tipo de dato <span className="font-normal">(uno o varios)</span>
              </p>
              <div
                role="group"
                aria-label="Filtrar por tipo de dato, uno o varios"
                className="dashboard-nav flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
              >
                <Link href={enlaceCon({ tipo: null })} aria-current={!tipo ? "true" : undefined} className={claseDePastilla(!tipo)}>
                  Todos
                </Link>
                {tipos.map((t) => {
                  const elegido = (tiposElegidos as string[]).includes(t.valor);
                  return (
                    <Link
                      key={t.valor}
                      href={enlaceCon({ tipo: alternarTipo(tipo, t.valor) || null })}
                      aria-current={elegido ? "true" : undefined}
                      className={claseDePastilla(elegido)}
                    >
                      {NOMBRE_DE_TIPO[t.valor as TipoDeDato] ?? t.valor}
                      <span className={`font-mono text-[11px] ${elegido ? "text-white/75" : "text-system-500"}`}>{t.total}</span>
                    </Link>
                  );
                })}
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
                {vaciaPorElTipo
                  ? mensajeSinTiposDeDato(tipo, `campañas activas de ${tematica}${etiqueta ? ` en #${etiqueta}` : ""}`)
                  : etiqueta
                    ? `Ninguna campaña activa de ${tematica} tiene la subtemática #${etiqueta}.`
                    : `Todavía no hay campañas activas de ${tematica}. ¿Tienes una idea? Crea la primera.`}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                {vaciaPorElTipo ? (
                  <ButtonLink href={enlaceCon({ tipo: null })} variant="secondary" size="sm">
                    Quitar el filtro de tipo de dato
                  </ButtonLink>
                ) : null}
                <ButtonLink href="/registro" variant="primary" size="sm">
                  Crear una campaña
                </ButtonLink>
              </div>
            </div>
          ) : (
            <SelectorDeVistaCampanas
              toolbar={
                <p className="font-mono text-[12px] text-system-600">
                  {nf.format(campanas.length)} {campanas.length === 1 ? "campaña" : "campañas"}
                  {etiqueta ? ` · #${etiqueta}` : ""}
                  {tipo ? ` · ${textoDeTipos}` : ""}
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
