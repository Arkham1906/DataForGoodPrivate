"use client";

// Pantalla /campanas: campañas activas para participar, con filtros por temática y "Tu localidad".
// Componente cliente. Datos: GET /api/campanas y GET /api/auth/sesion; arriba, "Campañas para ti" como en
// /inicio (GET /api/campanas?paraTi=true, components/campanas/CampanasParaTi; 2026-10-27). Mientras llegan, tarjetas esqueleto
// (cards/CampaignCardSkeleton) en vez de la lista vacía.
// Pocas opciones a la vez (Ley de Hick, 2026-10-07): la fila muestra hasta MAXIMO_DE_TEMAS_VISIBLES
// temáticas, primero las de los intereses de la persona, y el resto va en "Más temáticas"
// (campanas/MasTematicas). Con más de UMBRAL_DE_BUSQUEDA campañas aparece la búsqueda con tipo y orden
// (campanas/BarraDeFiltros, sin temática ni tipo: esos se eligen con los botones).
// Tipo de dato (2026-10-28, a pedido del usuario): fila de botones siempre visible con los tipos que
// piden las campañas de la lista; se combina con temática, etiqueta y búsqueda.

import Link from "next/link";
import { useEffect, useState } from "react";
import CampaignCard from "@/components/cards/CampaignCard";
import CampaignCardSkeleton from "@/components/cards/CampaignCardSkeleton";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import MasTematicas from "@/components/campanas/MasTematicas";
import CampanasParaTi from "@/components/campanas/CampanasParaTi";
import type { CampanaParaTi } from "@/lib/usuarios/inicio";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import VentanaDeCampana from "@/components/campanas/VentanaDeCampana";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { FILTROS_VACIOS, filtrarCampanas, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import { NOMBRE_DE_TIPO, type TipoDeDato } from "@/lib/campanas/sistema-opciones";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

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
// Orden de los botones de tipo de dato: el mismo del formulario de campaña.
const TIPOS_DE_DATO = Object.keys(NOMBRE_DE_TIPO) as TipoDeDato[];

/** "Estado de México" y "estado de mexico" cuentan como el mismo estado. */
function normalizarEstado(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

export default function CampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // "Campañas para ti" (2026-10-27): las mismas de /inicio, arriba de los filtros.
  const [paraTi, setParaTi] = useState<CampanaParaTi[]>([]);
  // Campaña cuya ventana de detalle está abierta (2026-10-27): clic en su tarjeta.
  const [abierta, setAbierta] = useState<Campaign | null>(null);
  const [activeTag, setActiveTag] = useState("Todas");
  // Subtemática dentro de la temática elegida (2026-10-27); "" = todas. Cambiar de filtro la quita.
  const [etiquetaActiva, setEtiquetaActiva] = useState("");
  function elegirFiltro(filtro: string) {
    setActiveTag(filtro);
    setEtiquetaActiva("");
  }
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  // Estado declarado en el perfil (Mi cuenta); vacío si no lo ha indicado.
  const [miEstado, setMiEstado] = useState("");
  // Intereses del perfil (por clave, sin acentos): sus temáticas van primero en la fila.
  const [misIntereses, setMisIntereses] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState<FiltrosLocales>(FILTROS_VACIOS);
  // Tipo de dato elegido con los botones; "" = todos. Se conserva al cambiar de temática.
  const [tipoActivo, setTipoActivo] = useState("");

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function cargarCampanas() {
      try {
        const [response, sesionRes, paraTiRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/campanas?paraTi=true`, { cache: "no-store" }),
        ]);
        // Si falla, la sección no sale; la lista sigue.
        const paraTiBody = await paraTiRes.json().catch(() => ({}));
        setParaTi(paraTiRes.ok && Array.isArray(paraTiBody.data) ? (paraTiBody.data as CampanaParaTi[]) : []);
        const sesion = await sesionRes.json().catch(() => ({}));
        if (sesionRes.ok) {
          setMiEstado(String(sesion.data?.state ?? "").trim());
          const intereses: unknown = sesion.data?.intereses;
          if (Array.isArray(intereses)) setMisIntereses(new Set(intereses.map((t) => claveDeTematica(String(t)))));
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las campañas");
        const todas = Array.isArray(payload.data) ? (payload.data as Campaign[]) : [];
        // Activas y, después, las pausadas (2026-10-24, a pedido del usuario: antes solo activas). Una pausada
        // sale con su etiqueta y no recibe aportes (lo vuelve a comprobar el servidor).
        setCampaigns(
          todas
            .filter((campaign) => campaign.status === "activa" || campaign.status === "pausada")
            .sort((a, b) => Number(a.status === "pausada") - Number(b.status === "pausada"))
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas");
      } finally {
        setCargando(false);
      }
    }
    void cargarCampanas();
  }, [recarga]);

  const enMiEstado = miEstado
    ? campaigns.filter((c) => c.todoElPais || normalizarEstado(c.locationState) === normalizarEstado(miEstado))
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

  // Etiquetas de la temática elegida, con cuántas campañas de la lista tiene cada una (así nunca
  // sale un filtro sin resultados). Solo cuando el filtro activo es una temática.
  const esTematica = !FILTROS_FIJOS.includes(activeTag);
  const etiquetasDelTema = esTematica
    ? Array.from(
        porFiltro.reduce((conteo, c) => {
          for (const e of c.etiquetas ?? []) if (!e.pendiente) conteo.set(e.nombre, (conteo.get(e.nombre) ?? 0) + 1);
          return conteo;
        }, new Map<string, number>())
      ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    : [];
  const porEtiqueta =
    esTematica && etiquetaActiva ? porFiltro.filter((c) => (c.etiquetas ?? []).some((e) => e.nombre === etiquetaActiva)) : porFiltro;

  // Tipos de dato de la lista ya filtrada por temática y etiqueta, con cuántas campañas lo piden
  // (así nunca sale un botón sin resultados); el elegido sigue visible aunque quede en 0, para poder quitarlo.
  const tiposDeLaLista = TIPOS_DE_DATO.map((tipo) => [tipo, porEtiqueta.filter((c) => (c.dataTypes ?? []).includes(tipo)).length] as const).filter(
    ([tipo, total]) => total > 0 || tipo === tipoActivo
  );

  const conBusqueda = campaigns.length > UMBRAL_DE_BUSQUEDA;
  const buscando = tipoActivo !== "" || (conBusqueda && (busqueda.q.trim() !== "" || busqueda.orden !== ""));
  const filtered = filtrarCampanas(porEtiqueta, { ...(conBusqueda ? busqueda : FILTROS_VACIOS), tipo: tipoActivo }, (c) => c.tag);

  function cambiarBusqueda(clave: keyof ValoresDeFiltros, valor: string) {
    if (clave === "q" || clave === "orden") setBusqueda((actual) => ({ ...actual, [clave]: valor }));
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

      {!cargando && !error && <CampanasParaTi id="campanas-para-ti" campanas={paraTi} className="mb-8 max-md:mb-6" />}

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
              onClick={() => elegirFiltro(filtro)}
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
          <MasTematicas temas={temasOcultos} onElegir={elegirFiltro} claseDelBoton={`${CLASE_DEL_FILTRO} ${CLASE_INACTIVO}`} />
        )}
      </div>

      {etiquetasDelTema.length > 0 && (
        <div
          className="dashboard-nav -mt-3 mb-6 flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:-mt-2 max-md:mb-4 md:flex-wrap md:overflow-visible md:pb-0"
          role="group"
          aria-label={`Etiquetas de ${activeTag}`}
        >
          <span className="mr-1 shrink-0 text-[12px] text-system-500">Etiquetas:</span>
          {etiquetasDelTema.map(([nombre, total]) => {
            const activa = etiquetaActiva === nombre;
            return (
              <button
                key={nombre}
                type="button"
                aria-pressed={activa}
                onClick={() => setEtiquetaActiva(activa ? "" : nombre)}
                className={`shrink-0 whitespace-nowrap rounded-pill border px-2.5 py-1 text-[12px] font-semibold transition-colors ${activa ? CLASE_ACTIVO : CLASE_INACTIVO}`}
              >
                #{nombre}
                <span className="ml-1.5 font-mono">{total}</span>
              </button>
            );
          })}
        </div>
      )}

      {!cargando && !error && tiposDeLaLista.length > 0 && (
        <div
          className="dashboard-nav -mt-3 mb-6 flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] max-md:-mt-2 max-md:mb-4 md:flex-wrap md:overflow-visible md:pb-0"
          role="group"
          aria-label="Filtrar por tipo de dato"
        >
          <span className="mr-1 shrink-0 text-[12px] text-system-500">Tipo de dato:</span>
          {tiposDeLaLista.map(([tipo, total]) => {
            const activo = tipoActivo === tipo;
            return (
              <button
                key={tipo}
                type="button"
                aria-pressed={activo}
                onClick={() => setTipoActivo(activo ? "" : tipo)}
                className={`shrink-0 whitespace-nowrap rounded-pill border px-2.5 py-1 text-[12px] font-semibold transition-colors ${activo ? CLASE_ACTIVO : CLASE_INACTIVO}`}
              >
                {NOMBRE_DE_TIPO[tipo]}
                <span className="ml-1.5 font-mono">{total}</span>
              </button>
            );
          })}
        </div>
      )}

      {conBusqueda && !cargando && !error && (
        <BarraDeFiltros
          valores={{ ...busqueda, tematica: "", tipo: "" }}
          tematicas={[]}
          onCambiar={cambiarBusqueda}
          conTematica={false}
          conTipo={false}
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
          {buscando && porEtiqueta.length > 0
            ? tipoActivo && !(conBusqueda && busqueda.q.trim())
              ? `Ninguna campaña de esta lista pide ${NOMBRE_DE_TIPO[tipoActivo as TipoDeDato].toLowerCase()}.`
              : "Ninguna campaña coincide con la búsqueda."
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
            <CampaignCard key={campaign.id} campaign={campaign} onAbrir={() => setAbierta(campaign)} />
          ))}
        </div>
      )}

      {abierta && (
        <VentanaDeCampana
          key={abierta.id}
          campana={abierta}
          onCerrar={() => setAbierta(null)}
          extra={
            abierta.isBanned ? (
              <p className="rounded-lg bg-error-50 p-3 text-[12.5px] text-error-700">Quien organiza esta campaña te baneó: ya no puedes aportar en ella.</p>
            ) : abierta.status === "pausada" ? (
              <p className="rounded-lg bg-warning-50 p-3 text-[12.5px] text-system-900">Está pausada: por ahora no recibe aportes.</p>
            ) : undefined
          }
          acciones={
            <ButtonLink href={`/campanas/${abierta.id}`} variant="primary" size="sm">
              {abierta.status === "activa" && !abierta.isBanned ? "Ir a la campaña y participar" : "Ir a la campaña"}
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
