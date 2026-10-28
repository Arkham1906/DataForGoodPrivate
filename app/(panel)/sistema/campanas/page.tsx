// Pantalla /sistema/campanas: listado de todas las campañas con filtros, orden y paginación (en SQL).
// Server Component. Datos: lib/campanas/sistema.ts (exige sesión raíz). Filtros en filtros.tsx.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import Subtabs from "@/components/sistema/subtabs";
import Tag from "@/components/sistema/Tag";
import { Encabezado, EnlaceBoton, Paginacion, formatearNumero } from "@/components/sistema/ui";
import {
  ETIQUETA_DE_CAMPANA,
  NOMBRE_DE_TIPO,
  ESTADOS_DEL_LISTADO,
  PESTANAS_CAMPANAS,
  POR_PAGINA,
  buscarCampanas,
  contarPorEstado,
  diasRestantes,
  esEstado,
  esTipo,
  formatearFechaCampana,
  listarEtiquetasPorTematica,
  listarTematicas,
  type EstadoDeCampana,
} from "@/lib/campanas/sistema";
import FiltrosDeCampanas from "./filtros";

export const metadata: Metadata = { title: "Listado de campañas" };
export const dynamic = "force-dynamic";

type Busqueda = {
  q?: string;
  estado?: string;
  tematica?: string;
  etiqueta?: string;
  tipo?: string;
  vigencia?: string;
  orden?: string;
  pagina?: string;
};

const BASE = "/sistema/campanas";

export default async function ListadoDeCampanasPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const sp = await searchParams;
  // Un ?estado=borrador escrito a mano se ignora: el listado no muestra borradores.
  const estado = ESTADOS_DEL_LISTADO.find((e) => e === esEstado(sp.estado));
  const pagina = Math.max(1, Number(sp.pagina ?? 1) || 1);

  const [conteos, { filas, total }, tematicas, etiquetasPorTematica] = await Promise.all([
    contarPorEstado(),
    buscarCampanas({
      q: sp.q,
      estado,
      tematica: sp.tematica,
      etiqueta: sp.etiqueta,
      tipo: esTipo(sp.tipo),
      vigencia: sp.vigencia,
      orden: sp.orden,
      pagina,
    }),
    listarTematicas(),
    listarEtiquetasPorTematica(),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, total);

  /** Enlace con los filtros actuales, cambiando solo lo indicado. */
  function enlace(cambios: { estado?: EstadoDeCampana | null; pagina?: number }) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "pagina" && k !== "estado") params.set(k, v);
    }
    const e = cambios.estado === undefined ? estado : cambios.estado;
    if (e) params.set("estado", e);
    if (cambios.pagina && cambios.pagina > 1) params.set("pagina", String(cambios.pagina));
    const qs = params.toString();
    return qs ? `${BASE}?${qs}` : BASE;
  }

  const subtitulo = `${formatearNumero(conteos.todas)} registradas`;

  const claseChip = (activo: boolean) =>
    `inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${
      activo ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
    }`;

  return (
    <div>
      <Subtabs
        pestanas={PESTANAS_CAMPANAS}
        etiquetaAria="Secciones de campañas"
        distribuidasEnMovil
      />

      <Encabezado
        titulo="Campañas"
        subtitulo={subtitulo}
        acciones={<EnlaceBoton href={`${BASE}/dashboard`}>Ver dashboard</EnlaceBoton>}
      />

      <nav
        className="dashboard-nav mb-3 w-full min-w-0 max-w-full touch-pan-x flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
        aria-label="Filtrar por estado"
      >
        <Link href={enlace({ estado: null })} scroll={false} className={claseChip(!estado)} aria-current={!estado ? "true" : undefined}>
          Todas&nbsp; <span className="font-mono text-[11px]">{formatearNumero(conteos.todas)}</span>
        </Link>
        {ESTADOS_DEL_LISTADO.map((e) => (
          <Link
            key={e}
            href={enlace({ estado: e })}
            scroll={false}
            className={claseChip(estado === e)}
            aria-current={estado === e ? "true" : undefined}
          >
            {ETIQUETA_DE_CAMPANA[e].texto}&nbsp; <span className="font-mono text-[11px]">{formatearNumero(conteos[e])}</span>
          </Link>
        ))}
      </nav>

      <Suspense fallback={null}>
        <FiltrosDeCampanas
          q={sp.q ?? ""}
          tematica={sp.tematica ?? ""}
          etiqueta={sp.etiqueta ?? ""}
          tipo={sp.tipo ?? ""}
          vigencia={sp.vigencia ?? ""}
          orden={sp.orden ?? ""}
          tematicas={tematicas}
          etiquetasPorTematica={etiquetasPorTematica}
        />
      </Suspense>

      {filas.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">
          Ninguna campaña coincide con estos filtros. Prueba quitando alguno o buscando por otro término.
        </p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filas.map((c) => {
              const et = ETIQUETA_DE_CAMPANA[c.estado];
              const dias = diasRestantes(c.venceEn);
              return (
                <article key={c.id} className="rounded-lg border border-system-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-[14px] font-bold leading-snug text-system-900">
                        {c.nombre}
                      </p>
                      <p className="mt-1 break-words text-[11px] leading-snug text-system-500">
                        {c.tematica || "Sin temática"} · {c.creador || "Sin creador"}
                      </p>
                    </div>
                    <Tag tone={et.tono}>{et.texto}</Tag>
                  </div>

                  <div className="mt-3 border-t border-system-200 pt-3">
                    <p className="text-[11px] text-system-600">Tipo de dato</p>
                    <p className="mt-1 break-words text-[13px] leading-relaxed text-system-900">
                      {c.tiposDeDato.length > 0
                        ? c.tiposDeDato.map((t) => NOMBRE_DE_TIPO[t]).join(" · ")
                        : "—"}
                    </p>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[11px] text-system-600">Participantes</dt>
                      <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-system-900">
                        {formatearNumero(c.participantes)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-system-600">Aprobados / meta</dt>
                      <dd className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-system-900">
                        {formatearNumero(c.aprobados)}/{formatearNumero(c.meta)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[11px] text-system-600">Vence</dt>
                      <dd className="mt-0.5 text-[12px] text-system-900">
                        {c.venceEn ? (
                          <span title={dias !== null ? `Faltan ${dias} días` : undefined}>
                            {formatearFechaCampana(c.venceEn, false)}
                          </span>
                        ) : (
                          "Sin fecha"
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 grid">
                    <EnlaceBoton href={`${BASE}/${c.id}`}>
                      Ver campaña<span className="sr-only"> {c.nombre}</span>
                    </EnlaceBoton>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-system-200 bg-white p-5 shadow-sm md:block">
            <table className="w-full min-w-[820px] text-left text-[13.5px]">
              <thead className="border-b border-system-200 font-mono text-[10px] uppercase tracking-[0.1em] text-system-500">
                <tr>
                  <th className="pb-3 font-medium">Campaña</th>
                  <th className="pb-3 font-medium">Tipo de dato</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 text-right font-medium">Participan</th>
                  <th className="pb-3 text-right font-medium">Aprobados</th>
                  <th className="pb-3 pl-4 font-medium">Vence</th>
                  <th className="pb-3 text-right font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => {
                  const et = ETIQUETA_DE_CAMPANA[c.estado];
                  const dias = diasRestantes(c.venceEn);
                  return (
                    <tr key={c.id} className="border-b border-system-200 last:border-0">
                      <td className="py-4 pr-3">
                        <p className="font-bold text-system-900">{c.nombre}</p>
                        <p className="text-[12px] text-system-500">
                          {c.tematica || "Sin temática"} · {c.creador || "Sin creador"}
                        </p>
                      </td>
                      <td className="text-[12.5px] text-system-600">
                        {c.tiposDeDato.length > 0 ? c.tiposDeDato.map((t) => NOMBRE_DE_TIPO[t]).join(" · ") : "—"}
                      </td>
                      <td>
                        <Tag tone={et.tono}>{et.texto}</Tag>
                      </td>
                      <td className="text-right font-mono tabular-nums">{formatearNumero(c.participantes)}</td>
                      <td className="text-right font-mono tabular-nums">
                        {formatearNumero(c.aprobados)}
                        <span className="text-system-500">/{formatearNumero(c.meta)}</span>
                      </td>
                      <td className="pl-4 font-mono text-[12px] text-system-600">
                        {c.venceEn ? (
                          <span title={dias !== null ? `Faltan ${dias} días` : undefined}>{formatearFechaCampana(c.venceEn, false)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-right">
                        <EnlaceBoton href={`${BASE}/${c.id}`}>
                          Ver<span className="sr-only"> el panel de {c.nombre}</span>
                        </EnlaceBoton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Paginacion desde={desde} hasta={hasta} total={total} pagina={pagina} paginas={paginas} href={(p) => enlace({ pagina: p })} />
        </>
      )}
    </div>
  );
}
