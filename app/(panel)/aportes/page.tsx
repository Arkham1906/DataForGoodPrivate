// Pantalla /aportes (SCR-WEB-14): bandeja de aportes de toda la plataforma vista por el SuperUsuario.
// Acceso: sesión raíz (layout de (panel) + exigirSesionRoot()). Server Component.
// Datos: lib/aportes/bandeja.ts; filtros en filtros.tsx (?q=, ?campana=, ?etapa=, ?pagina=).
// Solo consulta: origen y etapa de cada aporte, sin abrir el archivo ni la descripción completa.
// Agrupada por persona (2026-10-08): la lista desplegable está en lista.tsx (cliente).

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import Subtabs from "@/components/sistema/subtabs";
import { Aviso, Encabezado, Paginacion, formatearNumero } from "@/components/sistema/ui";
import {
  FILTROS_DE_ETAPA,
  PESTANAS_APORTES,
  POR_PAGINA,
  buscarAportesPorParticipante,
  campanaTieneRevisor,
  contarPorEtapa,
  esFiltroDeEtapa,
  listarCampanasConAportes,
  type FiltroDeEtapa,
} from "@/lib/aportes/bandeja";
import { exigirSesionRoot } from "@/lib/supervision/root";
import FiltrosDeAportes from "./filtros";
import ListaDeAportes from "./lista";

export const metadata: Metadata = { title: "Bandeja de aportes" };
export const dynamic = "force-dynamic";

type Busqueda = { q?: string; campana?: string; etapa?: string; pagina?: string };

const BASE = "/aportes";

export default async function BandejaDeAportesPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await exigirSesionRoot();
  const sp = await searchParams;
  const etapa = esFiltroDeEtapa(sp.etapa);
  const pagina = Math.max(1, Number(sp.pagina ?? 1) || 1);
  const filtros = { q: sp.q, campanaId: sp.campana, etapa, pagina };

  const [conteos, { grupos, totalDeGrupos: total }, campanas] = await Promise.all([
    contarPorEtapa(filtros),
    buscarAportesPorParticipante(filtros),
    listarCampanasConAportes(),
  ]);

  const campana = campanas.find((c) => c.id === sp.campana);
  const conRevisor = campana ? await campanaTieneRevisor(campana.id) : null;

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, total);

  /** Enlace con los filtros actuales, cambiando solo lo indicado. */
  function enlace(cambios: { etapa?: FiltroDeEtapa | null; pagina?: number }) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "pagina" && k !== "etapa") params.set(k, v);
    }
    const e = cambios.etapa === undefined ? etapa : cambios.etapa;
    if (e) params.set("etapa", e);
    if (cambios.pagina && cambios.pagina > 1) params.set("pagina", String(cambios.pagina));
    const qs = params.toString();
    return qs ? `${BASE}?${qs}` : BASE;
  }

  const claseChip = (activo: boolean) =>
    `inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px] ${
      activo ? "border-brand-600 bg-brand-600 text-white" : "border-system-300 bg-white text-system-600 hover:border-brand-600"
    }`;

  return (
    <div>
      <Subtabs pestanas={PESTANAS_APORTES} etiquetaAria="Secciones de aportes" distribuidasEnMovil />

      <Encabezado
        titulo="Aportes recibidos"
        subtitulo={campana ? campana.nombre : "Todas las campañas"}
      />

      <nav
        className="dashboard-nav mb-3 w-full min-w-0 max-w-full touch-pan-x flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] md:flex-wrap md:overflow-visible md:pb-0"
        aria-label="Filtrar por etapa"
      >
        <Link href={enlace({ etapa: null })} scroll={false} className={claseChip(!etapa)} aria-current={!etapa ? "true" : undefined}>
          Todos&nbsp; <span className="font-mono text-[11px]">{formatearNumero(conteos.todos)}</span>
        </Link>
        {FILTROS_DE_ETAPA.map((f) => (
          <Link
            key={f.valor}
            href={enlace({ etapa: f.valor })}
            scroll={false}
            className={claseChip(etapa === f.valor)}
            aria-current={etapa === f.valor ? "true" : undefined}
          >
            {f.etiqueta}&nbsp; <span className="font-mono text-[11px]">{formatearNumero(conteos[f.valor])}</span>
          </Link>
        ))}
      </nav>

      <Suspense fallback={null}>
        <FiltrosDeAportes q={sp.q ?? ""} campana={campana?.id ?? ""} campanas={campanas} />
      </Suspense>

      {conRevisor === true ? (
        <Aviso tono="info" className="mb-4">
          Esta campaña tiene revisor de aportes: los marcados como &quot;Espera final&quot; ya pasaron la primera
          instancia y esperan la decisión del creador.
        </Aviso>
      ) : conRevisor === false ? (
        <Aviso tono="aviso" className="mb-4">
          Esta campaña no tiene revisor de aportes: los envíos llegan al creador sin filtro previo. Asignar uno le toca
          al creador de la campaña.
        </Aviso>
      ) : null}

      {grupos.length === 0 ? (
        <p className="py-7 text-[13px] text-system-600">
          Ningún aporte coincide con estos filtros. Prueba quitando alguno o buscando por otro término.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[12.5px] text-system-600">
            {formatearNumero(total)} {total === 1 ? "participante" : "participantes"}: haz clic en uno para ver sus aportes.
          </p>
          <ListaDeAportes grupos={grupos} />

          <Paginacion desde={desde} hasta={hasta} total={total} pagina={pagina} paginas={paginas} href={(p) => enlace({ pagina: p })} />
        </>
      )}

      <Aviso className="mt-5">
        El SuperUsuario ve el registro de lo que llega, no el contenido enviado. La foto y la descripción completa solo las
        ven el creador de la campaña y su revisor de aportes.
      </Aviso>
    </div>
  );
}
