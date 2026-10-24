// Pantalla /datos (pública): catálogo de datos abiertos (campañas finalizadas).
// Datos: lib/open-data.ts (búsqueda, temática, estado y orden en searchParams, resueltos en SQL).

import { textoDeUbicacion } from "@/lib/campanas/ubicacion";
import Link from "next/link";
import { BASE_PATH } from "@/lib/base-path";
import { entradaDeTarjeta, retraso } from "@/lib/animaciones";
import type { Metadata } from "next";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import ButtonLink from "@/components/ui/ButtonLink";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";
import { Input } from "@/components/ui/Input";
import {
  DATA_TYPE_LABELS,
  buscarConjuntosAbiertos,
  contarConjuntosPublicados,
  obtenerEstadosDelCatalogo,
  obtenerTematicasDelCatalogo,
  type OpenDataOrder,
} from "@/lib/open-data";

export const metadata: Metadata = {
  title: "Datos abiertos",
  description:
    "Conjuntos de datos abiertos generados por campañas ciudadanas: solo aportes aprobados de campañas ya cerradas.",
};

// Página pública: se regenera cada cinco minutos, igual que la portada.
export const revalidate = 300;

const nf = new Intl.NumberFormat("es-MX");

const ORDENES: { valor: OpenDataOrder; etiqueta: string }[] = [
  { valor: "recientes", etiqueta: "Recién cerrados" },
  { valor: "cobertura", etiqueta: "Mayor cobertura" },
  { valor: "descargas", etiqueta: "Más descargados" },
  { valor: "calidad", etiqueta: "Mejor calidad" },
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
  const orden: OpenDataOrder = ORDENES_VALIDOS.has(sp.orden as OpenDataOrder) ? (sp.orden as OpenDataOrder) : "recientes";

  const [{ conjuntos }, total, tematicas, estados] = await Promise.all([
    buscarConjuntosAbiertos({ q, tematica, locationState, orden }),
    contarConjuntosPublicados(),
    obtenerTematicasDelCatalogo(),
    obtenerEstadosDelCatalogo(),
  ]);

  const activos = [q, tematica, locationState].filter(Boolean).length;

  function enlaceCon(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tematica) params.set("tematica", tematica);
    if (locationState) params.set("estado", locationState);
    if (orden !== "recientes") params.set("orden", orden);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    const qs = params.toString();
    return qs ? `/datos?${qs}` : "/datos";
  }

  return (
    <div className="min-h-screen bg-system-50">
      <PublicHeader />

      <main id="contenido" className="mx-auto max-w-5xl px-6 pb-24 pt-14">
        <p className="landing-entrada mb-2 font-mono text-[10.5px] uppercase tracking-widest text-brand-600">
          Datos abiertos
        </p>
        <h1 style={retraso(80)} className="landing-entrada max-w-2xl text-[32px] font-extrabold leading-tight tracking-tight text-system-900">
          Conjuntos de datos de la comunidad
        </h1>
        <p style={retraso(160)} className="landing-entrada mt-4 max-w-2xl text-[14.5px] leading-relaxed text-system-600">
          {nf.format(total)} {total === 1 ? "conjunto publicado" : "conjuntos publicados"} a
          partir de campañas ya cerradas. Cada uno reúne solo aportes aprobados, sin datos que
          identifiquen a quien participó.
        </p>

        <form style={retraso(240)} className="landing-entrada mt-6 flex flex-wrap gap-2.5" action={`${BASE_PATH}/datos`} method="get">
          {orden !== "recientes" && <input type="hidden" name="orden" value={orden} />}
          {tematica && <input type="hidden" name="tematica" value={tematica} />}
          {locationState && <input type="hidden" name="estado" value={locationState} />}
          <Input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            aria-label="Buscar conjuntos de datos"
            placeholder="Buscar por tema, organización o municipio"
            className="max-w-sm"
          />
          <ButtonLink href="/mis-campanas/nueva" variant="primary">
            Publicar una campaña
          </ButtonLink>
        </form>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
          <aside style={retraso(320)} className="landing-entrada flex flex-col gap-6">
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-[12.5px] font-semibold text-system-900">Filtros</p>
                {activos > 0 && (
                  <Link href={enlaceCon({ q: undefined, tematica: undefined, estado: undefined })} className="text-[12.5px] font-medium text-brand-600 hover:underline">
                    Limpiar
                  </Link>
                )}
              </div>
            </div>

            {tematicas.length > 0 && (
              <div>
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-system-500">
                  Temática
                </p>
                <div className="flex flex-col gap-1">
                  {tematicas.map((t) => (
                    <Link
                      key={t.valor}
                      href={enlaceCon({ tematica: tematica === t.valor ? undefined : t.valor })}
                      className={`flex items-center justify-between rounded px-2 py-1.5 text-[13px] ${
                        tematica === t.valor
                          ? "bg-brand-50 font-semibold text-brand-600"
                          : "text-system-600 hover:bg-system-100"
                      }`}
                    >
                      <span>{t.valor}</span>
                      <span className="font-mono text-[11px] text-system-500">{t.total}</span>
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
                <div className="flex flex-col gap-1">
                  {estados.map((e) => (
                    <Link
                      key={e.valor}
                      href={enlaceCon({ estado: locationState === e.valor ? undefined : e.valor })}
                      className={`flex items-center justify-between rounded px-2 py-1.5 text-[13px] ${
                        locationState === e.valor
                          ? "bg-brand-50 font-semibold text-brand-600"
                          : "text-system-600 hover:bg-system-100"
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
            <nav style={retraso(320)} className="landing-entrada mb-4 flex flex-wrap gap-2" aria-label="Ordenar resultados">
              {ORDENES.map((o) => (
                <Link
                  key={o.valor}
                  href={enlaceCon({ orden: o.valor === "recientes" ? undefined : o.valor })}
                  className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
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
              {nf.format(conjuntos.length)} {conjuntos.length === 1 ? "conjunto" : "conjuntos"}
              {activos > 0 ? ` · ${activos} ${activos === 1 ? "filtro activo" : "filtros activos"}` : ""}
            </p>

            {conjuntos.length === 0 ? (
              <p className="rounded-lg bg-system-100 p-4 text-sm text-system-600">
                {total === 0
                  ? "Todavía no hay conjuntos de datos publicados: aparecerán aquí en cuanto una campaña se finalice."
                  : "Ningún conjunto coincide con estos filtros. Prueba quitando alguno o buscando por otro término."}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {conjuntos.map((c, i) => (
                  <Link key={c.id} href={`/datos/${c.id}`} {...entradaDeTarjeta(i)}>
                    <Card className="landing-tarjeta hover:border-brand-600">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-bold text-system-900">{c.name}</p>
                          {c.verified && <Tag tone="ok">Verificado</Tag>}
                        </div>
                        <Tag tone="ok">{nf.format(c.approvedContributions)} aportes</Tag>
                      </div>
                      <p className="mt-1 text-[12.5px] text-system-600">
                        {c.organizer} ·{" "}
                        {c.closedAt
                          ? `cerró el ${new Date(c.closedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`
                          : "sin fecha de cierre"}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <Tag>{c.tematica || "Sin temática"}</Tag>
                        {c.formats.length > 0
                          ? c.formats.map((f) => <Tag key={f}>{f}</Tag>)
                          : c.dataTypes.map((dt) => <Tag key={dt}>{DATA_TYPE_LABELS[dt] ?? dt}</Tag>)}
                      </div>
                      <p className="mt-2.5 font-mono text-[11px] text-system-500">
                        {c.sizeLabel} · {nf.format(c.downloads)} descargas
                        {c.quality != null ? ` · calidad ${c.quality.toFixed(1)}` : ""}
                        {(c.locationCity || c.locationState || c.todoElPais) &&
                          ` · ${textoDeUbicacion({ todoElPais: c.todoElPais, municipio: c.locationCity, estado: c.locationState })}`}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
