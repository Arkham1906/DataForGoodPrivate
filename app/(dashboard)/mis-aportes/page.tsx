"use client";

// Listado global de los aportes del usuario común, sin agruparlos por campaña.

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Tag from "@/components/ui/Tag";
import { BASE_PATH } from "@/lib/base-path";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";
import type { Contribution, DataType } from "@/types";

const TIPOS: { value: DataType; label: string }[] = [
  { value: "texto", label: "Texto" }, { value: "foto", label: "Foto" }, { value: "video", label: "Video" },
  { value: "audio", label: "Audio" }, { value: "documento", label: "Documento" },
];
const ESTADOS = [
  { value: "aceptado", label: "Aceptados" }, { value: "pendiente", label: "En revisión" }, { value: "rechazado", label: "Rechazados" },
];
const CLAVE_VISTA_MIS_APORTES = "dfg:mis-aportes:vista";
const EVENTO_VISTA_MIS_APORTES = "dfg:mis-aportes:vista-cambio";
let vistaMisAportesEnMemoria = false;

function leerVistaDeMisAportes(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_VISTA_MIS_APORTES) === "cuadricula";
  } catch {
    return vistaMisAportesEnMemoria;
  }
}

function suscribirVistaDeMisAportes(alCambiar: () => void): () => void {
  const alCambiarVista = () => alCambiar();
  window.addEventListener("storage", alCambiarVista);
  window.addEventListener(EVENTO_VISTA_MIS_APORTES, alCambiarVista);
  return () => {
    window.removeEventListener("storage", alCambiarVista);
    window.removeEventListener(EVENTO_VISTA_MIS_APORTES, alCambiarVista);
  };
}

function guardarVistaDeMisAportes(vistaCuadricula: boolean): void {
  vistaMisAportesEnMemoria = vistaCuadricula;
  try {
    window.localStorage.setItem(CLAVE_VISTA_MIS_APORTES, vistaCuadricula ? "cuadricula" : "lista");
  } catch {
    // Si el navegador bloquea el almacenamiento, la selección dura mientras la página siga abierta.
  }
  window.dispatchEvent(new Event(EVENTO_VISTA_MIS_APORTES));
}

function fechaDelDia(valor: string): { inicio: number; fin: number } | null {
  if (!valor) return null;
  return {
    inicio: new Date(`${valor}T00:00:00`).getTime(),
    fin: new Date(`${valor}T23:59:59.999`).getTime(),
  };
}

type CamposDeFiltrosProps = {
  tipo: string; campanaId: string; tematica: string; estado: string; fecha: string;
  campanas: [string, string][]; tematicas: string[];
  onTipo: (value: string) => void; onCampana: (value: string) => void; onTematica: (value: string) => void;
  onEstado: (value: string) => void; onFecha: (value: string) => void;
};

function CamposDeFiltros({
  tipo, campanaId, tematica, estado, fecha, campanas, tematicas,
  onTipo, onCampana, onTematica, onEstado, onFecha,
}: CamposDeFiltrosProps) {
  const clase = "mt-1 block w-full rounded border border-system-300 bg-white px-2.5 py-2 text-[12px] font-normal text-system-900";
  return <>
    <label className="text-[12px] font-semibold text-system-700">Tipo de dato<select value={tipo} onChange={(event) => onTipo(event.target.value)} className={clase}><option value="">Todos</option>{TIPOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="text-[12px] font-semibold text-system-700">Campaña participada<select value={campanaId} onChange={(event) => onCampana(event.target.value)} className={clase}><option value="">Todas</option>{campanas.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label>
    <label className="text-[12px] font-semibold text-system-700">Temática<select value={tematica} onChange={(event) => onTematica(event.target.value)} className={clase}><option value="">Todas</option>{tematicas.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    <label className="text-[12px] font-semibold text-system-700">Estado<select value={estado} onChange={(event) => onEstado(event.target.value)} className={clase}><option value="">Todos</option>{ESTADOS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="text-[12px] font-semibold text-system-700">Fecha<input type="date" value={fecha} onChange={(event) => onFecha(event.target.value)} className={clase} /></label>
  </>;
}

export default function MisAportesPage() {
  const [items, setItems] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tipo, setTipo] = useState("");
  const [campanaId, setCampanaId] = useState("");
  const [tematica, setTematica] = useState("");
  const [estado, setEstado] = useState("");
  const [fecha, setFecha] = useState("");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const vistaCuadricula = useSyncExternalStore(suscribirVistaDeMisAportes, leerVistaDeMisAportes, () => false);
  const recarga = useRecargaEnVivo();
  const router = useRouter();

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
  });
  const hayFiltros = Boolean(tipo || campanaId || tematica || estado || fecha);

  function limpiarFiltros() {
    setTipo(""); setCampanaId(""); setTematica(""); setEstado(""); setFecha("");
  }

  const propsDeFiltros = { tipo, campanaId, tematica, estado, fecha, campanas, tematicas, onTipo: setTipo, onCampana: setCampanaId, onTematica: setTematica, onEstado: setEstado, onFecha: setFecha };

  return <div>
    <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
      <div><h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl">Mis aportes</h1><p className="mt-1 text-[13px] text-system-600">Todos tus aportes en un solo listado, con filtros por tipo, fecha y temática.</p></div>
      <ButtonLink href="/campanas" variant="primary" size="sm" className="whitespace-nowrap max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px]">Explorar campañas</ButtonLink>
    </div>

    {error ? <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p> : cargando ? <p className="rounded-lg border border-system-200 bg-white p-6 text-sm text-system-600" role="status">Cargando tus aportes…</p> : items.length === 0 ? <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">Todavía no has enviado aportes. Explora una campaña para empezar a participar.</p> : <>
      <div className="mb-5 hidden items-end gap-3 lg:flex">
        <div className="min-w-0 flex-1 rounded-lg border border-system-200 bg-white p-3">
          <div className="grid grid-cols-5 items-end gap-2"><CamposDeFiltros {...propsDeFiltros} /></div>
          {hayFiltros && <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[12px] text-system-500">{filtrados.length} de {items.length} aportes</p><Button size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button></div>}
        </div>
        <Button type="button" size="sm" className="!size-10 !rounded-lg !p-0" onClick={() => guardarVistaDeMisAportes(!vistaCuadricula)} aria-label={vistaCuadricula ? "Cambiar a vista de lista" : "Cambiar a vista cuadriculada"} title={vistaCuadricula ? "Vista de lista" : "Vista cuadriculada"}>
          {vistaCuadricula ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>}
        </Button>
      </div>

      <div className="mb-5 flex gap-2 lg:hidden"><Button type="button" size="sm" onClick={() => setFiltrosAbiertos(true)} aria-haspopup="dialog" aria-expanded={filtrosAbiertos}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" /></svg>Filtros{hayFiltros ? ` (${filtrados.length})` : ""}</Button><Button type="button" size="sm" className="!size-10 !rounded-lg !p-0" onClick={() => guardarVistaDeMisAportes(!vistaCuadricula)} aria-label={vistaCuadricula ? "Cambiar a vista de lista" : "Cambiar a vista cuadriculada"} title={vistaCuadricula ? "Vista de lista" : "Vista cuadriculada"}>{vistaCuadricula ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>}</Button></div>

      {filtrosAbiertos && <div className="fixed inset-0 z-50 flex items-end bg-system-900/40 p-3 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="titulo-filtros"><div className="max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-4 shadow-xl"><div className="mb-4 flex items-center justify-between gap-3"><h2 id="titulo-filtros" className="text-base font-extrabold text-system-900">Filtrar mis aportes</h2><button type="button" onClick={() => setFiltrosAbiertos(false)} className="rounded-full p-2 text-xl leading-none text-system-600 hover:bg-system-100" aria-label="Cerrar filtros">×</button></div><div className="grid gap-3 sm:grid-cols-2"><CamposDeFiltros {...propsDeFiltros} /></div><div className="mt-5 flex items-center justify-between gap-3 border-t border-system-200 pt-4"><p className="text-[12px] text-system-500">{hayFiltros ? `${filtrados.length} de ${items.length} aportes` : "Sin filtros"}</p><div className="flex gap-2"><Button size="sm" onClick={limpiarFiltros}>Limpiar</Button><Button variant="primary" size="sm" onClick={() => setFiltrosAbiertos(false)}>Aplicar</Button></div></div></div></div>}

      {filtrados.length === 0 ? <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">No hay aportes que coincidan con los filtros.</p> : <div className={vistaCuadricula ? "grid grid-cols-2 gap-2 sm:gap-3" : "flex flex-col gap-2 sm:gap-3"}>{filtrados.map((item) => <button key={item.id} type="button" onClick={() => router.push(`/mis-aportes/${item.campaignId}/${item.id}`)} className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><article className={vistaCuadricula ? "h-full rounded-lg border border-system-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600 max-md:p-3" : "h-full rounded-lg border border-system-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-600 max-md:p-2.5"}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-[15px] font-bold text-system-900">{item.campaignName}</h2><p className="mt-1 text-[12.5px] text-system-600">{item.campaignTematica || "Sin temática"}</p></div><Tag tone={item.status === "aceptado" ? "ok" : item.status === "rechazado" ? "danger" : "warn"}>{item.status === "aceptado" ? "Aceptado" : item.status === "rechazado" ? "Rechazado" : "En revisión"}</Tag></div><dl className="mt-3 grid grid-cols-2 gap-2 border-t border-system-200 pt-3 text-[12px]"><div><dt className="text-system-500">Tipo de dato</dt><dd className="mt-0.5 font-semibold capitalize text-system-900">{item.fileType}</dd></div><div><dt className="text-system-500">Fecha de envío</dt><dd className="mt-0.5 font-mono text-system-900">{new Date(item.submittedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</dd></div></dl></article></button>)}</div>}
    </>}
  </div>;
}
