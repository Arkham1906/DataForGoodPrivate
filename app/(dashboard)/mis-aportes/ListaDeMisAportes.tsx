"use client";

// Listado global de los aportes del usuario común, sin agruparlos por campaña. Lo monta ./page.tsx, que le pasa en
// `resumen` el bloque «Cómo calificaron tus aportes» (2026-11-12), armado en el servidor.

import { ListadoDeAportes, SelectorDeVistaAportes, useVistaDeAportes } from "@/components/aportes/ListadoDeAportes";
import { useEffect, useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import SelectorDeOrden from "@/components/ui/SelectorDeOrden";
import ButtonLink from "@/components/ui/ButtonLink";
import { EsqueletoDeFiltros, EsqueletoDeFilas, EsqueletoDeTarjetas } from "@/components/ui/Esqueletos";
import { BASE_PATH } from "@/lib/base-path";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import type { Contribution, DataType } from "@/types";

const TIPOS: { value: DataType; label: string }[] = [
  { value: "texto", label: "Texto" }, { value: "foto", label: "Foto" }, { value: "video", label: "Video" },
  { value: "audio", label: "Audio" }, { value: "documento", label: "Archivo" },
];
const ESTADOS = [
  { value: "aceptado", label: "Aceptados" }, { value: "pendiente", label: "En revisión" }, { value: "rechazado", label: "Rechazados" },
];
const ORDENES = [
  { value: "recientes", label: "Más recientes" }, { value: "antiguos", label: "Más antiguos" },
];
function fechaDelDia(valor: string): { inicio: number; fin: number } | null {
  if (!valor) return null;
  return {
    inicio: new Date(`${valor}T00:00:00`).getTime(),
    fin: new Date(`${valor}T23:59:59.999`).getTime(),
  };
}

type CamposDeFiltrosProps = {
  tipo: string; campanaId: string; tematica: string; estado: string; fecha: string; orden: string;
  campanas: [string, string][]; tematicas: string[];
  onTipo: (value: string) => void; onCampana: (value: string) => void; onTematica: (value: string) => void;
  onEstado: (value: string) => void; onFecha: (value: string) => void; onOrden: (value: string) => void;
};

function CamposDeFiltros({
  tipo, campanaId, tematica, estado, fecha, orden, campanas, tematicas,
  onTipo, onCampana, onTematica, onEstado, onFecha, onOrden,
}: CamposDeFiltrosProps) {
  const clase = "min-h-[38px] w-full rounded border border-system-300 bg-white px-3 text-sm text-system-900 outline-none transition-colors focus:border-brand-600";
  return <>
    <label className="min-w-0 flex-1"><span className="sr-only">Tipo de dato</span><select aria-label="Tipo de dato" value={tipo} onChange={(event) => onTipo(event.target.value)} className={clase}><option value="">Tipo de dato: todos</option>{TIPOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="min-w-0 flex-1"><span className="sr-only">Campaña participada</span><select aria-label="Campaña participada" value={campanaId} onChange={(event) => onCampana(event.target.value)} className={clase}><option value="">Campaña: todas</option>{campanas.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label>
    <label className="min-w-0 flex-1"><span className="sr-only">Temática</span><select aria-label="Temática" value={tematica} onChange={(event) => onTematica(event.target.value)} className={clase}><option value="">Temática: todas</option>{tematicas.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    <label className="min-w-0 flex-1"><span className="sr-only">Estado</span><select aria-label="Estado" value={estado} onChange={(event) => onEstado(event.target.value)} className={clase}><option value="">Estado: todos</option>{ESTADOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="min-w-0 flex-1"><span className="sr-only">Fecha</span><input aria-label="Fecha" type="date" value={fecha} onChange={(event) => onFecha(event.target.value)} className={clase} /></label>
    <SelectorDeOrden valor={orden} onCambiar={onOrden} opciones={ORDENES} />
  </>;
}

export default function ListaDeMisAportes({ resumen }: { resumen?: ReactNode }) {
  const [items, setItems] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tipo, setTipo] = useState("");
  const [campanaId, setCampanaId] = useState("");
  const [tematica, setTematica] = useState("");
  const [estado, setEstado] = useState("");
  const [fecha, setFecha] = useState("");
  const [orden, setOrden] = useState("recientes");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const vistaCuadricula = useVistaDeAportes();
  const recarga = useRecargaEnVivo();

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const response = await fetch(`${BASE_PATH}/api/aportes?mine=true`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar tus aportes");
        if (activo) setItems(Array.isArray(payload.data) ? payload.data as Contribution[] : []);
      } catch (cause) {
        if (activo) setError(cause instanceof Error ? cause.message : "No se pudieron cargar tus aportes");
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => { activo = false; };
  }, [recarga]);

  const tematicas = Array.from(new Set(items.map((item) => item.campaignTematica).filter((tema): tema is string => Boolean(tema)))).sort((a, b) => a.localeCompare(b, "es"));
  const campanas = Array.from(new Map(items.map((item) => [item.campaignId, item.campaignName])).entries()).sort((a, b) => a[1].localeCompare(b[1], "es"));
  const filtrados = items.filter((item) => {
    const enviadoEn = new Date(item.submittedAt).getTime();
    const dia = fechaDelDia(fecha);
    const estadoCoincide = !estado || item.status === estado || (estado === "pendiente" && item.status === "espera_final");
    return (!tipo || item.fileType === tipo) && (!campanaId || item.campaignId === campanaId) && (!tematica || item.campaignTematica === tematica) && estadoCoincide && (!dia || (enviadoEn >= dia.inicio && enviadoEn <= dia.fin));
  }).sort((a, b) => orden === "antiguos" ? new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime() : new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const hayFiltros = Boolean(tipo || campanaId || tematica || estado || fecha || orden !== "recientes");

  function limpiarFiltros() {
    setTipo(""); setCampanaId(""); setTematica(""); setEstado(""); setFecha(""); setOrden("recientes");
  }

  const propsDeFiltros = { tipo, campanaId, tematica, estado, fecha, orden, campanas, tematicas, onTipo: setTipo, onCampana: setCampanaId, onTematica: setTematica, onEstado: setEstado, onFecha: setFecha, onOrden: setOrden };


  return <div>
    <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
      <div><h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl">Mis aportes</h1><p className="mt-1 text-[13px] text-system-600">Todos tus aportes en un solo listado, con filtros por tipo, fecha y temática.</p></div>
      <ButtonLink href="/campanas" variant="primary" size="sm" className="whitespace-nowrap max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px]">Explorar campañas</ButtonLink>
    </div>

    {resumen && <div className="mb-6 max-md:mb-4">{resumen}</div>}

    <h2 className="mb-4 mt-8 text-lg font-extrabold text-system-900 max-md:mt-6">Aportes</h2>

    {error ? <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p> : cargando ? (
      // Esqueleto de filtros y aportes, en la vista elegida (2026-11-13, a pedido del usuario: el 2026-10-31 se había
      // cambiado por el texto "Cargando tus aportes…"). Sin texto, tampoco para el lector de pantalla (decisión del
      // usuario el mismo día, a diferencia de los demás esqueletos): es solo decorativo.
      <div aria-hidden="true">
        <EsqueletoDeFiltros cantidad={4} />
        {vistaCuadricula ? <EsqueletoDeTarjetas cantidad={4} columnas={2} /> : <EsqueletoDeFilas cantidad={5} />}
      </div>
    ) :items.length === 0 ? <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">Todavía no has enviado aportes. Explora una campaña para empezar a participar.</p> : <>
      <div className="mb-3 hidden lg:flex">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5"><CamposDeFiltros {...propsDeFiltros} /></div>
          {hayFiltros && <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[12px] text-system-500">{filtrados.length} de {items.length} aportes</p><Button size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button></div>}
        </div>
      </div>

      <div className="mb-5 flex gap-2 lg:hidden"><Button type="button" size="sm" onClick={() => setFiltrosAbiertos(true)} aria-haspopup="dialog" aria-expanded={filtrosAbiertos}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" /></svg>Filtros{hayFiltros ? ` (${filtrados.length})` : ""}</Button></div>

      <div className="mb-4 flex justify-end">
        <SelectorDeVistaAportes />
      </div>

      {filtrosAbiertos && <div className="fixed inset-0 z-50 flex items-end bg-system-900/40 p-3 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="titulo-filtros"><div className="max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-4 shadow-xl"><div className="mb-4 flex items-center justify-between gap-3"><h2 id="titulo-filtros" className="text-base font-extrabold text-system-900">Filtrar mis aportes</h2><button type="button" onClick={() => setFiltrosAbiertos(false)} className="rounded-full p-2 text-xl leading-none text-system-600 hover:bg-system-100" aria-label="Cerrar filtros">×</button></div><div className="flex flex-col gap-2.5"><CamposDeFiltros {...propsDeFiltros} /></div><div className="mt-5 flex items-center justify-between gap-3 border-t border-system-200 pt-4"><p className="text-[12px] text-system-500">{hayFiltros ? `${filtrados.length} de ${items.length} aportes` : "Sin filtros"}</p><div className="flex gap-2"><Button size="sm" onClick={limpiarFiltros}>Limpiar</Button><Button variant="primary" size="sm" onClick={() => setFiltrosAbiertos(false)}>Aplicar</Button></div></div></div></div>}

      {filtrados.length === 0 ? <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">No hay aportes que coincidan con los filtros.</p> : <ListadoDeAportes items={filtrados} />}
    </>}
  </div>;
}
