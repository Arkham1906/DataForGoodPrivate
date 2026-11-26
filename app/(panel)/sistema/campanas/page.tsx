// Pantalla /sistema/campanas: listado de todas las campañas con filtros, orden y paginación (en SQL).
// Server Component. Datos: lib/campanas/sistema.ts (exige sesión raíz). Filtros en filtros.tsx.

import type { Metadata } from "next";
import { Suspense } from "react";

import Subtabs from "@/components/sistema/subtabs";
import Tag from "@/components/sistema/Tag";
import ListaDeCampanasDelPanel from "@/components/sistema/ListaDeCampanasDelPanel";
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
  formatearFechaCampana,
  listarEtiquetasPorTematica,
  listarTematicas,
} from "@/lib/campanas/sistema";
import { mensajeSinTiposDeDato, tiposDesde } from "@/lib/campanas/sistema-opciones";
import FiltrosDeCampanas from "./filtros";
import { exigirSesionRoot } from "@/lib/supervision/root";

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
  await exigirSesionRoot();
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
      tipos: tiposDesde(sp.tipo),
      vigencia: sp.vigencia,
      orden: sp.orden,
      pagina,
    }),
    listarTematicas(),
    listarEtiquetasPorTematica(),
  ]);

  // Sin resultados con un tipo de dato elegido: si sin ese filtro sí hay, el aviso dice que es por el tipo (2026-11-24).
  const porElTipo =
    total === 0 && tiposDesde(sp.tipo).length > 0
      ? (await buscarCampanas({ q: sp.q, estado, tematica: sp.tematica, etiqueta: sp.etiqueta, vigencia: sp.vigencia, orden: sp.orden, pagina: 1 })).total > 0
      : false;

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, total);

  function enlaceDePagina(numero: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "pagina" && k !== "estado") params.set(k, v);
    }
    if (estado) params.set("estado", estado);
    if (numero > 1) params.set("pagina", String(numero));
    const qs = params.toString();
    return qs ? `${BASE}?${qs}` : BASE;
  }

  const subtitulo = `${formatearNumero(conteos.todas)} registradas`;

  return (
    <div>
      <Subtabs
        pestanas={PESTANAS_CAMPANAS}
        etiquetaAria="Secciones de campañas"
        distribuidasEnMovil
      />

      <Encabezado
        titulo="Campañas"
        descripcion="Todas las campañas de la plataforma, en cualquier estado. Filtra, ordena y abre una para ver su ficha."
        subtitulo={subtitulo}
        acciones={<EnlaceBoton href={`${BASE}/dashboard`}>Ver dashboard</EnlaceBoton>}
      />

      <Suspense fallback={null}>
        <FiltrosDeCampanas
          estado={estado ?? ""}
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
          {porElTipo
            ? `${mensajeSinTiposDeDato(sp.tipo)} Prueba con otro tipo o quita ese filtro.`
            : "Ninguna campaña coincide con estos filtros. Prueba quitando alguno o buscando por otro término."}
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

          {/* Escritorio (2026-11-26, a pedido del usuario): las tarjetas de /supervisar, con vista de lista o cuadrícula;
              toda la tarjeta abre la campaña. Antes (2026-11-25) renglones como Mis aportes. */}
          <ListaDeCampanasDelPanel filas={filas} />

          <Paginacion desde={desde} hasta={hasta} total={total} pagina={pagina} paginas={paginas} href={enlaceDePagina} />
        </>
      )}
    </div>
  );
}
