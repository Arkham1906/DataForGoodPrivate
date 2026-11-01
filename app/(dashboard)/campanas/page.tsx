"use client";

// Pantalla /campanas: campañas activas para participar. Componente cliente. Datos: GET /api/campanas y
// GET /api/auth/sesion; arriba, "Campañas para ti" como en /inicio (GET /api/campanas?paraTi=true,
// components/campanas/CampanasParaTi; 2026-10-27). Mientras llegan, tarjetas esqueleto (cards/CampaignCardSkeleton).
// Filtros (2026-10-31, a pedido del usuario): solo la barra de /sistema/campanas (campanas/BarraDeFiltros):
// "Mostrar" (todas, guardadas, tu localidad o cerca de ti), búsqueda, temática (las de tus intereses primero),
// subtemática, tipo de dato y orden; sin vigencia. Antes había filas de botones de temática, etiqueta y tipo.
// Ubicación real (2026-10-31; lib/ubicacion/): si la persona activó "Usar mi ubicación"
// (components/campanas/AvisoDeUbicacion), "Tu localidad" pasa a "Cerca de ti": su municipio detectado (GET
// /api/ubicacion), todo su estado y todo el país, y la lista abre así. Sin zona, sigue el estado del perfil.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AvisoDeUbicacion from "@/components/campanas/AvisoDeUbicacion";
import { EVENTO_ZONA, type ZonaDetectada } from "@/lib/ubicacion/en-el-navegador";
import CampaignCard from "@/components/cards/CampaignCard";
import CampaignCardSkeleton from "@/components/cards/CampaignCardSkeleton";
import BarraDeFiltros, { type ValoresDeFiltros } from "@/components/campanas/BarraDeFiltros";
import CampanasParaTi from "@/components/campanas/CampanasParaTi";
import type { CampanaParaTi } from "@/lib/usuarios/inicio";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import VentanaDeCampana from "@/components/campanas/VentanaDeCampana";
import type { Campaign } from "@/types";
import { BASE_PATH } from "@/lib/base-path";
import { FILTROS_VACIOS, filtrarCampanas, type FiltrosLocales } from "@/lib/campanas/filtro-local";
import { NOMBRE_DE_TIPO, type TipoDeDato } from "@/lib/campanas/sistema-opciones";
import { claveDeTematica } from "@/lib/tematicas/analizar";
import { useRecargaEnVivo } from "@/lib/en-vivo-cliente";

// Qué lista se muestra (select "Mostrar"): todas, las guardadas o las de su localidad / cerca de ti.
const TODAS = "";
const GUARDADAS = "guardadas";
const TU_LOCALIDAD = "localidad";
// Tarjetas esqueleto mientras cargan: dos filas en escritorio (3 columnas), suficientes en móvil.
const TARJETAS_DE_CARGA = 6;

/** "Estado de México" y "estado de mexico" cuentan como el mismo estado. */
function normalizarEstado(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

function BotonCambiarVista({ vistaCuadricula, onCambiar, className = "" }: { vistaCuadricula: boolean; onCambiar: () => void; className?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      className={`!size-[42px] !shrink-0 !rounded-lg !p-0 ${className}`}
      onClick={onCambiar}
      aria-label={vistaCuadricula ? "Cambiar a vista de lista" : "Cambiar a vista cuadriculada"}
      aria-pressed={vistaCuadricula}
      title={vistaCuadricula ? "Vista de lista" : "Vista cuadriculada"}
    >
      {vistaCuadricula ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      )}
    </Button>
  );
}

export default function CampanasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  // "Campañas para ti" (2026-10-27): las mismas de /inicio, arriba de los filtros.
  const [paraTi, setParaTi] = useState<CampanaParaTi[]>([]);
  // Campaña cuya ventana de detalle está abierta (2026-10-27): clic en su tarjeta.
  const [abierta, setAbierta] = useState<Campaign | null>(null);
  const [vistaCuadricula, setVistaCuadricula] = useState(true);
  const [vista, setVista] = useState(TODAS);
  // Temática elegida ("" = todas) y su subtemática (2026-10-27; "" = todas). Otra temática quita la subtemática.
  const [temaActivo, setTemaActivo] = useState("");
  const [etiquetaActiva, setEtiquetaActiva] = useState("");
  // Zona detectada por GPS (null: no la compartió). Al conocerla, la lista abre en "Cerca de ti" si la
  // persona todavía no eligió qué mostrar.
  const [zona, setZona] = useState<ZonaDetectada | null>(null);
  const eligioVista = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  // Estado declarado en el perfil (Mi cuenta); vacío si no lo ha indicado.
  const [miEstado, setMiEstado] = useState("");
  // Intereses del perfil (por clave, sin acentos): sus temáticas van primero en el select.
  const [misIntereses, setMisIntereses] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState<FiltrosLocales>(FILTROS_VACIOS);
  // Tipo de dato elegido; "" = todos. Se conserva al cambiar de temática.
  const [tipoActivo, setTipoActivo] = useState("");

  // Vuelve a leer cuando algo cambia en la base (actualización en vivo).
  const recarga = useRecargaEnVivo();
  useEffect(() => {
    async function cargarCampanas() {
      try {
        const [response, sesionRes, paraTiRes, zonaRes] = await Promise.all([
          fetch(`${BASE_PATH}/api/campanas`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/auth/sesion`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/campanas?paraTi=true`, { cache: "no-store" }),
          fetch(`${BASE_PATH}/api/ubicacion`, { cache: "no-store" }),
        ]);
        const zonaBody = await zonaRes.json().catch(() => ({}));
        const zonaGuardada = zonaRes.ok && zonaBody.zona ? (zonaBody.zona as ZonaDetectada) : null;
        setZona(zonaGuardada);
        if (zonaGuardada && !eligioVista.current) setVista(TU_LOCALIDAD);
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

  // La zona cambia sola (DetectorDeUbicacion) o con el aviso: se pone al día sin recargar.
  useEffect(() => {
    const alCambiar = (evento: Event) => {
      const nueva = (evento as CustomEvent<ZonaDetectada | null>).detail ?? null;
      setZona(nueva);
      // Si la lista la puso la zona (la persona no eligió otra), sigue a la zona: con ella "Cerca de ti",
      // sin ella "Todas".
      if (!eligioVista.current) setVista(nueva ? TU_LOCALIDAD : TODAS);
    };
    window.addEventListener(EVENTO_ZONA, alCambiar);
    return () => window.removeEventListener(EVENTO_ZONA, alCambiar);
  }, []);

  // Con zona detectada: su municipio, todo su estado y todo el país. Sin ella: el estado del perfil.
  const enMiEstado = zona
    ? campaigns.filter(
        (c) =>
          c.todoElPais ||
          (normalizarEstado(c.locationState) === normalizarEstado(zona.estado) &&
            (!c.locationCity || normalizarEstado(c.locationCity) === normalizarEstado(zona.municipio)))
      )
    : miEstado
      ? campaigns.filter((c) => c.todoElPais || normalizarEstado(c.locationState) === normalizarEstado(miEstado))
      : [];
  const lugarDelFiltro = zona ? `${zona.municipio}, ${zona.estado}` : miEstado;
  const guardadas = campaigns.filter((c) => c.isSaved);

  const vistas = [
    { valor: TODAS, etiqueta: `Mostrar: todas (${campaigns.length})` },
    { valor: GUARDADAS, etiqueta: `Guardadas (${guardadas.length})` },
    {
      valor: TU_LOCALIDAD,
      etiqueta: zona
        ? `Cerca de ti: ${zona.municipio} (${enMiEstado.length})`
        : miEstado
          ? `Tu localidad: ${miEstado} (${enMiEstado.length})`
          : "Tu localidad",
    },
  ];

  const porVista = vista === GUARDADAS ? guardadas : vista === TU_LOCALIDAD ? enMiEstado : campaigns;

  const esDeMisIntereses = (tema: string) => misIntereses.has(claveDeTematica(tema));

  // Temáticas de las campañas (así nunca aparece una opción sin resultados): primero las de los
  // intereses de la persona, luego de la más frecuente a la menos.
  const temasConCampanas = Array.from(
    campaigns.reduce((conteo, c) => (c.tag ? conteo.set(c.tag, (conteo.get(c.tag) ?? 0) + 1) : conteo), new Map<string, number>())
  ).sort(
    (a, b) =>
      Number(esDeMisIntereses(b[0])) - Number(esDeMisIntereses(a[0])) || b[1] - a[1] || a[0].localeCompare(b[0], "es")
  );

  const porTema = temaActivo ? porVista.filter((c) => c.tag === temaActivo) : porVista;
  const porEtiqueta =
    temaActivo && etiquetaActiva ? porTema.filter((c) => (c.etiquetas ?? []).some((e) => e.nombre === etiquetaActiva)) : porTema;

  const buscando = tipoActivo !== "" || busqueda.q.trim() !== "" || busqueda.orden !== "";
  const filtered = filtrarCampanas(porEtiqueta, { ...busqueda, tipo: tipoActivo }, (c) => c.tag);

  // Subtemáticas (aprobadas) de cada temática de la lista, para el select de la barra.
  const etiquetasPorTema: Record<string, string[]> = {};
  for (const c of campaigns) {
    if (!c.tag) continue;
    const nombres = new Set(etiquetasPorTema[c.tag] ?? []);
    for (const e of c.etiquetas ?? []) if (!e.pendiente) nombres.add(e.nombre);
    etiquetasPorTema[c.tag] = [...nombres].sort((a, b) => a.localeCompare(b, "es"));
  }

  function cambiarBusqueda(clave: keyof ValoresDeFiltros, valor: string) {
    if (clave === "q" || clave === "orden") setBusqueda((actual) => ({ ...actual, [clave]: valor }));
    else if (clave === "vista") {
      eligioVista.current = true;
      setVista(valor);
    } else if (clave === "tematica") {
      setTemaActivo(valor);
      setEtiquetaActiva("");
    } else if (clave === "etiqueta") setEtiquetaActiva(valor);
    else if (clave === "tipo") setTipoActivo(valor);
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

      {!cargando && !error && (
        <CampanasParaTi
          id="campanas-para-ti"
          campanas={paraTi}
          className="mb-8 max-md:mb-6"
          accion={<BotonCambiarVista vistaCuadricula={vistaCuadricula} onCambiar={() => setVistaCuadricula((actual) => !actual)} className="md:hidden" />}
        />
      )}

      {!cargando && !error && <AvisoDeUbicacion zona={zona} />}

      {!cargando && !error && (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <BarraDeFiltros
              valores={{ vista, q: busqueda.q, orden: busqueda.orden, tematica: temaActivo, etiqueta: etiquetaActiva, tipo: tipoActivo }}
              vistas={vistas}
              tematicas={temasConCampanas.map(([tema]) => tema)}
              etiquetasPorTematica={etiquetasPorTema}
              onCambiar={cambiarBusqueda}
              colapsableEnMovil
            />
          </div>
          <BotonCambiarVista vistaCuadricula={vistaCuadricula} onCambiar={() => setVistaCuadricula((actual) => !actual)} className="max-md:hidden" />
        </div>
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
      ) : vista === TU_LOCALIDAD && !lugarDelFiltro ? (
        <p className="text-sm text-system-600">
          Aún no indicas en qué estado vives.{" "}
          <Link href="/cuenta" className="font-semibold text-brand-600 hover:underline">
            Agrégalo en Mi cuenta
          </Link>{" "}
          o usa tu ubicación para ver las campañas de tu localidad.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-system-600">
          {buscando && porEtiqueta.length > 0
            ? tipoActivo && !busqueda.q.trim()
              ? `Ninguna campaña de esta lista pide ${NOMBRE_DE_TIPO[tipoActivo as TipoDeDato].toLowerCase()}.`
              : "Ninguna campaña coincide con la búsqueda."
            : temaActivo
              ? "No hay campañas de esta temática en esta lista."
              : vista === GUARDADAS
                ? "Todavía no has guardado ninguna campaña."
                : vista === TU_LOCALIDAD
                  ? `Por ahora no hay campañas activas en ${lugarDelFiltro}.`
                  : "Todavía no hay campañas activas."}
        </p>
      ) : (
        <div className={vistaCuadricula ? "grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3" : "flex flex-col gap-3"}>
          {/* Las tarjetas usan h3: este h2 evita saltar del h1 al h3. */}
          <h2 className="sr-only">Lista de campañas</h2>
          {filtered.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} compact={!vistaCuadricula} mobileCompact={vistaCuadricula} onAbrir={() => setAbierta(campaign)} />
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
