"use client";

// Pantalla /campanas: campañas activas para participar, con filtros por temática y "Tu localidad".
// Componente cliente. Datos: GET /api/campanas y GET /api/auth/sesion. Mientras llegan, tarjetas esqueleto
// (cards/CampaignCardSkeleton) en vez de la lista vacía.
// Pocas opciones a la vez (Ley de Hick, 2026-10-07): la fila muestra hasta MAXIMO_DE_TEMAS_VISIBLES
// temáticas, primero las de los intereses de la persona, y el resto va en "Más temáticas"
// (campanas/MasTematicas). Con más de UMBRAL_DE_BUSQUEDA campañas aparece la búsqueda con tipo y orden
// (campanas/BarraDeFiltros, sin temática: esa se elige con los botones).

import Link from "next/link";
import { useEffect, useState } from "react";
import CampaignCard from "@/components/cards/CampaignCard";
import CampaignCardSkeleton from "@/components/cards/CampaignCardSkeleton";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import MasTematicas from "@/components/campanas/MasTematicas";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { FILTROS_VACIOS, filtrarCampanas, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import { claveDeTematica } from "@/lib/tematicas/analizar";

const TU_LOCALIDAD = "Tu localidad";
// Después de estos van las temáticas que tienen las campañas activas (ver temasConCampanas).
const FILTROS_FIJOS = ["Todas", "Guardadas", TU_LOCALIDAD];
// Temáticas que se muestran como botón; las demás, en "Más temáticas".
const MAXIMO_DE_TEMAS_VISIBLES = 5;
// Con más campañas que esto, se muestran la búsqueda, el tipo de dato y el orden.
const UMBRAL_DE_BUSQUEDA = 9;
// Tarjetas esqueleto mientras cargan: dos filas en escritorio (3 columnas), suficientes en móvil.
const TARJETAS_DE_CARGA = 6;
// Botones de temática esqueleto mientras cargan: reservan el lugar para que la fila no cambie.
const TEMAS_DE_CARGA = 3;

const CLASE_DEL_FILTRO =
  "shrink-0 whitespace-nowrap rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors max-md:px-2.5 max-md:py-1 max-md:text-[12px]";
const CLASE_INACTIVO = "border-system-300 bg-white text-system-600 hover:border-brand-600";
const CLASE_ACTIVO = "border-brand-600 bg-brand-600 text-white";

/** "Estado de México" y "estado de mexico" cuentan como el mismo estado. */
function normalizarEstado(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

export default function CampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeTag, setActiveTag] = useState("Todas");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  // Estado declarado en el perfil (Mi cuenta); vacío si no lo ha indicado.
  const [miEstado, setMiEstado] = useState("");
  // Intereses del perfil (por clave, sin acentos): sus temáticas van primero en la fila.
  const [misIntereses, setMisIntereses] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState<FiltrosLocales>(FILTROS_VACIOS);

  useEffect(() => {
    async function cargarCampanas() {
      try {
        const [response, sesionRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" }),
        ]);
        const sesion = await sesionRes.json().catch(() => ({}));
        if (sesionRes.ok) {
          setMiEstado(String(sesion.data?.state ?? "").trim());
          const intereses: unknown = sesion.data?.intereses;
          if (Array.isArray(intereses)) setMisIntereses(new Set(intereses.map((t) => claveDeTematica(String(t)))));
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        const todas = Array.isArray(payload.data) ? (payload.data as Campaign[]) : [];
        // Solo campañas aprobadas por el supervisor (estado "activa") se muestran aquí.
        setCampaigns(todas.filter((campaign) => campaign.status === "activa"));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setCargando(false);
      }
    }
    void cargarCampanas();
  }, []);

  const enMiEstado = miEstado
    ? campaigns.filter((c) => normalizarEstado(c.locationState) === normalizarEstado(miEstado))
    : [];

  const esDeMisIntereses = (tema: string) => misIntereses.has(claveDeTematica(tema));

  // Temáticas de las campañas que se muestran (así nunca aparece un filtro sin resultados):
  // primero las de los intereses de la persona, luego de la más frecuente a la menos.
  const temasConCampanas = Array.from(
    campaigns.reduce((conteo, c) => (c.tag ? conteo.set(c.tag, (conteo.get(c.tag) ?? 0) + 1) : conteo), new Map<string, number>())
  ).sort(
    (a, b) =>
      Number(esDeMisIntereses(b[0])) - Number(esDeMisIntereses(a[0])) || b[1] - a[1] || a[0].localeCompare(b[0], "es")
  );
  const temasVisibles = temasConCampanas.slice(0, MAXIMO_DE_TEMAS_VISIBLES).map(([tema]) => tema);
  const temasOcultos = temasConCampanas.slice(MAXIMO_DE_TEMAS_VISIBLES);
  // Una temática elegida desde "Más temáticas" se ve como botón activo para poder quitarla.
  if (temasOcultos.some(([tema]) => tema === activeTag)) temasVisibles.push(activeTag);
  const filtros = [...FILTROS_FIJOS, ...temasVisibles];
  const porTema = new Map(temasConCampanas);

  const porFiltro =
    activeTag === "Todas"
      ? campaigns
      : activeTag === "Guardadas"
        ? campaigns.filter((c) => c.isSaved)
        : activeTag === TU_LOCALIDAD
          ? enMiEstado
          : campaigns.filter((c) => c.tag === activeTag);

  const conBusqueda = campaigns.length > UMBRAL_DE_BUSQUEDA;
  const buscando = conBusqueda && (busqueda.q.trim() !== "" || busqueda.tipo !== "" || busqueda.orden !== "");
  const filtered = conBusqueda ? filtrarCampanas(porFiltro, busqueda, (c) => c.tag) : porFiltro;

  function cambiarBusqueda(clave: keyof ValoresDeFiltros, valor: string) {
    if (clave === "q" || clave === "tipo" || clave === "orden") setBusqueda((actual) => ({ ...actual, [clave]: valor }));
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 max-md:mb-4 max-md:gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-system-900 max-md:text-xl max-md:leading-tight">Campañas disponibles</h1>
          <p className="mt-1 text-[13px] text-system-600 max-md:max-w-[220px] max-md:text-[12px] max-md:leading-5">
            Descubre proyectos con impacto social cerca de ti.
          </p>
        </div>
        <Link href="/mis-campanas/nueva">
          <Button variant="primary" size="sm" className="whitespace-nowrap max-md:max-w-[126px] max-md:px-2.5 max-md:py-1.5 max-md:text-[11.5px] max-md:leading-4">
            Crear campaña
          </Button>
        </Link>
      </div>

      <div className="dashboard-nav mb-6 mt-4 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:mb-4 max-md:gap-1.5 md:flex-wrap md:overflow-visible md:pb-0" role="group" aria-label="Filtrar campañas">
        {filtros.map((filtro) => {
          const active = filtro === activeTag;
          const deMisIntereses = !FILTROS_FIJOS.includes(filtro) && esDeMisIntereses(filtro);
          const contador =
            filtro === "Todas"
              ? campaigns.length
              : filtro === "Guardadas"
                ? campaigns.filter((c) => c.isSaved).length
                : filtro === TU_LOCALIDAD
                  ? miEstado
                    ? enMiEstado.length
                    : null
                  : (porTema.get(filtro) ?? null);
          return (
            <button
              key={filtro}
              type="button"
              onClick={() => setActiveTag(filtro)}
              aria-pressed={active}
              title={
                filtro === TU_LOCALIDAD && miEstado
                  ? `Campañas en ${miEstado}`
                  : deMisIntereses
                    ? "Está entre tus intereses"
                    : undefined
              }
              className={`${CLASE_DEL_FILTRO} ${active ? CLASE_ACTIVO : CLASE_INACTIVO}`}
            >
              {deMisIntereses && (
                <span aria-hidden="true" className={`mr-1 ${active ? "text-white" : "text-brand-600"}`}>
                  ★
                </span>
              )}
              {filtro}
              {deMisIntereses && <span className="sr-only"> (de tus intereses)</span>}
              {cargando && filtro !== TU_LOCALIDAD ? (
                <Skeleton enLinea className="ml-1.5 h-3 w-3 align-[-1px]" />
              ) : (
                contador !== null && <span className="ml-1.5 font-mono">{contador}</span>
              )}
            </button>
          );
        })}
        {cargando &&
          Array.from({ length: TEMAS_DE_CARGA }, (_, i) => (
            <Skeleton key={i} className="h-[33px] w-28 shrink-0 rounded-pill max-md:h-[27px] max-md:w-24" />
          ))}
        {temasOcultos.length > 0 && (
          <MasTematicas temas={temasOcultos} onElegir={setActiveTag} claseDelBoton={`${CLASE_DEL_FILTRO} ${CLASE_INACTIVO}`} />
        )}
      </div>

      {conBusqueda && !cargando && !error && (
        <BarraDeFiltros
          valores={{ ...busqueda, tematica: "" }}
          tematicas={[]}
          onCambiar={cambiarBusqueda}
          conTematica={false}
          colapsableEnMovil
        />
      )}

      {error ? (
        <p className="rounded-lg bg-error-50 p-4 text-sm text-error-700">{error}</p>
      ) : cargando ? (
        <div role="status" aria-live="polite" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">Cargando campañas…</span>
          {Array.from({ length: TARJETAS_DE_CARGA }, (_, i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      ) : activeTag === TU_LOCALIDAD && !miEstado ? (
        <p className="text-sm text-system-600">
          Aún no indicas en qué estado vives.{" "}
          <Link href="/cuenta" className="font-semibold text-brand-600 hover:underline">
            Agrégalo en Mi cuenta
          </Link>{" "}
          para ver las campañas de tu localidad.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-system-600">
          {buscando && porFiltro.length > 0
            ? "Ninguna campaña coincide con la búsqueda."
            : activeTag === "Guardadas"
              ? "Todavía no has guardado ninguna campaña."
              : activeTag === TU_LOCALIDAD
                ? `Por ahora no hay campañas activas en ${miEstado}.`
                : "No hay campañas aprobadas para esta temática todavía."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Las tarjetas usan h3: este h2 evita saltar del h1 al h3. */}
          <h2 className="sr-only">Lista de campañas</h2>
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
