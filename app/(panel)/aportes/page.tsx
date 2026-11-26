// Pantalla /aportes (SCR-WEB-14): bandeja de aportes de toda la plataforma vista por el SuperUsuario.
// Acceso: sesión raíz (layout de (panel) + exigirSesionRoot()). Server Component.
// Datos: lib/aportes/bandeja.ts. Filtros en la URL (?q=, ?campana=, ?etapa=, ?pagina=).
// Solo consulta: origen y etapa de cada aporte, sin abrir el archivo ni la descripción completa.
// Agrupada por persona (2026-10-08): la lista desplegable está en lista.tsx (cliente).
// "Volver a la campaña" (2026-11-23) solo si se llegó desde la ficha de una campaña (components/sistema/Volver).

import type { Metadata } from "next";

import Subtabs from "@/components/sistema/subtabs";
import { Aviso, Encabezado, Paginacion, Volver, formatearNumero } from "@/components/sistema/ui";
import {
  FILTROS_DE_ETAPA,
  PESTANAS_APORTES,
  POR_PAGINA,
  buscarAportesPorParticipante,
  campanaTieneRevisor,
  esFiltroDeEtapa,
  listarCampanasConAportes,
} from "@/lib/aportes/bandeja";
import { exigirSesionRoot } from "@/lib/supervision/root";
import FiltrosEnLaUrl from "@/components/sistema/FiltrosEnLaUrl";
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

  const [{ grupos, totalDeGrupos: total }, campanas] = await Promise.all([
    buscarAportesPorParticipante(filtros),
    listarCampanasConAportes(),
  ]);

  const campana = campanas.find((c) => c.id === sp.campana);
  const conRevisor = campana ? await campanaTieneRevisor(campana.id) : null;

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, total);

  function enlaceDePagina(numero: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "pagina" && k !== "etapa") params.set(k, v);
    }
    if (etapa) params.set("etapa", etapa);
    if (numero > 1) params.set("pagina", String(numero));
    const qs = params.toString();
    return qs ? `${BASE}?${qs}` : BASE;
  }

  return (
    <div>
      {/* 2026-11-23: abierta desde "Ver aportes recibidos" de una campaña, regresa a ella. Desde el menú no sale. */}
      <Volver href={campana ? `/sistema/campanas/${campana.id}` : "/sistema/campanas"} soloSiVieneDe={"^/sistema/campanas/\\d+$"}>
        Volver a la campaña
      </Volver>
      <Subtabs pestanas={PESTANAS_APORTES} etiquetaAria="Secciones de aportes" distribuidasEnMovil />

      <Encabezado
        titulo="Aportes recibidos"
        descripcion="Los aportes de toda la plataforma agrupados por persona, con su campaña y su etapa de revisión. Solo ves el registro, no el archivo."
        subtitulo={campana ? campana.nombre : "Todas las campañas"}
      />

      <FiltrosEnLaUrl
        tituloPanelMovil="Filtros de aportes"
        busqueda={{ etiqueta: "Buscar aportes", placeholder: "Buscar por participante o campaña" }}
        listas={[
          { clave: "etapa", etiqueta: "Filtrar por estado", todas: "Estado: todos", opciones: FILTROS_DE_ETAPA },
          { clave: "campana", etiqueta: "Filtrar por campaña", todas: "Campaña: todas", opciones: campanas.map((c) => ({ valor: c.id, etiqueta: c.nombre })) },
        ]}
      />

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

          <Paginacion desde={desde} hasta={hasta} total={total} pagina={pagina} paginas={paginas} href={enlaceDePagina} />
        </>
      )}

      <Aviso className="mt-5">
        El SuperUsuario ve el registro de lo que llega, no el contenido enviado. La foto y la descripción completa solo las
        ven el creador de la campaña y su revisor de aportes.
      </Aviso>
    </div>
  );
}
