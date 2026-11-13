"use client";

// Listado global de los aportes del usuario común, sin agruparlos por campaña. Lo monta ./page.tsx, que le pasa en
// `resumen` el bloque «Cómo calificaron tus aportes» (2026-11-12), armado en el servidor.

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Tag from "@/components/ui/Tag";
import { MiniaturaDeAporte } from "@/components/ui/ArchivoDelAporte";
import EstrellasDeCalificacion from "@/components/aportes/EstrellasDeCalificacion";
import { BASE_PATH } from "@/lib/base-path";
import { NOMBRE_DE_TIPO } from "@/lib/campanas/sistema-opciones";
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
    <label className="min-w-0 flex-1"><span className="sr-only">Ordenar por</span><select aria-label="Ordenar por" value={orden} onChange={(event) => onOrden(event.target.value)} className={clase}>{ORDENES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
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
  const vistaCuadricula = useSyncExternalStore(suscribirVistaDeMisAportes, leerVistaDeMisAportes, () => false);
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

  const botonCambiarVista = (
    <div role="group" aria-label="Cambiar vista de aportes" className="relative flex shrink-0 gap-0 overflow-hidden rounded-lg border border-system-300 bg-system-100 p-1">
      <span aria-hidden="true" className={`pointer-events-none absolute left-[3px] top-[3px] z-0 h-8 w-8 rounded-md bg-brand-600 shadow-inner transition-transform duration-200 ease-out motion-reduce:transition-none ${vistaCuadricula ? "translate-x-full" : "translate-x-0"}`} />
      <Button type="button" size="sm" className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${!vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`} onClick={() => guardarVistaDeMisAportes(false)} aria-label="Vista de lista" aria-pressed={!vistaCuadricula} title="Vista de lista">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Button>
      <Button type="button" size="sm" className={`!relative !z-10 !size-8 !rounded-md !border-transparent !bg-transparent !p-0 ${vistaCuadricula ? "!text-white" : "!text-system-600 hover:!bg-white"}`} onClick={() => guardarVistaDeMisAportes(true)} aria-label="Vista cuadriculada" aria-pressed={vistaCuadricula} title="Vista cuadriculada">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
      </Button>
    </div>
  );

  return <div>
    <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
      <div><h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl">Mis aportes</h1><p className="mt-1 text-[13px] text-system-600">Todos tus aportes en un solo listado, con filtros por tipo, fecha y temática.</p></div>
      <ButtonLink href="/campanas" variant="primary" size="sm" className="whitespace-nowrap max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px]">Explorar campañas</ButtonLink>
    </div>

    {resumen && <div className="mb-6 max-md:mb-4">{resumen}</div>}

    {error ? <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p> : cargando ? <p className="rounded-lg border border-system-200 bg-white p-6 text-sm text-system-600" role="status">Cargando tus aportes…</p> : items.length === 0 ? <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">Todavía no has enviado aportes. Explora una campaña para empezar a participar.</p> : <>
      <div className="mb-3 hidden lg:flex">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5"><CamposDeFiltros {...propsDeFiltros} /></div>
          {hayFiltros && <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[12px] text-system-500">{filtrados.length} de {items.length} aportes</p><Button size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button></div>}
        </div>
      </div>

      <div className="mb-5 flex gap-2 lg:hidden"><Button type="button" size="sm" onClick={() => setFiltrosAbiertos(true)} aria-haspopup="dialog" aria-expanded={filtrosAbiertos}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" /></svg>Filtros{hayFiltros ? ` (${filtrados.length})` : ""}</Button></div>

      <div className="mb-4 flex justify-end">
        {botonCambiarVista}
      </div>

      {filtrosAbiertos && <div className="fixed inset-0 z-50 flex items-end bg-system-900/40 p-3 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="titulo-filtros"><div className="max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-4 shadow-xl"><div className="mb-4 flex items-center justify-between gap-3"><h2 id="titulo-filtros" className="text-base font-extrabold text-system-900">Filtrar mis aportes</h2><button type="button" onClick={() => setFiltrosAbiertos(false)} className="rounded-full p-2 text-xl leading-none text-system-600 hover:bg-system-100" aria-label="Cerrar filtros">×</button></div><div className="flex flex-col gap-2.5"><CamposDeFiltros {...propsDeFiltros} /></div><div className="mt-5 flex items-center justify-between gap-3 border-t border-system-200 pt-4"><p className="text-[12px] text-system-500">{hayFiltros ? `${filtrados.length} de ${items.length} aportes` : "Sin filtros"}</p><div className="flex gap-2"><Button size="sm" onClick={limpiarFiltros}>Limpiar</Button><Button variant="primary" size="sm" onClick={() => setFiltrosAbiertos(false)}>Aplicar</Button></div></div></div></div>}

      {filtrados.length === 0 ? <p className="rounded-lg border border-dashed border-system-300 p-6 text-sm text-system-600">No hay aportes que coincidan con los filtros.</p> : <div className={vistaCuadricula ? "grid grid-cols-2 gap-2 sm:gap-3" : "flex flex-col gap-2 sm:gap-3"}>{filtrados.map((item) => {
        const estadoEtiqueta = item.status === "aceptado" ? "Aceptado" : item.status === "rechazado" ? "Rechazado" : "En revisión";
        const estadoTono = item.status === "aceptado" ? "ok" : item.status === "rechazado" ? "danger" : "warn";
        const nombreDeTipo = NOMBRE_DE_TIPO[item.fileType];
        const href = `/mis-aportes/${item.campaignId}/${item.id}`;

        return (
          <article key={item.id} className={vistaCuadricula ? "flex h-full flex-col rounded-lg border border-system-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600 max-md:p-3" : "flex items-center gap-3 rounded-lg border border-system-200 bg-white p-2.5 shadow-sm transition-colors hover:border-brand-600 max-md:gap-2 max-md:p-2.5"}>
              {vistaCuadricula ? (
                <>
                  <MiniaturaDeAporte
                    aporteId={item.id}
                    tipo={item.fileType}
                    sinArchivo={item.sinArchivo}
                    alt={`Vista previa de ${nombreDeTipo.toLowerCase()} en ${item.campaignName}`}
                    className="mb-2.5 aspect-video w-full max-w-60 mx-auto object-cover"
                  />
                  <Link href={href} className="flex flex-1 flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                    <div className="h-[72px] overflow-hidden">
                      <h2 className="line-clamp-2 text-[13px] leading-5 font-bold text-system-900">{item.campaignName}</h2>
                      <Tag tone={estadoTono} className="mt-1">{estadoEtiqueta}</Tag>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[12.5px] text-system-600">{item.campaignTematica || "Sin temática"}</p>
                    <div className="mt-1 flex min-h-4 items-center whitespace-nowrap text-[11px]">
                      {item.calificacion != null ? (
                        <EstrellasDeCalificacion valor={item.calificacion} className="text-[13px]" />
                      ) : (
                        <span className="text-system-500">Sin calificación</span>
                      )}
                    </div>
                    <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-system-200 pt-3 text-[12px]">
                      <div><dt className="text-system-500">Tipo</dt><dd className="mt-0.5 font-semibold text-system-900">{nombreDeTipo}</dd></div>
                      <div><dt className="text-system-500">Fecha</dt><dd className="mt-0.5 font-mono text-system-900">{new Date(item.submittedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</dd></div>
                    </dl>
                  </Link>
                </>
              ) : (
                <>
                  <MiniaturaDeAporte aporteId={item.id} tipo={item.fileType} sinArchivo={item.sinArchivo} alt={`Vista previa de ${nombreDeTipo.toLowerCase()} en ${item.campaignName}`} className="h-12 w-12 shrink-0" />
                  <Link href={href} className="min-w-0 flex-1 overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                    <div className="flex min-w-0 items-center gap-2 overflow-hidden text-[12px]">
                      <span className="truncate font-bold text-system-900">{item.campaignName}</span>
                      <span className="shrink-0 text-system-400">•</span>
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-system-500">{nombreDeTipo}</span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-[11px] text-system-600">
                      <span className="truncate">{item.campaignTematica || "Sin temática"}</span>
                      <span className="h-1 w-1 shrink-0 rounded-full bg-system-300" aria-hidden="true" />
                      <span className="hidden shrink-0 items-center md:inline-flex">
                        {item.calificacion != null ? (
                          <EstrellasDeCalificacion valor={item.calificacion} className="text-[13px]" />
                        ) : (
                          <span className="text-system-500">Sin calificación</span>
                        )}
                      </span>
                      <span className="hidden h-1 w-1 shrink-0 rounded-full bg-system-300 md:inline-block" aria-hidden="true" />
                      <span className="shrink-0">{new Date(item.submittedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
                      <span className="h-1 w-1 shrink-0 rounded-full bg-system-300" aria-hidden="true" />
                      <span className="shrink-0">{estadoEtiqueta}</span>
                    </div>
                    <span className="md:hidden">
                      {item.calificacion != null ? (
                        <EstrellasDeCalificacion valor={item.calificacion} className="mt-1 text-[13px]" />
                      ) : (
                        <span className="mt-1 block text-[11px] text-system-500">Sin calificación</span>
                      )}
                    </span>
                  </Link>
                  <Tag tone={estadoTono} className="hidden shrink-0 md:inline-flex">{estadoEtiqueta}</Tag>
                </>
              )}
          </article>
        );
      })}</div>}
    </>}
  </div>;
}
