// Pantalla /explorar (pública): vitrina de campañas activas (sin las pausadas desde el 2026-11-03).
// Una vista por temática (con la estructura de la página "discover" de GoFundMe): una sección por temática con sus 3 campañas con más
//     aportes aprobados ("Más populares", por defecto) o las 3 más nuevas (?orden=recientes), y "Ver todas", que
//     abre /explorar/tematica/[slug]. Componente landing/CampanasPorTematica.
// Arriba, "Explora por temática" en mosaicos (landing/TematicasEnMosaico): cada
// mosaico abre la pantalla de su temática (antes filtraba la lista).
// Datos: lib/campanas/publicas.ts. Al abrir una campaña va a /campanas/[id], que sí pide sesión.
// Diseño del 2026-11-06: el de la landing (encabezado centrado, buscador sobre la franja, tarjetas con pie).

import Link from "next/link";
import { retraso } from "@/lib/animaciones";
import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";
import TematicasEnMosaico from "@/components/landing/TematicasEnMosaico";
import CampanasPorTematica, { type SeccionDeTematica } from "@/components/landing/CampanasPorTematica";
import { claseDeOrden } from "@/components/landing/estilos";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import {
  buscarCampanasPorTematica,
  contarCampanasParaExplorar,
  obtenerTematicasParaExplorar,
  type OrdenDeSecciones,
} from "@/lib/campanas/publicas";
import { rutaDeTematica } from "@/lib/tematicas/ruta";

export const metadata: Metadata = {
  title: "Explorar campañas",
  description: "Campañas ciudadanas activas en DataForGood a las que puedes sumarte con tus aportes.",
};

const nf = new Intl.NumberFormat("es-MX");

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
  const ordenDeSecciones: OrdenDeSecciones = sp.orden === "recientes" ? "recientes" : "mas_aportes";

  const [total, tematicas, porTema] = await Promise.all([
    contarCampanasParaExplorar(),
    obtenerTematicasParaExplorar(),
    buscarCampanasPorTematica(ordenDeSecciones, CAMPANAS_POR_TEMATICA),
  ]);
  // Las temáticas en el orden de los mosaicos (de la que más campañas tiene a la que menos).
  const secciones: SeccionDeTematica[] = tematicas
    .map((t) => ({ tematica: t.valor, total: t.total, campanas: porTema.get(t.valor) ?? [] }))
    .filter((s) => s.campanas.length > 0);

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

        <div style={retraso(240)} className="landing-entrada mx-auto mt-10 max-w-[1180px] px-6">
          <TematicasEnMosaico
            tematicas={tematicas}
            hrefDe={(valor) => rutaDeTematica(valor)}
          />
        </div>

        <div className="mx-auto mt-12 max-w-[1180px] px-6 pb-24">
          <div style={retraso(320)} className="landing-entrada mb-8">
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

          {secciones.length === 0 ? (
            <p className="rounded-[18px] bg-system-100 p-4 text-sm text-system-600">
              Por ahora no hay campañas activas. Vuelve pronto o crea la tuya.
            </p>
          ) : (
            <CampanasPorTematica secciones={secciones} />
          )}
        </div>
      </main>

      <ActualizacionEnVivo />
      <PublicFooter />
    </div>
  );
}
