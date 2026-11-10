// Pantalla /datos (pública): catálogo de datos abiertos (campañas finalizadas).
// Datos: lib/open-data.ts (búsqueda, temática, estado y orden en searchParams, resueltos en SQL).
// Diseño del 2026-11-06: el de la landing (encabezado centrado, buscador sobre la franja, tarjetas con portada).

import Link from "next/link";
import { BASE_PATH } from "@/lib/base-path";
import { entradaDeTarjeta, retraso } from "@/lib/animaciones";
import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import EncabezadoPublico from "@/components/layout/EncabezadoPublico";
import FranjaDeCampo from "@/components/landing/FranjaDeCampo";
import TarjetaDeConjunto from "@/components/landing/TarjetaDeConjunto";
import { ETIQUETA_DE_FILTRO, FILA_DE_FILTROS, claseDeContador, claseDeFiltro, claseDeOrden } from "@/components/landing/estilos";
import ActualizacionEnVivo from "@/components/layout/ActualizacionEnVivo";
import { Input } from "@/components/ui/Input";
import {
  DATA_TYPE_LABELS,
  buscarConjuntosAbiertos,
  contarConjuntosPublicados,
  obtenerEstadosDelCatalogo,
  obtenerTematicasDelCatalogo,
  obtenerTiposDelCatalogo,
  type OpenDataOrder,
} from "@/lib/open-data";
import { alternarTipo, tiposDesde } from "@/lib/campanas/sistema-opciones";
import type { DataType } from "@/types";

export const metadata: Metadata = {
  title: "Datos abiertos",
  description:
    "Conjuntos de datos abiertos generados por campañas ciudadanas: solo aportes aprobados de campañas ya cerradas.",
};

// En vivo (2026-10-31): se arma en cada visita, sin la caché de cinco minutos de antes.
export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("es-MX");

const ORDENES: { valor: OpenDataOrder; etiqueta: string }[] = [
  { valor: "recientes", etiqueta: "Recién cerrados" },
  { valor: "cobertura", etiqueta: "Mayor cobertura" },
  { valor: "descargas", etiqueta: "Más descargados" },
];
const ORDENES_VALIDOS = new Set(ORDENES.map((o) => o.valor));

type Busqueda = Record<string, string | undefined>;

export default async function CatalogoDeDatosPage({
  searchParams,
}: {
  searchParams: Promise<Busqueda>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const tematica = sp.tematica || undefined;
  const locationState = sp.estado || undefined;
  // Tipo de dato (2026-11-06, como /explorar): uno o varios (?tipo=foto,video); salen los que los pidieron todos.
  const tiposElegidos = tiposDesde(sp.tipo);
  const tipo = tiposElegidos.join(",") || undefined;
  const orden: OpenDataOrder = ORDENES_VALIDOS.has(sp.orden as OpenDataOrder) ? (sp.orden as OpenDataOrder) : "recientes";

  const [{ conjuntos }, total, tematicas, estados, tipos] = await Promise.all([
    buscarConjuntosAbiertos({ q, tematica, locationState, tipos: tiposElegidos, orden }),
    contarConjuntosPublicados(),
    obtenerTematicasDelCatalogo(),
    obtenerEstadosDelCatalogo(),
    obtenerTiposDelCatalogo(tiposElegidos),
  ]);

  const activos = [q, tematica, locationState, tipo].filter(Boolean).length;

  function enlaceCon(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tematica) params.set("tematica", tematica);
    if (locationState) params.set("estado", locationState);
    if (tipo) params.set("tipo", tipo);
    if (orden !== "recientes") params.set("orden", orden);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    const qs = params.toString();
    return qs ? `/datos?${qs}` : "/datos";
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader variante="portada" />

      <main id="contenido">
        <div className="mx-auto max-w-[1180px] px-6 pt-14 md:pt-20">
          <EncabezadoPublico centrado etiqueta="Datos abiertos" titulo="Conjuntos de datos de la comunidad">
            {nf.format(total)} {total === 1 ? "conjunto listo" : "conjuntos listos"} para explorar y
            descargar. Nacen de campañas ciudadanas y reúnen solo aportes aprobados: úsalos para
            investigar, enseñar o tomar mejores decisiones.
          </EncabezadoPublico>
        </div>

        <FranjaDeCampo style={retraso(240)} className="landing-entrada mt-10">
          <div className="relative mx-auto max-w-[680px] px-6 py-9">
            <form className="rounded-[18px] bg-white p-2 shadow-sm" action={`${BASE_PATH}/datos`} method="get">
              {orden !== "recientes" && <input type="hidden" name="orden" value={orden} />}
              {tematica && <input type="hidden" name="tematica" value={tematica} />}
              {locationState && <input type="hidden" name="estado" value={locationState} />}
              {tipo && <input type="hidden" name="tipo" value={tipo} />}
              <Input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                aria-label="Buscar conjuntos de datos"
                placeholder="Buscar por tema, organización o municipio"
              />
            </form>
          </div>
        </FranjaDeCampo>

        <div className="mx-auto mt-10 grid max-w-[1180px] grid-cols-1 gap-8 px-6 pb-24 md:grid-cols-[220px_1fr]">
          <aside style={retraso(320)} className="landing-entrada flex flex-col gap-6">
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-[12.5px] font-semibold text-system-900">Filtros</p>
                {activos > 0 && (
                  <Link href={enlaceCon({ q: undefined, tematica: undefined, estado: undefined, tipo: undefined })} className="text-[12.5px] font-medium text-brand-600 hover:underline">
                    Limpiar
                  </Link>
                )}
              </div>
            </div>

            {tematicas.length > 0 && (
              <div>
                <p className={ETIQUETA_DE_FILTRO}>
                  Temática
                </p>
                <div className={FILA_DE_FILTROS}>
                  {tematicas.map((t) => (
                    <Link
                      key={t.valor}
                      href={enlaceCon({ tematica: tematica === t.valor ? undefined : t.valor })}
                      className={claseDeFiltro(tematica === t.valor)}
                    >
                      <span>{t.valor}</span>
                      <span className={claseDeContador(tematica === t.valor)}>{t.total}</span>
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
            <nav style={retraso(320)} className="dashboard-nav landing-entrada mb-4 flex w-full min-w-0 flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0" aria-label="Ordenar resultados">
              {ORDENES.map((o) => (
                <Link
                  key={o.valor}
                  href={enlaceCon({ orden: o.valor === "recientes" ? undefined : o.valor })}
                  className={claseDeOrden(orden === o.valor)}
                >
                  {o.etiqueta}
                </Link>
              ))}
            </nav>

            <p className="mb-4 font-mono text-[12px] text-system-600">
              {nf.format(conjuntos.length)} {conjuntos.length === 1 ? "conjunto" : "conjuntos"}
              {activos > 0 ? ` · ${activos} ${activos === 1 ? "filtro activo" : "filtros activos"}` : ""}
            </p>

            {conjuntos.length === 0 ? (
              <p className="rounded-[18px] bg-system-100 p-4 text-sm text-system-600">
                {total === 0
                  ? "Todavía no hay conjuntos de datos publicados: aparecerán aquí en cuanto una campaña se finalice."
                  : "Ningún conjunto coincide con estos filtros. Prueba quitando alguno o buscando por otro término."}
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {conjuntos.map((c, i) => {
                  const { className, style } = entradaDeTarjeta(i);
                  return (
                    <li key={c.id} className={className} style={style}>
                      <TarjetaDeConjunto conjunto={c} indice={i} detalle />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>

      <ActualizacionEnVivo />
      <PublicFooter />
    </div>
  );
}
